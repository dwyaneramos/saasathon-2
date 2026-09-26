import { useEffect, useRef, useState } from 'react'
import type { Drawing } from '../types/drawing'
import { requestComplianceCheck, type ComplianceBreach, type ComplianceReport } from './compliance'

export interface ComplianceState {
  /** Latest deterministic rule check. Re-runs automatically, so it is always current. */
  rules: ComplianceReport | null
  /** Findings from the last AI review, kept until the next one is requested. */
  aiBreaches: ComplianceBreach[] | null
  aiCheckedAt: Date | null
  checking: 'rules' | 'ai' | null
  error: string | null
}

const INITIAL: ComplianceState = { rules: null, aiBreaches: null, aiCheckedAt: null, checking: null, error: null }

// Rule checks are free, so they re-run shortly after every drawing edit.
const RULE_CHECK_DELAY_MS = 500

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

/**
 * `documentsVersion` should change whenever the project's documents change, so the
 * stored extractions are re-checked. `extraDocuments` is extracted JSON that isn't saved
 * to the database (Quick Pipeline results) and is sent along with each check.
 */
export function useCompliance(
  drawing: Drawing,
  projectId: string,
  documentsVersion: number,
  extraDocuments: unknown[],
) {
  const [state, setState] = useState<ComplianceState>(INITIAL)
  const latestRules = useRef(0)
  const latestAi = useRef(0)

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const id = ++latestRules.current
      setState((s) => ({ ...s, checking: s.checking ?? 'rules' }))
      try {
        const rules = await requestComplianceCheck(projectId, drawing, extraDocuments)
        if (id !== latestRules.current) return
        setState((s) => ({ ...s, rules, error: null, checking: s.checking === 'rules' ? null : s.checking }))
      } catch (err) {
        if (id !== latestRules.current) return
        setState((s) => ({ ...s, error: message(err), checking: s.checking === 'rules' ? null : s.checking }))
      }
    }, RULE_CHECK_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [drawing, projectId, documentsVersion, extraDocuments])

  async function askAi() {
    const id = ++latestAi.current
    setState((s) => ({ ...s, checking: 'ai', error: null }))
    try {
      const report = await requestComplianceCheck(projectId, drawing, extraDocuments, { ai: true })
      if (id !== latestAi.current) return
      setState((s) => ({
        ...s,
        aiBreaches: report.breaches.filter((b) => b.method === 'ai'),
        aiCheckedAt: new Date(),
        checking: null,
      }))
    } catch (err) {
      if (id !== latestAi.current) return
      setState((s) => ({ ...s, error: `AI review failed: ${message(err)}`, checking: null }))
    }
  }

  return { state, askAi }
}
