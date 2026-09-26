import assert from 'node:assert/strict';
import { buildCableSchedule, parseCableSize } from './cableSchedule.js';
import type { ExtractionDocument, Provenance } from './schema.js';

const f = <T>(value: T, provenance: Provenance = 'extracted', confidence = 0.95) => ({
  value,
  provenance,
  rule: provenance === 'extracted' ? null : 'test rule',
  confidence,
});
const trace = { doc_id: 'd', page: 1, bbox: null, region: null, method: 'vision-llm' as const, confidence: 0.9 };

function doc(sourceFile: string, parts: Partial<ExtractionDocument>): ExtractionDocument {
  return {
    doc_id: sourceFile,
    source_file: sourceFile,
    doc_type: 'cable_schedule',
    pages_total: 1,
    site_info: null,
    legend_items: [],
    circuits: [],
    switchboards: [],
    single_line_elements: [],
    compliance_records: [],
    financial_line_items: [],
    cable_schedule_rows: [],
    needs_review: [],
    ...parts,
  } as ExtractionDocument;
}

const circuit = (id: string, rating: number | null, extra: Record<string, unknown> = {}) => ({
  trace,
  circuit_id: f(id),
  description: f('Kitchen power'),
  load_type: f('socket-outlets'),
  phase: f('1' as const),
  rated_current_a: f(rating),
  switchboard_ref: f('MSB'),
  length_m: f(null),
  ...extra,
});
const cable = (id: string, type: string | null, length: number | null, extra: Record<string, unknown> = {}) => ({
  trace,
  cable_id: f(id),
  from_ref: f('MSB'),
  to_ref: f('Kitchen'),
  cable_type: f(type),
  length_m: f(length),
  notes: f(null),
  ...extra,
});

function testParseCableSize(): void {
  assert.equal(parseCableSize('TPS 2.5mm2'), 2.5);
  assert.equal(parseCableSize('2C+E 4 mm²'), 4);
  assert.equal(parseCableSize('TPS 1.5 sq mm'), 1.5);
  assert.equal(parseCableSize('TPS'), null);
  assert.equal(parseCableSize(null), null);
}

function testCopiesValuesExactly(): void {
  const [row, ...rest] = buildCableSchedule([
    doc('schedule.pdf', { circuits: [circuit('C1', 20)] as never, cable_schedule_rows: [cable('C1', 'TPS 2.5mm2', 18)] as never }),
  ]);
  assert.equal(rest.length, 0, 'a circuit matched to its cable row is one entry, not two');
  assert.deepEqual(
    [row!.ref, row!.from, row!.to, row!.cableType, row!.sizeMm2, row!.lengthM, row!.protectionA, row!.phase],
    ['C1', 'MSB', 'Kitchen', 'TPS 2.5mm2', 2.5, 18, 20, '1'],
  );
  assert.deepEqual(row!.missing, []);
  assert.deepEqual(row!.verify, []);
}

function testFlagsMissingAndNeverInvents(): void {
  const [row] = buildCableSchedule([doc('plan.pdf', { circuits: [circuit('C2', null)] as never })]);
  assert.equal(row!.cableType, null, 'no cable type is ever invented');
  assert.equal(row!.lengthM, null);
  for (const field of ['to', 'cable type', 'length', 'protection rating']) {
    assert.ok(row!.missing.includes(field), `missing ${field} should be flagged`);
  }
}

function testFlagsEstimatedLengthAndLowConfidence(): void {
  const [row] = buildCableSchedule([
    doc('layout.pdf', {
      circuits: [circuit('C3', 16, { length_m: f(9.5, 'inferred', 0.6) })] as never,
      cable_schedule_rows: [cable('C3', 'TPS 1.5mm2', null, { cable_type: f('TPS 1.5mm2', 'extracted', 0.4) })] as never,
    }),
  ]);
  assert.equal(row!.lengthM, 9.5, 'falls back to the circuit length when the cable row has none');
  assert.equal(row!.lengthEstimated, true);
  assert.ok(row!.verify.some((v) => v.includes('scaled from the drawing')));
  assert.ok(row!.verify.some((v) => v.startsWith('cable type') && v.includes('low confidence')));
}

function testFlagsConflictsBetweenDocuments(): void {
  const rows = buildCableSchedule([
    doc('a.pdf', { cable_schedule_rows: [cable('C4', 'TPS 2.5mm2', 20)] as never }),
    doc('b.pdf', { cable_schedule_rows: [cable('C4', 'TPS 4mm2', 20)] as never }),
  ]);
  assert.equal(rows.length, 2, 'both claims are kept rather than silently picking one');
  assert.ok(rows.every((r) => r.verify.some((v) => v.includes('cable type differs'))));
}

testParseCableSize();
testCopiesValuesExactly();
testFlagsMissingAndNeverInvents();
testFlagsEstimatedLengthAndLowConfidence();
testFlagsConflictsBetweenDocuments();

console.log('cable schedule selfcheck: all assertions passed');
