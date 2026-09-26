import { COMPONENTS } from '../data/catalogue'
import type { ComponentKind, Drawing } from '../types/drawing'
import { wireLengthM } from './materials'

export interface ComplianceBreach {
  standard: 'AS/NZS 3000' | 'AS/NZS 3008.1.2'
  clause: string | null
  severity: 'high' | 'medium' | 'low'
  source: string
  item_ref: string
  description: string
  /** 'rule' = deterministic check with the working shown; 'ai' = model judgement for review. */
  method: 'rule' | 'ai'
}

export interface ComplianceReport {
  breaches: ComplianceBreach[]
  not_checked: string[]
  ai_ran: boolean
}

const SOCKET_KINDS: ComponentKind[] = ['socket', 'double-socket']
const LIGHTING_KINDS: ComponentKind[] = ['light', 'downlight', 'switch', 'two-way-switch']

// Compact view of the project drawing for the compliance check.
export function summariseDrawing(drawing: Drawing) {
  const byId = new Map(drawing.components.map((c) => [c.id, c]))
  const describe = (id?: string) => {
    const c = id ? byId.get(id) : undefined
    return c ? `${c.label} (${COMPONENTS[c.kind].name})` : 'unconnected'
  }
  return {
    components: drawing.components.map((c) => ({
      label: c.label,
      type: COMPONENTS[c.kind].name,
      circuit: c.circuit ?? null,
    })),
    wires: drawing.wires.map((w, i) => {
      const length = wireLengthM(w, drawing)
      const kinds = [w.fromId, w.toId].flatMap((id) => (id && byId.get(id) ? [byId.get(id)!.kind] : []))
      return {
        ref: `W${i + 1}`,
        from: describe(w.fromId),
        to: describe(w.toId),
        cable_type: w.cableType,
        size_mm2: w.sizeMm2,
        voltage_v: w.voltage,
        protection_a: w.protectionA ?? null,
        load_type: kinds.some((k) => SOCKET_KINDS.includes(k))
          ? 'socket-outlets'
          : kinds.some((k) => LIGHTING_KINDS.includes(k))
            ? 'lighting'
            : null,
        length_m: length === undefined ? null : Math.round(length * 10) / 10,
        circuit: w.circuit ?? null,
      }
    }),
  }
}

export function hasDesign(drawing: Drawing) {
  return drawing.wires.length > 0
}

/**
 * Checks the project's stored document extractions (loaded server-side), any extra extracted
 * JSON not saved to the database (e.g. Quick Pipeline results), and the drawing.
 * Rules-only checks are free and instant; `ai` adds the token-costing AI second pass.
 */
export async function requestComplianceCheck(
  projectId: string,
  drawing: Drawing,
  extraDocuments: unknown[],
  { ai = false }: { ai?: boolean } = {},
): Promise<ComplianceReport> {
  const res = await fetch(`/api/pipeline/compliance${ai ? '?ai=1' : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      documents: extraDocuments,
      design: hasDesign(drawing) ? summariseDrawing(drawing) : null,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error ?? `request failed (${res.status})`)
  return body as ComplianceReport
}
