import { CABLE_SIZES, cablePricePerMetre } from '../data/catalogue'
import type { CableSize, CableType } from '../types/drawing'

// Extracted documents state a cable's mm² but essentially never its conductor count
// (2C+E vs 3C+E) - most residential lighting/power circuits are 2C+E, so that's the
// only reasonable default here. This is a rough catalogue estimate, not a quote.
const DEFAULT_CABLE_TYPE: CableType = 'TPS 2C+E'

function parseCableSizeMm2(text: string): CableSize | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*mm/i)
  if (!match) return null
  const value = Number(match[1])
  return (CABLE_SIZES as number[]).includes(value) ? (value as CableSize) : null
}

function parseLengthMetres(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*m(?:etre)?s?\b/i)
  return match ? Number(match[1]) : null
}

export interface CatalogueEstimate {
  pricePerMetre: number
  lengthM: number
  total: number
}

/**
 * Best-effort catalogue estimate from an item's free-text description + quantity -
 * only when both a recognised cable size and a numeric length can be parsed out.
 * Purely deterministic (catalogue rate × parsed length), never an AI guess, and
 * never used when a source document already states a real price for the item.
 */
export function estimateFromCatalogue(description: string, quantity: string | null): CatalogueEstimate | null {
  if (!quantity) return null
  const sizeMm2 = parseCableSizeMm2(description) ?? parseCableSizeMm2(quantity)
  const lengthM = parseLengthMetres(quantity)
  if (sizeMm2 == null || lengthM == null) return null

  const pricePerMetre = cablePricePerMetre(DEFAULT_CABLE_TYPE, sizeMm2)
  return { pricePerMetre, lengthM, total: Math.round(pricePerMetre * lengthM * 100) / 100 }
}
