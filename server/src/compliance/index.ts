import { checkComplianceAI } from './ai.js';
import { normalise } from './normalise.js';
import { runRules } from './rules.js';
import type { ComplianceResult } from './types.js';

export type { Breach, ComplianceResult } from './types.js';

/**
 * Deterministic rules always run (free, instant, reproducible). The AI pass is opt-in and
 * only adds findings the rules couldn't make.
 */
export async function checkCompliance(
  documents: unknown[],
  design: unknown | null,
  options: { ai: boolean },
): Promise<ComplianceResult & { ai_ran: boolean }> {
  const ruleResult = runRules(normalise(documents, design));
  if (!options.ai) return { ...ruleResult, ai_ran: false };

  const aiBreaches = await checkComplianceAI(documents, design, ruleResult);
  return { ...ruleResult, breaches: [...ruleResult.breaches, ...aiBreaches], ai_ran: true };
}
