/**
 * Turns pipeline extractions and the project drawing into one flat list of circuits the
 * rules can check. Anything that can't be found is left null - the rules then report the
 * check as "not checked" rather than guessing.
 */

export type LoadType = 'lighting' | 'socket-outlets' | 'other';

export interface CircuitCheckInput {
  ref: string;
  source: string;
  label: string;
  loadType: LoadType | null;
  protectionA: number | null;
  rcd: boolean | null;
  cableSizeMm2: number | null;
  cableType: string | null;
  lengthM: number | null;
  phases: 1 | 3;
  voltage: number;
  mainSwitchA: number | null;
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Extracted fields are wrapped as { value, provenance, ... }; plain values are accepted too. */
function val(v: unknown): unknown {
  return isObj(v) && 'value' in v ? v.value : v;
}
function str(v: unknown): string | null {
  const x = val(v);
  return typeof x === 'string' && x.trim() ? x.trim() : typeof x === 'number' ? String(x) : null;
}
function num(v: unknown): number | null {
  const x = val(v);
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string') {
    const n = Number.parseFloat(x);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function bool(v: unknown): boolean | null {
  const x = val(v);
  if (typeof x === 'boolean') return x;
  if (typeof x === 'string') {
    if (/^(yes|true|rcd|rcbo)$/i.test(x.trim())) return true;
    if (/^(no|false|none)$/i.test(x.trim())) return false;
  }
  return null;
}

/** "TPS 2.5mm2", "2.5 mm²", "2C+E 4mm" -> 2.5 / 4. */
export function parseCableSize(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:mm\s*(?:2|²|sq)?|sq\s*mm)/i);
  return match ? Number.parseFloat(match[1]!) : null;
}

export function classifyLoad(...texts: (string | null | undefined)[]): LoadType | null {
  const t = texts.filter(Boolean).join(' ').toLowerCase();
  if (!t) return null;
  if (/socket|outlet|power|gpo|\bpo\b/.test(t)) return 'socket-outlets';
  if (/light|lighting|lamp|downlight/.test(t)) return 'lighting';
  return 'other';
}

function fromExtraction(doc: unknown, docIndex: number): CircuitCheckInput[] {
  if (!isObj(doc)) return [];
  const source = str(doc.source_file) ?? `document ${docIndex + 1}`;
  const boards = arr(doc.switchboards).filter(isObj);
  const cables = arr(doc.cable_schedule_rows).filter(isObj);

  return arr(doc.circuits)
    .filter(isObj)
    .map((circuit, i) => {
      const id = str(circuit.circuit_id);
      const boardRef = str(circuit.switchboard_ref);
      const board =
        boards.find((b) => boardRef && str(b.board_id) === boardRef) ?? (boards.length === 1 ? boards[0] : undefined);
      const cable = id
        ? cables.find((c) => [str(c.cable_id), str(c.from_ref), str(c.to_ref)].includes(id))
        : undefined;
      const cableType = cable ? str(cable.cable_type) : null;
      const phase = str(circuit.phase);
      const phases: 1 | 3 = phase === '3' ? 3 : 1;
      const description = str(circuit.description);

      return {
        ref: `circuits[${i}]`,
        source,
        label: id ? `Circuit ${id}${description ? ` (${description})` : ''}` : `Circuit ${i + 1}`,
        loadType: classifyLoad(str(circuit.load_type), description),
        protectionA: num(circuit.rated_current_a),
        rcd: bool(circuit.rcd_protected ?? circuit.rcd),
        cableSizeMm2: parseCableSize(cableType),
        cableType,
        lengthM: (cable ? num(cable.length_m) : null) ?? num(circuit.length_m),
        phases,
        voltage: phases === 3 ? 400 : 230,
        mainSwitchA: board ? num(board.main_switch_rating_a) : null,
      };
    });
}

function fromDrawing(design: unknown): CircuitCheckInput[] {
  if (!isObj(design)) return [];
  return arr(design.wires)
    .filter(isObj)
    .map((w, i) => {
      const ref = str(w.ref) ?? `W${i + 1}`;
      const voltage = num(w.voltage_v) ?? 230;
      const circuit = str(w.circuit);
      // "PO1 (Double power outlet)" -> "PO1" to keep the label short.
      const end = (v: unknown) => str(v)?.replace(/\s*\(.*\)$/, '') ?? '?';
      return {
        ref: `wires[${ref}]`,
        source: 'Project drawing',
        label: `Cable ${ref}${circuit ? ` on circuit ${circuit}` : ''} (${end(w.from)} → ${end(w.to)})`,
        loadType: classifyLoad(str(w.load_type)),
        protectionA: num(w.protection_a),
        rcd: bool(w.rcd_protected),
        cableSizeMm2: num(w.size_mm2),
        cableType: str(w.cable_type),
        lengthM: num(w.length_m),
        phases: voltage === 400 ? 3 : 1,
        voltage,
        mainSwitchA: null,
      };
    });
}

export function normalise(documents: unknown[], design: unknown): CircuitCheckInput[] {
  return [...documents.flatMap(fromExtraction), ...fromDrawing(design)];
}
