/**
 * INDICATIVE PLACEHOLDER VALUES - NOT COPIED FROM AS/NZS 3008.1.2.
 *
 * Rough figures for copper TPS (flat twin & earth) cable, unenclosed in air, 2 loaded
 * conductors, no derating for grouping, thermal insulation or ambient temperature.
 * They exist so the rules engine can run for a demo. Before any real use, replace them
 * with the figures from a licensed copy of AS/NZS 3008.1.2 for each installation method.
 * This is the only file that needs to change when that happens.
 */

export const TABLES_ARE_INDICATIVE = true;

/** Current-carrying capacity (A) by conductor size (mm²). */
export const CURRENT_CAPACITY_A: Record<number, number> = {
  1: 15,
  1.5: 20,
  2.5: 27,
  4: 36,
  6: 46,
  10: 63,
  16: 85,
};

/** Single-phase voltage drop (mV per amp per metre) by conductor size (mm²). */
export const MV_PER_A_M_SINGLE_PHASE: Record<number, number> = {
  1: 44,
  1.5: 29,
  2.5: 18,
  4: 11,
  6: 7.3,
  10: 4.4,
  16: 2.8,
};

/** Balanced three-phase mV/A/m is roughly √3/2 of the single-phase figure. */
export const THREE_PHASE_FACTOR = Math.sqrt(3) / 2;

/** Wiring Rules limit on voltage drop from the point of supply, as a fraction of nominal voltage. */
export const MAX_VOLTAGE_DROP_FRACTION = 0.05;

/** Minimum copper conductor size (mm²) we accept per load type. Our own conservative defaults. */
export const MIN_SIZE_MM2: Record<'lighting' | 'socket-outlets' | 'other', number> = {
  lighting: 1,
  'socket-outlets': 1.5,
  other: 1,
};
