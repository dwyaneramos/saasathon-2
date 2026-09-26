import { zodTextFormat } from 'openai/helpers/zod';
import { CLASSIFY_MODEL, getOpenAI, incompleteReason, refusalReason } from './client.js';
import type { IngestedDoc } from './ingest.js';
import { ClassificationResult } from './schema.js';

const INSTRUCTIONS = `You triage scanned documents for a New Zealand electrical contractor's job archive: site plans, power plans, lighting/RCP plans, wiring/electrical layout plans, LV or specialty plans (data, security, nurse-call, AV - a different system sharing building space), switchboard/panel schedules, single-line diagrams, legends, and legacy job paperwork (COCs, ESCs, quotes, invoices, cable schedules).

For every page in the attached document, report its doc_type and whether it is noise. "Noise" means blank, a cover sheet with no technical content, boilerplate terms and conditions, or otherwise carrying nothing relevant to the electrical work or job record - not merely "hard to read".

A page whose type you genuinely cannot determine is 'unknown' with low confidence. Do not guess a plausible sheet type to avoid 'unknown' - an unrecognised sheet is routed to a manual tagging queue, which is a better outcome than a sheet processed under the wrong rules.

Be conservative: prefer a lower confidence over marking a page noise. A page you're unsure about should stay in the pipeline for the extraction pass to look at, not be dropped here.`;

export async function classifyDoc(doc: IngestedDoc): Promise<ClassificationResult> {
  const stream = getOpenAI().responses.stream({
    model: CLASSIFY_MODEL,
    instructions: INSTRUCTIONS,
    max_output_tokens: 8192,
    input: [
      {
        role: 'user',
        content: [
          doc.contentBlock,
          { type: 'input_text', text: `doc_id: ${doc.docId}\nsource_file: ${doc.sourceFile}` },
        ],
      },
    ],
    text: { format: zodTextFormat(ClassificationResult, 'classification_result') },
  });

  const response = await stream.finalResponse();

  if (!response.output_parsed) {
    const refusal = refusalReason(response.output);
    const incomplete = incompleteReason(response);
    throw new Error(
      refusal
        ? `classification refused for ${doc.sourceFile}: ${refusal}`
        : incomplete
          ? `classification incomplete for ${doc.sourceFile}: ${incomplete}`
          : `classification returned no parsable structured output for ${doc.sourceFile} (status: ${response.status})`,
    );
  }
  return response.output_parsed;
}
