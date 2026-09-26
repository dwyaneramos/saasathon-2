import { zodTextFormat } from 'openai/helpers/zod';
import { EXTRACT_MODEL, getOpenAI, refusalReason } from './client.js';
import type { IngestedDoc } from './ingest.js';
import { ClassificationResult, ExtractionDocument } from './schema.js';

const INSTRUCTIONS = `You extract structured data for a New Zealand electrical contractor's job archive from the attached document (a site plan, power plan, lighting/RCP plan, wiring/electrical layout plan, LV or specialty plan, switchboard/panel schedule, single-line diagram, legend, or legacy job paperwork - COC, ESC, quote, invoice, or cable schedule).

Rules, in order of importance:
1. Never invent data. Extract only what the document actually states.
2. Every field carries a provenance: 'extracted' when read directly from the document; 'inferred' when derived from other stated facts by a rule you name in that field's \`rule\`; 'assumed' when you fall back to a default in the absence of information, with the default named in \`rule\`. \`rule\` must be non-null whenever provenance isn't 'extracted'.
3. Set each field's confidence conservatively. Prefer flagging low confidence and adding a needs_review entry over guessing or silently dropping a value. When a value isn't stated, leave it null (provenance 'assumed', low confidence) rather than fabricating one.
4. Never compute or derive cable sizing, load calculations, derated ampacities, or pricing. Copy ratings, quantities, and totals exactly as printed; if a computation would be required to fill a field, leave it null instead. One narrow exception: on a site plan or wiring layout plan that prints a scale (a ratio like "1:100", a scale bar, or a stated grid/unit size), you may estimate a cable run's \`length_m\` by measuring the drawn distance between its two connection points, scaled to real units, plus a fixed +20% allowance for wall/ceiling/conduit routing - name the scale and the allowance in \`rule\` (e.g. "scaled from 1:100 site plan, +20% routing allowance"), set provenance 'inferred', and cap confidence at 0.6 regardless of how clear the drawing is, since a routed cable is never exactly the scaled straight-line distance. Never do this when the plan prints no scale or dimensions - leave \`length_m\` null instead. This exception covers cable length only; never estimate cable type, rating, sizing, or pricing this way.
5. Do not quote or reproduce text from AS/NZS standards documents, even if referenced on the plan - note that a standard is referenced (e.g. in a needs_review entry) without copying its content.
6. Populate every item's trace object: doc_id, page (1-indexed as it appears in the document), bbox (a normalized 0-1 bounding box on the page if you can identify one, else null), region (how a drafter would name the spot - grid reference "C7", "row 4", a zone name - else null), method ('vision-llm' for a page read as an image/PDF, 'text-llm' for content read from supplied plain text), and confidence.
7. Skip pages already classified as noise (given below) unless they clearly contain job data the classifier missed - extract those anyway and add a needs_review entry explaining the mismatch.

On plan sheets, the order below is mandatory - symbol legends are NOT standardized between drafters or firms, so this sheet's own legend is the only authority:
8. Populate \`legend_items\` FIRST, from this sheet's own legend or key block, in the drafter's own words. Do not merge legends across sheets.
9. Only then populate \`plan_symbols\`, interpreting each symbol via a \`legend_ref\` pointing at this sheet's legend. If the sheet has NO legend, leave every \`symbol_meaning\` and \`legend_ref\` null, set their confidence low, and add one needs_review entry saying the sheet has no legend - never substitute a generic or "typical" legend.
10. \`circuit_tag\` is whatever circuit number is physically written next to the symbol, exactly as printed. Null when no number is written. \`rated_current_a\` is a rating printed next to the symbol - never a rating you worked out from the load type. Record what the sheets actually disagree about rather than reconciling it: if a plan and a schedule are uploaded together and disagree, extract both as printed and let the merge stage raise the conflict.`;

export async function extractDoc(doc: IngestedDoc, classification: ClassificationResult): Promise<ExtractionDocument> {
  const stream = getOpenAI().responses.stream({
    model: EXTRACT_MODEL,
    instructions: INSTRUCTIONS,
    max_output_tokens: 32000,
    input: [
      {
        role: 'user',
        content: [
          doc.contentBlock,
          {
            type: 'input_text',
            text: `doc_id: ${doc.docId}\nsource_file: ${doc.sourceFile}\npage classification from the triage pass:\n${JSON.stringify(classification.pages, null, 2)}`,
          },
        ],
      },
    ],
    text: { format: zodTextFormat(ExtractionDocument, 'extraction_document') },
  });

  const response = await stream.finalResponse();

  if (!response.output_parsed) {
    const refusal = refusalReason(response.output);
    throw new Error(
      refusal
        ? `extraction refused for ${doc.sourceFile}: ${refusal}`
        : `extraction returned no parsable structured output for ${doc.sourceFile} (status: ${response.status})`,
    );
  }
  return response.output_parsed;
}
