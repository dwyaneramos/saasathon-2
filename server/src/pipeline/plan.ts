import { zodTextFormat } from 'openai/helpers/zod';
import { getOpenAI, PLAN_MODEL, refusalReason } from './client.js';
import type { ExtractionDocument } from './schema.js';
import { WiringPlan } from './schema.js';

const INSTRUCTIONS = `You assemble a wiring materials list for a New Zealand electrical contractor from a set of already-extracted documents for one job (site plans, wiring/electrical layout plans, switchboard schedules, cable schedules, and legacy quotes/invoices). Each input document has already been through OCR/vision extraction - you are reconciling and organizing what it found, not reading original files.

Rules, in order of importance:
1. Never state a cable type, quantity, rating, or destination that is not present in at least one source document's extracted or inferred fields. If no document states a needed spec, leave that field null and say so in needs_info rather than guessing or computing it.
2. Never compute or derive cable sizing, load calculations, derated ampacities, or pricing - these are the same rules extraction was already held to; you are aggregating, not engineering.
3. Every item must cite at least one entry in \`sources\` (doc_id + item_ref, e.g. "cable_schedule_rows[2].cable_type") pointing at the specific source field(s) it was built from.
4. Confidence is bounded by these rules, not free judgment:
   - "high": exactly one document states type, quantity, and destination for this item, each with extraction confidence >= 0.8, and no other document contradicts it.
   - "low": any of type/quantity/destination is missing from every source, sources conflict with each other, or every citing field's confidence is < 0.6.
   - "medium": anything in between (e.g. a single low-confidence source, or a minor unit mismatch).
5. When two documents disagree about the same run (e.g. a quote lists a different cable size than the cable schedule for what looks like the same circuit), emit one item per distinct claim rather than silently picking one, and explain the conflict in needs_info.
6. needs_info must be non-null whenever confidence is "low" or "medium", and null only when confidence is "high".`;

export async function planWiring(docs: ExtractionDocument[]): Promise<WiringPlan> {
  const stream = getOpenAI().responses.stream({
    model: PLAN_MODEL,
    instructions: INSTRUCTIONS,
    max_output_tokens: 16000,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Extracted documents for this job (${docs.length} total):\n${JSON.stringify(docs, null, 2)}`,
          },
        ],
      },
    ],
    text: { format: zodTextFormat(WiringPlan, 'wiring_plan') },
  });

  const response = await stream.finalResponse();

  if (!response.output_parsed) {
    const refusal = refusalReason(response.output);
    throw new Error(
      refusal
        ? `wiring plan generation refused: ${refusal}`
        : `wiring plan generation returned no parsable structured output (status: ${response.status})`,
    );
  }
  return response.output_parsed;
}
