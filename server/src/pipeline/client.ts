import OpenAI from 'openai';

let client: OpenAI | null = null;

/**
 * Lazily constructed so importing this module (e.g. from the Express server) doesn't
 * require OPENAI_API_KEY until a pipeline run is actually requested.
 */
export function getOpenAI(): OpenAI {
  if (!client) client = new OpenAI();
  return client;
}

/** Cheap/efficient model for the noise-filter pass - triage doesn't need the flagship tier. Override via env if needed. */
export const CLASSIFY_MODEL = process.env.OPENAI_CLASSIFY_MODEL || 'gpt-6-luna';

/** Flagship model for structured extraction - this is where wrong output costs the most downstream. */
export const EXTRACT_MODEL = process.env.OPENAI_EXTRACT_MODEL || 'gpt-6-astra';

/** Compliance review against AS/NZS 3000 / 3008.1.2 - reasoning-heavy, so defaults to the flagship tier. */
export const COMPLIANCE_MODEL = process.env.OPENAI_COMPLIANCE_MODEL || EXTRACT_MODEL;

/** Wiring plan synthesis reads the same extracted facts extraction was trusted with - same tier by default. */
export const PLAN_MODEL = process.env.OPENAI_PLAN_MODEL || EXTRACT_MODEL;

/** Pulls the model's stated refusal reason out of a Responses API output array, if present. */
export function refusalReason(output: unknown): string | null {
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (item && typeof item === 'object' && 'content' in item) {
      const content = (item as { content?: unknown }).content;
      if (Array.isArray(content)) {
        const refusal = content.find(
          (c) => c && typeof c === 'object' && (c as { type?: unknown }).type === 'refusal',
        ) as { refusal?: string } | undefined;
        if (refusal) return refusal.refusal ?? 'refused';
      }
    }
  }
  return null;
}
