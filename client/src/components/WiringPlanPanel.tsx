import { useEffect, useState } from 'react'

type PlanConfidence = 'low' | 'medium' | 'high'

interface WiringPlanItem {
  description: string
  quantity: string | null
  confidence: PlanConfidence
  reason: string
  needs_info: string | null
  sources: { doc_id: string; item_ref: string }[]
}

interface WiringPlanRow {
  id: string
  project_id: string
  generated_at: string
  items: WiringPlanItem[]
}

const CONFIDENCE_STYLE: Record<PlanConfidence, string> = {
  high: 'bg-green-600/15 text-green-800',
  medium: 'bg-[#FFCC00]/30 text-[#1a1a1a]',
  low: 'bg-[#E3350D]/15 text-[#E3350D]',
}

const CONFIDENCE_ORDER: Record<PlanConfidence, number> = { low: 0, medium: 1, high: 2 }

interface WiringPlanPanelProps {
  projectId: string
  hasExtractedDocuments: boolean
}

function WiringPlanPanel({ projectId, hasExtractedDocuments }: WiringPlanPanelProps) {
  const [plan, setPlan] = useState<WiringPlanRow | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/projects/${projectId}/wiring-plan`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setPlan(body.plan)
      })
      .catch(() => {
        /* no plan yet is not an error the user needs to see on load */
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/wiring-plan`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? `request failed (${res.status})`)
      setPlan(body as WiringPlanRow)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  const sortedItems = plan
    ? [...plan.items].sort((a, b) => CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence])
    : []

  return (
    <div className="flex flex-col gap-4 border-t border-black/10 pt-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-[DM_Sans] text-lg font-semibold uppercase tracking-wide text-[#1a1a1a]">
          Wiring Plan
        </h2>
        <button
          type="button"
          onClick={generate}
          disabled={!hasExtractedDocuments || generating}
          className="rounded-full bg-[#FFCC00] px-5 py-2 font-[DM_Sans] text-sm font-semibold uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-[#E3350D] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generating ? 'Generating…' : plan ? 'Regenerate Plan' : 'Generate Wiring Plan'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-[#E3350D]/30 bg-[#E3350D]/5 p-4 font-[DM_Sans] text-sm text-[#E3350D]">
          {error}
        </p>
      )}

      {!hasExtractedDocuments && !plan && (
        <p className="font-[DM_Sans] text-sm text-black/50">
          Upload and extract at least one document before generating a plan.
        </p>
      )}

      {plan && (
        <div className="flex flex-col gap-3">
          <p className="font-[DM_Sans] text-xs uppercase tracking-wide text-black/50">
            Generated {new Date(plan.generated_at).toLocaleString()}
          </p>
          {sortedItems.map((item, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-black/10 bg-black/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-[DM_Sans] text-sm font-semibold text-[#1a1a1a]">
                  {item.description}
                  {item.quantity && ` — ${item.quantity}`}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-[DM_Sans] text-xs font-semibold uppercase ${CONFIDENCE_STYLE[item.confidence]}`}
                >
                  {item.confidence}
                </span>
              </div>
              <p className="font-[DM_Sans] text-sm text-[#1a1a1a]/80">{item.reason}</p>
              {item.needs_info && (
                <p className="font-[DM_Sans] text-sm text-[#E3350D]">Needs info: {item.needs_info}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WiringPlanPanel
