import { CABLE_ALLOWANCE, COMPONENTS, cablePricePerMetre } from '../data/catalogue'
import type { Drawing, PlacedComponent, Point, Wire } from '../types/drawing'

export interface MaterialLine {
  key: string
  name: string
  qty: number
  unit: 'ea' | 'm'
  unitPrice: number
  subtotal: number
}

export interface MaterialsSummary {
  lines: MaterialLine[]
  cableMetres: number
  componentCount: number
  total: number
  unmeasuredWires: number
}

// Full polyline of a wire: connected component centres plus its bend points.
export function wirePath(wire: Wire, components: PlacedComponent[]): Point[] {
  const from = wire.fromId ? components.find((c) => c.id === wire.fromId) : undefined
  const to = wire.toId ? components.find((c) => c.id === wire.toId) : undefined
  return [...(from ? [{ x: from.x, y: from.y }] : []), ...wire.points, ...(to ? [{ x: to.x, y: to.y }] : [])]
}

export function pathLengthPx(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return total
}

// Measured length in metres, before allowance. Undefined if the drawing has no scale and no override.
export function wireLengthM(wire: Wire, drawing: Drawing): number | undefined {
  if (wire.lengthOverrideM !== undefined) return wire.lengthOverrideM
  if (!drawing.metresPerPx) return undefined
  return pathLengthPx(wirePath(wire, drawing.components)) * drawing.metresPerPx
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeMaterials(drawing: Drawing): MaterialsSummary {
  const lines: MaterialLine[] = []

  const componentCounts = new Map<string, number>()
  for (const c of drawing.components) {
    componentCounts.set(c.kind, (componentCounts.get(c.kind) ?? 0) + 1)
  }
  for (const [kind, qty] of componentCounts) {
    const spec = COMPONENTS[kind as PlacedComponent['kind']]
    lines.push({
      key: kind,
      name: spec.name,
      qty,
      unit: 'ea',
      unitPrice: spec.unitPrice,
      subtotal: round2(qty * spec.unitPrice),
    })
  }

  const cableMetresByKey = new Map<string, { wire: Wire; metres: number }>()
  let unmeasuredWires = 0
  for (const wire of drawing.wires) {
    const length = wireLengthM(wire, drawing)
    if (length === undefined) {
      unmeasuredWires++
      continue
    }
    const key = `${wire.cableType}|${wire.sizeMm2}`
    const entry = cableMetresByKey.get(key)
    const metres = length * (1 + CABLE_ALLOWANCE)
    if (entry) entry.metres += metres
    else cableMetresByKey.set(key, { wire, metres })
  }

  let cableMetres = 0
  for (const [key, { wire, metres }] of cableMetresByKey) {
    const qty = Math.ceil(metres)
    const unitPrice = cablePricePerMetre(wire.cableType, wire.sizeMm2)
    cableMetres += qty
    lines.push({
      key,
      name: `${wire.cableType} ${wire.sizeMm2} mm²`,
      qty,
      unit: 'm',
      unitPrice,
      subtotal: round2(qty * unitPrice),
    })
  }

  return {
    lines,
    cableMetres,
    componentCount: drawing.components.length,
    total: round2(lines.reduce((sum, l) => sum + l.subtotal, 0)),
    unmeasuredWires,
  }
}
