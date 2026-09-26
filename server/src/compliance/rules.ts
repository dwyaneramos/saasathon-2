import { parseCableSize, type CircuitCheckInput } from './normalise.js';
import {
  CURRENT_CAPACITY_A,
  MAX_VOLTAGE_DROP_FRACTION,
  MIN_SIZE_MM2,
  MV_PER_A_M_SINGLE_PHASE,
  THREE_PHASE_FACTOR,
} from './tables.js';
import type { Breach, ComplianceResult } from './types.js';

type RuleOutcome = { breach: Breach } | { notChecked: string } | null;
type Rule = (c: CircuitCheckInput) => RuleOutcome;

const fmt = (n: number, dp = 1) => Number(n.toFixed(dp)).toString();
const cableName = (c: CircuitCheckInput) =>
  c.cableType && parseCableSize(c.cableType) !== null
    ? c.cableType
    : `${c.cableSizeMm2} mm² ${c.cableType ?? 'cable'}`;

function breach(c: CircuitCheckInput, fields: Omit<Breach, 'source' | 'item_ref' | 'method'>): RuleOutcome {
  return { breach: { ...fields, source: c.source, item_ref: c.ref, method: 'rule' } };
}

/** Cable current-carrying capacity must be at least the protective device rating. */
const cableCapacity: Rule = (c) => {
  if (c.protectionA === null || c.cableSizeMm2 === null) {
    return { notChecked: 'Cable capacity vs protection: needs both breaker rating and cable size' };
  }
  const capacity = CURRENT_CAPACITY_A[c.cableSizeMm2];
  if (capacity === undefined) return { notChecked: `Cable capacity: no table value for ${c.cableSizeMm2} mm²` };
  if (capacity >= c.protectionA) return null;
  return breach(c, {
    standard: 'AS/NZS 3008.1.2',
    clause: null,
    severity: 'high',
    description:
      `${c.label} is protected by a ${c.protectionA} A device but uses ${cableName(c)}, rated about ${capacity} A ` +
      `in this installation (indicative value). The cable's current-carrying capacity must be at least the ` +
      `protective device rating, so upsize the cable or reduce the breaker.`,
  });
};

/** Voltage drop at the protective device rating must stay within 5% of nominal voltage. */
const voltageDrop: Rule = (c) => {
  if (c.protectionA === null || c.cableSizeMm2 === null || c.lengthM === null) {
    return { notChecked: 'Voltage drop: needs breaker rating, cable size and run length' };
  }
  const mvam = MV_PER_A_M_SINGLE_PHASE[c.cableSizeMm2];
  if (mvam === undefined) return { notChecked: `Voltage drop: no table value for ${c.cableSizeMm2} mm²` };
  const drop = (c.lengthM * c.protectionA * mvam * (c.phases === 3 ? THREE_PHASE_FACTOR : 1)) / 1000;
  const limit = c.voltage * MAX_VOLTAGE_DROP_FRACTION;
  if (drop <= limit) return null;
  return breach(c, {
    standard: 'AS/NZS 3000',
    clause: '3.6.2',
    severity: 'medium',
    description:
      `${c.label} runs ${fmt(c.lengthM)} m of ${c.cableSizeMm2} mm² cable, giving about ${fmt(drop)} V ` +
      `(${fmt((drop / c.voltage) * 100)}%) drop at its ${c.protectionA} A rating. The limit is ` +
      `${fmt(limit)} V (5% of ${c.voltage} V) from the point of supply, so a larger cable or shorter route is needed.`,
  });
};

/** Final subcircuits supplying socket-outlets or lighting need RCD protection. */
const rcdProtection: Rule = (c) => {
  if (c.loadType !== 'socket-outlets' && c.loadType !== 'lighting') return null;
  if (c.rcd === null) return { notChecked: 'RCD protection: not recorded' };
  if (c.rcd) return null;
  return breach(c, {
    standard: 'AS/NZS 3000',
    clause: '2.6.3',
    severity: 'high',
    description:
      `${c.label} supplies ${c.loadType === 'lighting' ? 'lighting' : 'socket-outlets'} with no RCD shown. ` +
      `These final subcircuits need additional protection by an RCD of 30 mA or less.`,
  });
};

/** Conductor size must meet the minimum for the type of circuit. */
const minimumSize: Rule = (c) => {
  if (c.cableSizeMm2 === null) return { notChecked: 'Minimum conductor size: cable size unknown' };
  const min = MIN_SIZE_MM2[c.loadType ?? 'other'];
  if (c.cableSizeMm2 >= min) return null;
  return breach(c, {
    standard: 'AS/NZS 3000',
    clause: null,
    severity: 'high',
    description:
      `${c.label} uses ${c.cableSizeMm2} mm² conductors, below the ${min} mm² minimum for ` +
      `${c.loadType === 'socket-outlets' ? 'socket-outlet circuits' : 'this type of circuit'}.`,
  });
};

/** A circuit's protection can't be rated above the board's main switch. */
const mainSwitch: Rule = (c) => {
  if (c.protectionA === null || c.mainSwitchA === null) return null;
  if (c.protectionA <= c.mainSwitchA) return null;
  return breach(c, {
    standard: 'AS/NZS 3000',
    clause: null,
    severity: 'medium',
    description:
      `${c.label} is rated ${c.protectionA} A, above its board's ${c.mainSwitchA} A main switch. ` +
      `The circuit and main switch ratings are inconsistent and need to be checked against the design.`,
  });
};

const RULES: Rule[] = [cableCapacity, voltageDrop, rcdProtection, minimumSize, mainSwitch];

// Short references for "not checked" notes, e.g. "W1" or "C3".
function shortRef(c: CircuitCheckInput): string {
  const match = c.ref.match(/\[(.+)\]$/);
  return c.source === 'Project drawing' ? (match?.[1] ?? c.ref) : `${c.source} ${c.ref}`;
}

export function runRules(circuits: CircuitCheckInput[]): ComplianceResult {
  const breaches: Breach[] = [];
  const notChecked = new Map<string, string[]>();

  for (const circuit of circuits) {
    for (const rule of RULES) {
      const outcome = rule(circuit);
      if (!outcome) continue;
      if ('breach' in outcome) breaches.push(outcome.breach);
      else notChecked.set(outcome.notChecked, [...(notChecked.get(outcome.notChecked) ?? []), shortRef(circuit)]);
    }
  }

  return {
    breaches,
    not_checked: [...notChecked].map(([reason, refs]) => `${reason} (${refs.join(', ')})`),
  };
}
