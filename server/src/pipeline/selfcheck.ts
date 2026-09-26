import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ingest } from './ingest.js';
import { redactText } from './redact.js';
import type { ExtractionDocument, Provenance } from './schema.js';
import { WiringPlan } from './schema.js';
import { validateExtraction } from './validate.js';

function testRedact(): void {
  const input = 'Contact Jane Doe at jane.doe@example.co.nz or 021 555 1234 about the job.';
  const out = redactText(input);
  assert.ok(!out.includes('jane.doe@example.co.nz'), 'email should be redacted');
  assert.ok(!out.includes('021 555 1234'), 'phone should be redacted');
  assert.ok(out.includes('Jane Doe'), 'names are a documented limitation, not redacted by this regex pass');
}

function testIngestTypeDetection(): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'pipeline-selfcheck-'));
  try {
    writeFileSync(path.join(dir, 'cable-schedule.csv'), 'cable_id,from,to\nC1,DB1,SB1\n');
    writeFileSync(path.join(dir, 'notes.docx'), 'not really a docx');
    const { docs, skipped } = ingest(dir);
    assert.equal(docs.length, 1, 'the .csv should be ingested');
    assert.equal(docs[0]?.contentBlock.type, 'input_text');
    assert.equal(skipped.length, 1, 'the unsupported .docx should be logged, not silently dropped');
    assert.equal(skipped[0]?.sourceFile, 'notes.docx');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function makeField<T>(
  value: T,
  overrides: Partial<{ provenance: Provenance; rule: string | null; confidence: number }> = {},
) {
  return {
    value,
    provenance: overrides.provenance ?? ('extracted' as Provenance),
    rule: overrides.rule ?? null,
    confidence: overrides.confidence ?? 0.95,
  };
}

function makeTrace() {
  return { doc_id: 'd1', page: 1, bbox: null, method: 'text-llm' as const, confidence: 0.9 };
}

function baseDoc(): ExtractionDocument {
  return {
    doc_id: 'd1',
    source_file: 'test.csv',
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
  };
}

function testValidateFlagsLowConfidenceAndMissingRule(): void {
  const doc = baseDoc();
  doc.cable_schedule_rows = [
    {
      trace: makeTrace(),
      cable_id: makeField('C1'),
      from_ref: makeField('DB1', { provenance: 'inferred', rule: null }), // missing rule citation
      to_ref: makeField('SB1'),
      cable_type: makeField('TPS 2.5mm2', { confidence: 0.3 }), // low confidence
      length_m: makeField(12),
      notes: makeField(''),
    },
  ];
  const validated = validateExtraction(doc);
  const refs = validated.needs_review.map((f) => f.item_ref);
  assert.ok(refs.includes('cable_schedule_rows[0].from_ref'), 'missing rule citation should be flagged');
  assert.ok(refs.includes('cable_schedule_rows[0].cable_type'), 'low confidence should be flagged');
}

function testValidateFlagsDuplicateCircuitIds(): void {
  const doc = baseDoc();
  doc.doc_type = 'switchboard_schedule';
  const circuit = (id: string) => ({
    trace: makeTrace(),
    circuit_id: makeField(id),
    description: makeField('Lighting'),
    load_type: makeField('lighting'),
    phase: makeField('1' as const),
    rated_current_a: makeField(10),
    switchboard_ref: makeField('SB1'),
    length_m: makeField(12),
  });
  doc.circuits = [circuit('C1'), circuit('C1')];
  const validated = validateExtraction(doc);
  assert.ok(
    validated.needs_review.some((f) => f.reason.includes('duplicate circuit_id')),
    'duplicate circuit_id on the same board should be flagged',
  );
}

function testValidateFlagsEmptyExtraction(): void {
  const doc = baseDoc();
  const validated = validateExtraction(doc);
  assert.ok(
    validated.needs_review.some((f) => f.item_ref === 'document'),
    'an empty extraction on a non-noise doc should be flagged',
  );
}

function testWiringPlanSchemaValidatesConfidence(): void {
  const valid = WiringPlan.safeParse({
    items: [
      {
        description: 'TPS 2.5mm2, DB1 -> Kitchen',
        quantity: '18m',
        price: null,
        confidence: 'high',
        reason: 'Single cable schedule row, confidence 0.95, no conflicts.',
        needs_info: null,
        sources: [{ doc_id: 'd1', item_ref: 'cable_schedule_rows[0]' }],
      },
    ],
  });
  assert.ok(valid.success, 'a well-formed wiring plan item should validate');

  const invalid = WiringPlan.safeParse({
    items: [
      { description: 'x', quantity: null, confidence: 'certain', reason: 'x', needs_info: null, sources: [] },
    ],
  });
  assert.ok(!invalid.success, 'an invalid confidence value should fail validation');
}

testRedact();
testIngestTypeDetection();
testValidateFlagsLowConfidenceAndMissingRule();
testValidateFlagsDuplicateCircuitIds();
testValidateFlagsEmptyExtraction();
testWiringPlanSchemaValidatesConfidence();

console.log('pipeline selfcheck: all assertions passed');
