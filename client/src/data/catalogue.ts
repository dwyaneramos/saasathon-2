import type { CableSize, CableType, ComponentKind, Voltage } from '../types/drawing'

// Mock NZD prices for demo purposes only — not sourced from a supplier.

export interface ComponentSpec {
  name: string
  shortName: string
  unitPrice: number
}

export const COMPONENTS: Record<ComponentKind, ComponentSpec> = {
  socket: { name: 'Single power outlet', shortName: 'Socket', unitPrice: 14 },
  'double-socket': { name: 'Double power outlet', shortName: 'Double', unitPrice: 22 },
  switch: { name: 'Light switch (1-way)', shortName: 'Switch', unitPrice: 12 },
  'two-way-switch': { name: 'Light switch (2-way)', shortName: '2-way', unitPrice: 16 },
  light: { name: 'Ceiling light fitting', shortName: 'Light', unitPrice: 45 },
  downlight: { name: 'LED downlight', shortName: 'Downlight', unitPrice: 28 },
  switchboard: { name: 'Distribution board', shortName: 'Board', unitPrice: 420 },
  'junction-box': { name: 'Junction box', shortName: 'J-box', unitPrice: 9 },
}

export const COMPONENT_KINDS = Object.keys(COMPONENTS) as ComponentKind[]

export const CABLE_TYPES: CableType[] = ['TPS 2C+E', 'TPS 3C+E', 'Flex 3C']
export const CABLE_SIZES: CableSize[] = [1, 1.5, 2.5, 4, 6, 10]
export const VOLTAGES: Voltage[] = [230, 400]

const PRICE_PER_METRE_BY_SIZE: Record<CableSize, number> = {
  1: 1.6,
  1.5: 2.1,
  2.5: 3.2,
  4: 5.1,
  6: 7.4,
  10: 12.5,
}

const CABLE_TYPE_MULTIPLIER: Record<CableType, number> = {
  'TPS 2C+E': 1,
  'TPS 3C+E': 1.35,
  'Flex 3C': 1.2,
}

export function cablePricePerMetre(type: CableType, size: CableSize): number {
  return Math.round(PRICE_PER_METRE_BY_SIZE[size] * CABLE_TYPE_MULTIPLIER[type] * 100) / 100
}

// Extra cable allowed for drops, terminations and waste.
export const CABLE_ALLOWANCE = 0.1

export const DEFAULT_WIRE = {
  cableType: 'TPS 2C+E' as CableType,
  sizeMm2: 2.5 as CableSize,
  voltage: 230 as Voltage,
}
