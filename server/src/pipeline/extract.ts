import { zodTextFormat } from 'openai/helpers/zod';
import { EXTRACT_MODEL, getOpenAI, refusalReason } from './client.js';
import type { IngestedDoc } from './ingest.js';
import { ClassificationResult, ExtractionDocument } from './schema.js';

const INSTRUCTIONS = `You extract structured data for a New Zealand electrical contractor's job archive from the attached document (a site plan, wiring/electrical layout plan, switchboard schedule, single-line diagram, legend, or legacy job paperwork - COC, ESC, quote, invoice, or cable schedule).

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
6. Populate every item's trace object: doc_id, page (1-indexed as it appears in the document), bbox (a normalized 0-1 bounding box on the page if you can identify one, else null), method ('vision-llm' for a page read as an image/PDF, 'text-llm' for content read from supplied plain text), and confidence.
7. Skip pages already classified as noise (given below) unless they clearly contain job data the classifier missed - extract those anyway and add a needs_review entry explaining the mismatch.`;

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
