import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { estimateFromCatalogue } from '../lib/wiringPlanPricing'
import PulsingDot from './PulsingDot'

type PlanConfidence = 'low' | 'medium' | 'high'

interface WiringPlanItem {
  description: string
  quantity: string | null
  price: number | null
  confidence: PlanConfidence
  reason: string
  needs_info: string | null
  sources: { doc_id: string; item_ref: string }[]
}

const nzd = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' })

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

export interface WiringPlanPanelHandle {
  generate: () => void
}

interface WiringPlanPanelProps {
  projectId: string
  hasExtractedDocuments: boolean
}

const WiringPlanPanel = forwardRef<WiringPlanPanelHandle, WiringPlanPanelProps>(function WiringPlanPanel(
  { projectId, hasExtractedDocuments },
  ref,
) {
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

  useImperativeHandle(ref, () => ({ generate }))

  const sortedItems = plan
    ? [...plan.items].sort((a, b) => CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence])
    : []

  // Two distinct kinds of number, never blended: a stated quote price is a fact from a
  // source document; a catalogue estimate is our own deterministic rate x length guess,
  // only computed when no quote already prices the item.
  const quotedItems = sortedItems.filter((item) => item.price != null)
  const quotedTotal = quotedItems.reduce((sum, item) => sum + (item.price ?? 0), 0)
  const estimates = new Map(
    sortedItems
      .filter((item) => item.price == null)
      .map((item) => [item, estimateFromCatalogue(item.description, item.quantity)] as const)
      .filter((entry): entry is [WiringPlanItem, NonNullable<(typeof entry)[1]>] => entry[1] != null),
  )
  const estimatedTotal = [...estimates.values()].reduce((sum, est) => sum + est.total, 0)
  const uncostedCount = sortedItems.length - quotedItems.length - estimates.size

  return (
    <div className="flex flex-col gap-4 border-t border-black/10 pt-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-[DM_Sans] text-lg font-semibold uppercase tracking-wide text-[#1a1a1a]">
          Wiring Plan
        </h2>
        {generating && (
          <span className="flex items-center gap-2 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-black/50">
            <PulsingDot className="bg-[#E3350D]" />
            Generating…
          </span>
        )}
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
          <div className="flex flex-col gap-1">
            <p className="font-[DM_Sans] text-xs uppercase tracking-wide text-black/50">
              Generated {new Date(plan.generated_at).toLocaleString()}
            </p>
            {(quotedItems.length > 0 || estimates.size > 0) && (
              <p className="font-[DM_Sans] text-sm text-[#1a1a1a]">
                {quotedItems.length > 0 && (
                  <>
                    <span className="text-xs uppercase tracking-wide text-black/50">Quoted </span>
                    <span className="font-semibold">{nzd.format(quotedTotal)}</span>
                  </>
                )}
                {quotedItems.length > 0 && estimates.size > 0 && <span className="text-black/30"> · </span>}
                {estimates.size > 0 && (
                  <>
                    <span className="text-xs uppercase tracking-wide text-black/50">Catalogue estimate </span>
                    <span className="font-semibold text-[#1a1a1a]/70">~{nzd.format(estimatedTotal)}</span>
                  </>
                )}
                {uncostedCount > 0 && (
                  <span className="text-xs text-black/50">
                    {' '}
                    ({uncostedCount} item{uncostedCount === 1 ? '' : 's'} still uncosted)
                  </span>
                )}
              </p>
            )}
          </div>
          {sortedItems.map((item, i) => {
            const estimate = estimates.get(item)
            return (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-black/10 bg-black/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-[DM_Sans] text-sm font-semibold text-[#1a1a1a]">
                    {item.description}
                    {item.quantity && ` — ${item.quantity}`}
                    {item.price != null && ` · ${nzd.format(item.price)}`}
                    {item.price == null && estimate && (
                      <span className="font-normal text-[#1a1a1a]/60 italic"> · ~{nzd.format(estimate.total)} est.</span>
                    )}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-[DM_Sans] text-xs font-semibold uppercase ${CONFIDENCE_STYLE[item.confidence]}`}
                  >
                    {item.confidence}
                  </span>
                </div>
                <p className="font-[DM_Sans] text-sm text-[#1a1a1a]/80">{item.reason}</p>
                {item.price == null && estimate && (
                  <p className="font-[DM_Sans] text-xs text-black/50">
                    Catalogue estimate: {nzd.format(estimate.pricePerMetre)}/m × {estimate.lengthM}m (TPS 2C+E
                    assumed) — not a supplier quote.
                  </p>
                )}
                {item.needs_info && (
                  <p className="font-[DM_Sans] text-sm text-[#E3350D]">Needs info: {item.needs_info}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

export default WiringPlanPanel
