import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { COMPLIANCE_MODEL, getOpenAI, refusalReason } from '../pipeline/client.js';
import type { Breach, ComplianceResult } from './types.js';

const ComplianceBreach = z.object({
  standard: z.enum(['AS/NZS 3000', 'AS/NZS 3008.1.2']),
  clause: z
    .string()
    .nullable()
    .describe('Clause or table number, only when confident it is the right one (e.g. "2.6.3"). Null otherwise.'),
  severity: z.enum(['high', 'medium', 'low']),
  source: z
    .string()
    .describe('Where the problem was found: the source_file of an uploaded document, or "Project drawing".'),
  item_ref: z.string().describe('Path-like reference to the offending item, e.g. "circuits[2]" or "wires[W3]".'),
  description: z
    .string()
    .describe(
      '1-4 plain-English sentences: what is non-compliant, the value from the design that shows it, and what the standard requires (paraphrased).',
    ),
});

const ComplianceReport = z.object({
  breaches: z.array(ComplianceBreach),
  not_checked: z
    .array(z.string())
    .describe('Short notes on checks that could not be made because the data needed was missing or unclear.'),
});

const INSTRUCTIONS = `You review New Zealand electrical designs for compliance with AS/NZS 3000:2018 (Wiring Rules) and AS/NZS 3008.1.2 (cable selection - NZ installation conditions).

You are given structured JSON extracted from uploaded project documents and, optionally, the contractor's own project drawing. You are also given the results of a deterministic rules engine that has already checked cable capacity against protection, voltage drop, RCD protection, minimum conductor size and circuit vs main switch ratings wherever the data allowed.

You are the second pass. Do NOT repeat any breach the rules engine already reported. Focus on:
- The checks the rules engine listed as not checked, where you can still reach a conclusion from other information in the documents (e.g. a rating shown in a note or diagram rather than a schedule).
- Things the rules engine does not cover: earthing and bonding, isolation and switching, switchboard arrangement and labelling, segregation, special locations (bathrooms, outdoor), and anything else the documents make clearly non-compliant.

Rules, in order of importance:
1. Only report a breach when the supplied data supports it. Quote the value that shows the problem (e.g. "a 32 A breaker on 1.5 mm² TPS"). Never invent values. Missing information is not a breach - list it in not_checked instead.
2. Write each description as 1-4 plain sentences for an electrician: what is wrong, the evidence, and what is required. Paraphrase the requirement - never reproduce the text of the standards.
3. Give a clause or table number only when you are confident it is correct; otherwise null.
4. severity: 'high' for safety issues (overloaded cable, missing RCD, missing earth), 'medium' for likely failures that need a design change (voltage drop, undersized cable at margin), 'low' for documentation or labelling gaps.
5. If nothing breaches, return an empty breaches array.`;

// Keeps the request within a sensible size if many large documents were uploaded.
const MAX_INPUT_CHARS = 300_000;

export async function checkComplianceAI(
  documents: unknown[],
  design: unknown | null,
  ruleResult: ComplianceResult,
): Promise<Breach[]> {
  const payload = JSON.stringify(
    { documents, project_drawing: design, rules_engine_result: ruleResult },
    null,
    1,
  );
  if (payload.length > MAX_INPUT_CHARS) {
    throw new Error('too much extracted data to check in one pass - upload fewer documents at a time');
  }

  const stream = getOpenAI().responses.stream({
    model: COMPLIANCE_MODEL,
    instructions: INSTRUCTIONS,
    max_output_tokens: 16000,
    input: [{ role: 'user', content: [{ type: 'input_text', text: payload }] }],
    text: { format: zodTextFormat(ComplianceReport, 'compliance_report') },
  });

  const response = await stream.finalResponse();

  if (!response.output_parsed) {
    const refusal = refusalReason(response.output);
    throw new Error(
      refusal
        ? `compliance check refused: ${refusal}`
        : `compliance check returned no parsable structured output (status: ${response.status})`,
    );
  }

  // Drop anything the rules already reported for the same item and standard.
  const ruleKeys = new Set(ruleResult.breaches.map((b) => `${b.source}|${b.item_ref}|${b.standard}`));
  return response.output_parsed.breaches
    .filter((b) => !ruleKeys.has(`${b.source}|${b.item_ref}|${b.standard}`))
    .map((b) => ({ ...b, method: 'ai' as const }));
}
