/**
 * Builds a cable schedule from a project's extracted documents. Deterministic: every value
 * is copied from a source document (cable schedule rows, circuits, switchboards) - nothing
 * is sized, calculated or guessed. Gaps, estimates and disagreements between documents are
 * flagged on the row so the designer can resolve them before sign-off.
 */
import type { ExtractionDocument, Field } from './schema.js';

/** Below this, a value is treated as needing a human check. Matches validate.ts. */
const LOW_CONFIDENCE = 0.6;

export interface CableScheduleEntry {
  ref: string;
  circuit: string | null;
  description: string | null;
  from: string | null;
  to: string | null;
  /** Exactly as printed on the source document. */
  cableType: string | null;
  /** Conductor size read out of the printed cable type, e.g. "TPS 2.5mm2" -> 2.5. */
  sizeMm2: number | null;
  lengthM: number | null;
  /** True when the length was scaled off a drawing rather than printed. */
  lengthEstimated: boolean;
  protectionA: number | null;
  phase: '1' | '2' | '3' | null;
  sourceFile: string;
  /** Required fields that no document states. */
  missing: string[];
  /** Human-readable reasons to double-check this row (estimates, low confidence, conflicts). */
  verify: string[];
}

type AnyField = Field<unknown> | null | undefined;

const value = <T>(f: Field<T> | null | undefined): T | null => f?.value ?? null;
const text = (f: Field<string> | null | undefined): string | null => {
  const v = value(f);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const isEstimate = (f: AnyField) => !!f && f.value != null && f.provenance !== 'extracted';
const isLowConfidence = (f: AnyField) => !!f && f.value != null && f.confidence < LOW_CONFIDENCE;

/** "TPS 2.5mm2", "2.5 mm²", "4mm TPS" -> 2.5 / 4. Null when no size is printed. */
export function parseCableSize(cableType: string | null): number | null {
  if (!cableType) return null;
  const match = cableType.match(/(\d+(?:\.\d+)?)\s*(?:mm\s*(?:2|²|sq)?|sq\s*mm)/i);
  return match ? Number.parseFloat(match[1]!) : null;
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function entriesForDoc(doc: ExtractionDocument): CableScheduleEntry[] {
  const circuits = doc.circuits ?? [];
  const cables = doc.cable_schedule_rows ?? [];
  const usedCircuits = new Set<number>();
  const entries: CableScheduleEntry[] = [];

  const findCircuit = (ids: (string | null)[]) =>
    circuits.findIndex((c) => {
      const id = text(c.circuit_id);
      return id !== null && ids.includes(id);
    });

  const build = (
    cable: (typeof cables)[number] | null,
    circuit: (typeof circuits)[number] | null,
    fallbackRef: string,
  ): CableScheduleEntry => {
    const cableType = cable ? text(cable.cable_type) : null;
    const lengthField = (cable && cable.length_m?.value != null ? cable.length_m : circuit?.length_m) ?? null;
    const used: [string, AnyField][] = [
      ['cable type', cable?.cable_type],
      ['length', lengthField],
      ['protection rating', circuit?.rated_current_a],
      ['from', cable?.from_ref ?? circuit?.switchboard_ref],
      ['to', cable?.to_ref],
    ];

    const entry: CableScheduleEntry = {
      ref: (cable && text(cable.cable_id)) ?? (circuit && text(circuit.circuit_id)) ?? fallbackRef,
      circuit: circuit ? text(circuit.circuit_id) : null,
      description: circuit ? text(circuit.description) ?? text(circuit.load_type) : cable ? text(cable.notes) : null,
      from: (cable && text(cable.from_ref)) ?? (circuit && text(circuit.switchboard_ref)),
      to: cable ? text(cable.to_ref) : null,
      cableType,
      sizeMm2: parseCableSize(cableType),
      lengthM: value(lengthField),
      lengthEstimated: isEstimate(lengthField),
      protectionA: circuit ? value(circuit.rated_current_a) : null,
      phase: circuit ? value(circuit.phase) : null,
      sourceFile: doc.source_file,
      missing: [],
      verify: [],
    };

    if (!entry.from) entry.missing.push('from');
    if (!entry.to) entry.missing.push('to');
    if (!entry.cableType) entry.missing.push('cable type');
    else if (entry.sizeMm2 === null) entry.missing.push('conductor size');
    if (entry.lengthM === null) entry.missing.push('length');
    if (entry.protectionA === null) entry.missing.push('protection rating');

    if (entry.lengthEstimated) entry.verify.push('length scaled from the drawing, not printed');
    for (const [name, f] of used) {
      if (isLowConfidence(f)) entry.verify.push(`${name} was hard to read (low confidence)`);
      else if (name !== 'length' && isEstimate(f)) entry.verify.push(`${name} was inferred, not printed`);
    }
    return entry;
  };

  cables.forEach((cable, i) => {
    const index = findCircuit([text(cable.cable_id), text(cable.from_ref), text(cable.to_ref)]);
    if (index >= 0) usedCircuits.add(index);
    entries.push(build(cable, index >= 0 ? circuits[index]! : null, `Cable ${i + 1}`));
  });

  // Circuits with no cable schedule row still need a cable (e.g. read off a layout plan).
  circuits.forEach((circuit, i) => {
    if (!usedCircuits.has(i)) entries.push(build(null, circuit, `Circuit ${i + 1}`));
  });

  return entries;
}

export function buildCableSchedule(docs: ExtractionDocument[]): CableScheduleEntry[] {
  const entries = docs.flatMap(entriesForDoc);

  // Flag the same cable described differently by two documents, rather than picking one.
  const byRef = new Map<string, CableScheduleEntry[]>();
  for (const e of entries) byRef.set(e.ref.toLowerCase(), [...(byRef.get(e.ref.toLowerCase()) ?? []), e]);
  for (const group of byRef.values()) {
    for (const e of group) {
      for (const other of group) {
        if (other === e) continue;
        const diffs = (
          [
            ['cable type', e.cableType, other.cableType],
            ['length', e.lengthM, other.lengthM],
            ['protection rating', e.protectionA, other.protectionA],
          ] as const
        )
          .filter(([, a, b]) => a !== null && b !== null && a !== b)
          .map(([name]) => name);
        if (diffs.length > 0) e.verify.push(`${diffs.join(', ')} differs in ${other.sourceFile}`);
      }
    }
  }

  return entries.sort((a, b) => naturalCompare(a.ref, b.ref) || naturalCompare(a.sourceFile, b.sourceFile));
}
