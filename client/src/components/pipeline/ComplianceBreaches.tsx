import type { ComplianceBreach } from '../../lib/compliance'
import type { ComplianceState } from '../../lib/useCompliance'

interface ComplianceBreachesProps {
  state: ComplianceState
  /** Undefined when there is nothing to check yet. */
  onAskAi?: () => void
}

const SEVERITY_ORDER: Record<ComplianceBreach['severity'], number> = { high: 0, medium: 1, low: 2 }

const SEVERITY_STYLE: Record<ComplianceBreach['severity'], string> = {
  high: 'bg-[#E3350D] text-white',
  medium: 'bg-[#FFCC00] text-[#1a1a1a]',
  low: 'bg-black/10 text-[#1a1a1a]',
}

const METHOD_STYLE: Record<ComplianceBreach['method'], string> = {
  rule: 'border-[#1a1a1a] text-[#1a1a1a]',
  ai: 'border-[#1f5fbf] text-[#1f5fbf]',
}

function ComplianceBreaches({ state, onAskAi }: ComplianceBreachesProps) {
  const breaches = [...(state.rules?.breaches ?? []), ...(state.aiBreaches ?? [])].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.method === b.method ? 0 : a.method === 'rule' ? -1 : 1),
  )

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-black/10 bg-black/[0.03] p-6 font-[DM_Sans]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Compliance: AS/NZS 3000 &amp; AS/NZS 3008.1.2</h2>
          <p className="text-xs text-black/50">
            Rule checks run automatically on the uploaded documents and the project drawing.
            {state.aiCheckedAt && ` AI review last run ${state.aiCheckedAt.toLocaleString()}.`}
          </p>
        </div>
        {onAskAi && (
          <button
            type="button"
            disabled={state.checking === 'ai'}
            onClick={onAskAi}
            className="rounded-full border-2 border-[#1a1a1a] px-4 py-1.5 text-xs font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-black/5 disabled:opacity-50"
          >
            {state.checking === 'ai' ? 'AI reviewing…' : state.aiCheckedAt ? 'Re-run AI review' : 'Ask AI for a deeper review'}
          </button>
        )}
      </div>

      {!state.rules && !state.checking && !state.error && (
        <p className="text-sm text-black/50">
          Draw cables on the project drawing, or upload a document in the Document pipeline tab, to check this
          project for compliance breaches.
        </p>
      )}

      {!state.rules && state.checking === 'rules' && <p className="text-sm text-black/60">Checking compliance…</p>}

      {state.error && (
        <p className="rounded-lg border border-[#E3350D]/30 bg-[#E3350D]/5 p-4 text-sm text-[#E3350D]">{state.error}</p>
      )}

      {state.rules && breaches.length === 0 && (
        <p className="text-sm text-[#1a7a3d]">No compliance breaches found in the data provided.</p>
      )}

      {breaches.length > 0 && (
        <>
          <p className="text-sm font-semibold text-[#E3350D]">
            {breaches.length} potential breach{breaches.length === 1 ? '' : 'es'} found
          </p>
          <ul className="flex list-disc flex-col gap-3 pl-5 text-sm leading-relaxed text-[#1a1a1a]">
            {breaches.map((b, i) => (
              <li key={`${b.method}-${b.source}-${b.item_ref}-${i}`}>
                <span
                  className={`mr-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_STYLE[b.severity]}`}
                >
                  {b.severity}
                </span>
                <span
                  title={b.method === 'rule' ? 'Deterministic rule check' : 'AI judgement - verify before relying on it'}
                  className={`mr-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${METHOD_STYLE[b.method]}`}
                >
                  {b.method === 'rule' ? 'Rule' : 'AI'}
                </span>
                <span className="font-semibold">
                  {b.standard}
                  {b.clause ? ` cl. ${b.clause}` : ''}
                </span>
                <span className="text-black/50"> · {b.source}</span>
                <span className="mt-1 block">{b.description}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-[10px] text-black/40">
        Rule checks use indicative cable tables, not licensed AS/NZS 3008.1.2 values. AI findings are judgements for
        review. A registered electrical engineer or inspector must confirm compliance before sign-off.
      </p>
    </section>
  )
}

export default ComplianceBreaches
