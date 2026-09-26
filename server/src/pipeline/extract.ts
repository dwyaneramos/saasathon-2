import { zodTextFormat } from 'openai/helpers/zod';
import { EXTRACT_MODEL, getOpenAI, incompleteReason, refusalReason } from './client.js';
import type { IngestedDoc, IngestedPage } from './ingest.js';
import { forcePageNumber, mergePageExtractions } from './merge.js';
import { ClassificationResult, ExtractionDocument, type PageClassification } from './schema.js';

const INSTRUCTIONS = `You extract structured data for a New Zealand electrical contractor's job archive from the attached document (a site plan, power plan, lighting/RCP plan, wiring/electrical layout plan, LV or specialty plan, switchboard/panel schedule, single-line diagram, legend, or legacy job paperwork - COC, ESC, quote, invoice, or cable schedule).

Rules, in order of importance:
1. Never invent data. Extract only what the document actually states.
2. Every field carries a provenance: 'extracted' when read directly from the document; 'inferred' when derived from other stated facts by a rule you name in that field's \`rule\`; 'assumed' when you fall back to a default in the absence of information, with the default named in \`rule\`. \`rule\` must be non-null whenever provenance isn't 'extracted'.
3. Set each field's confidence conservatively. Prefer flagging low confidence and adding a needs_review entry over guessing or silently dropping a value. When a value isn't stated, leave it null (provenance 'assumed', low confidence) rather than fabricating one.
4. Never compute or derive cable sizing, load calculations, derated ampacities, or pricing. Copy ratings, quantities, and totals exactly as printed; if a computation would be required to fill a field, leave it null instead. One narrow exception: on a site plan or wiring layout plan that gives real-world measurements - a printed scale ratio (e.g. "1:100"), a scale bar, a stated grid/unit size, OR explicit dimension callouts on dimension lines (e.g. wall or room lengths marked in mm/m, as on a dimensioned floor plan) - you may estimate a cable run's \`length_m\`. This applies equally to \`cable_schedule_rows[].length_m\` and to \`circuits[].length_m\` - a lighting or power circuit drawn on a layout plan (switchboard to a light/outlet symbol, no separate schedule table) is the same physical cable run as a schedule row, it just arrived in a different-shaped document, and it deserves the same estimate:
   - Locate the run's two connection points on the drawing (e.g. the switchboard symbol and a light/outlet symbol).
   - Get a horizontal distance between them: sum the printed dimensions along the walls/rooms you'd route through, or scale the drawn distance if the plan uses a scale/scale bar instead of dimension callouts.
   - If one end is a wall-mounted switchboard and the other is a ceiling-mounted point (true for most lighting circuits), add a fixed 2.4m for the vertical rise, since floor plans don't show ceiling height.
   - Add a further +20% on top of that total for wall/ceiling/conduit routing slack.
   - Name every step of that arithmetic in \`rule\` (e.g. "SB to L1: ~4.2m along dimensioned wall + 2.4m vertical rise + 20% routing = 7.9m"), set provenance 'inferred', and cap confidence at 0.6 regardless of how precise the dimensions look, since this is still a geometric estimate, not a printed cable length.
   Never do this when the plan gives no scale or dimensions at all - leave \`length_m\` null instead. This exception covers cable length only; never estimate cable type, rating, sizing, or pricing this way.
5. Do not quote or reproduce text from AS/NZS standards documents, even if referenced on the plan - note that a standard is referenced (e.g. in a needs_review entry) without copying its content.
6. Populate every item's trace object: doc_id, page (1-indexed as it appears in the document), bbox (a normalized 0-1 bounding box on the page if you can identify one, else null), region (how a drafter would name the spot - grid reference "C7", "row 4", a zone name - else null), method ('vision-llm' for a page read as an image/PDF, 'text-llm' for content read from supplied plain text), and confidence.
7. Skip pages already classified as noise (given below) unless they clearly contain job data the classifier missed - extract those anyway and add a needs_review entry explaining the mismatch.

On plan sheets, the order below is mandatory - symbol legends are NOT standardized between drafters or firms, so this sheet's own legend is the only authority:
8. Populate \`legend_items\` FIRST, from this sheet's own legend or key block, in the drafter's own words. Do not merge legends across sheets.
9. Only then populate \`plan_symbols\`, interpreting each symbol via a \`legend_ref\` pointing at this sheet's legend. If the sheet has NO legend, leave every \`symbol_meaning\` and \`legend_ref\` null, set their confidence low, and add one needs_review entry saying the sheet has no legend - never substitute a generic or "typical" legend.
10. \`circuit_tag\` is whatever circuit number is physically written next to the symbol, exactly as printed. Null when no number is written. \`rated_current_a\` is a rating printed next to the symbol - never a rating you worked out from the load type. Record what the sheets actually disagree about rather than reconciling it: if a plan and a schedule are uploaded together and disagree, extract both as printed and let the merge stage raise the conflict.`;

const NO_CLASSIFICATION_FALLBACK: Omit<PageClassification, 'page'> = {
  doc_type: 'other_noise',
  is_noise: false,
  noise_reason: null,
  confidence: 0.1,
};

/** Extracts a single page. A whole multi-page document is never sent in one call - see
 * extractDoc - so this always stays well under the model's output-token limit regardless of
 * how many pages the source file has. */
async function extractOnePage(
  doc: IngestedDoc,
  page: IngestedPage,
  pageClassification: PageClassification,
): Promise<ExtractionDocument> {
  const stream = getOpenAI().responses.stream({
    model: EXTRACT_MODEL,
    instructions: INSTRUCTIONS,
    max_output_tokens: 32000,
    input: [
      {
        role: 'user',
        content: [
          page.contentBlock,
          {
            type: 'input_text',
            text: `doc_id: ${doc.docId}\nsource_file: ${doc.sourceFile}\nThis is page ${page.page} of ${doc.pages.length} in the source file - the attached content is only this one page. Extract only what's on it.\npage classification from the triage pass:\n${JSON.stringify(pageClassification, null, 2)}`,
          },
        ],
      },
    ],
    text: { format: zodTextFormat(ExtractionDocument, 'extraction_document') },
  });

  const response = await stream.finalResponse();

  if (!response.output_parsed) {
    const refusal = refusalReason(response.output);
    const incomplete = incompleteReason(response);
    throw new Error(
      refusal
        ? `extraction refused for ${doc.sourceFile} page ${page.page}: ${refusal}`
        : incomplete
          ? `extraction incomplete for ${doc.sourceFile} page ${page.page}: ${incomplete}`
          : `extraction returned no parsable structured output for ${doc.sourceFile} page ${page.page} (status: ${response.status})`,
    );
  }
  return forcePageNumber(response.output_parsed, page.page);
}

/** Extracts each page of the document independently and merges the results, so a large or
 * detailed document's total extraction output is never bounded by a single request's
 * output-token limit the way sending the whole file in one call was. */
export async function extractDoc(doc: IngestedDoc, classification: ClassificationResult): Promise<ExtractionDocument> {
  const classificationByPage = new Map(classification.pages.map((p) => [p.page, p]));
  const pageResults: ExtractionDocument[] = [];
  for (const page of doc.pages) {
    const pageClassification = classificationByPage.get(page.page) ?? { ...NO_CLASSIFICATION_FALLBACK, page: page.page };
    pageResults.push(await extractOnePage(doc, page, pageClassification));
  }
  return mergePageExtractions(pageResults, doc.docId, doc.sourceFile, doc.pages.length);
}
