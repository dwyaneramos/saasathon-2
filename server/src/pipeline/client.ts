import OpenAI from 'openai';
import type { Response } from 'openai/resources/responses/responses';

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

/** Human-readable reason a Responses API call didn't finish, if the response reports one. */
export function incompleteReason(response: Response): string | null {
  const reason = response.incomplete_details?.reason;
  if (!reason) return null;
  if (reason === 'max_output_tokens') return 'hit the max_output_tokens limit before finishing - document is likely too large/detailed for a single pass';
  return reason;
}
