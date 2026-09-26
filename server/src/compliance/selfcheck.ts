import assert from 'node:assert/strict';
import { normalise, parseCableSize } from './normalise.js';
import { runRules } from './rules.js';

// Extractions wrap every value as { value, provenance, rule, confidence }.
const f = <T>(value: T) => ({ value, provenance: 'extracted', rule: null, confidence: 0.95 });

function testParseCableSize(): void {
  assert.equal(parseCableSize('TPS 2.5mm2'), 2.5);
  assert.equal(parseCableSize('4 mm²'), 4);
  assert.equal(parseCableSize('TPS 2C+E 1.5 sq mm'), 1.5);
  assert.equal(parseCableSize('TPS'), null);
}

function testExtractionBreaches(): void {
  const doc = {
    source_file: 'plan.pdf',
    switchboards: [{ board_id: f('MSB'), main_switch_rating_a: f(63), supply_phase: f('1') }],
    circuits: [
      // 32 A on 1.5 mm², no RCD on sockets: capacity + RCD breaches.
      { circuit_id: f('C1'), description: f('Kitchen power'), load_type: f('socket-outlets'), phase: f('1'),
        rated_current_a: f(32), switchboard_ref: f('MSB'), rcd_protected: f(false) },
      // 20 A over 40 m of 2.5 mm²: ~14.4 V drop > 11.5 V limit.
      { circuit_id: f('C2'), description: f('Garage power'), load_type: f('socket-outlets'), phase: f('1'),
        rated_current_a: f(20), switchboard_ref: f('MSB'), rcd_protected: f(true) },
      // Compliant lighting circuit.
      { circuit_id: f('C3'), description: f('Lighting'), load_type: f('lighting'), phase: f('1'),
        rated_current_a: f(10), switchboard_ref: f('MSB'), rcd_protected: f(true) },
    ],
    cable_schedule_rows: [
      { cable_id: f('C1'), cable_type: f('TPS 1.5mm2'), length_m: f(12) },
      { cable_id: f('C2'), cable_type: f('TPS 2.5mm2'), length_m: f(40) },
      { cable_id: f('C3'), cable_type: f('TPS 1.5mm2'), length_m: f(15) },
    ],
  };

  const { breaches } = runRules(normalise([doc], null));
  const has = (ref: string, text: string) =>
    breaches.some((b) => b.item_ref === ref && b.description.includes(text) && b.method === 'rule');

  assert.ok(has('circuits[0]', 'rated about 20 A'), 'C1: 32 A on 1.5 mm² should fail capacity');
  assert.ok(has('circuits[0]', 'no RCD'), 'C1: sockets without RCD should fail');
  assert.ok(has('circuits[1]', 'V drop') || has('circuits[1]', 'drop at'), 'C2: 40 m at 20 A should fail voltage drop');
  assert.ok(!breaches.some((b) => b.item_ref === 'circuits[2]'), 'C3 is compliant');
}

function testDrawingNotChecked(): void {
  const design = {
    wires: [{ ref: 'W1', from: 'DB1', to: 'PO1', size_mm2: 2.5, length_m: 10, voltage_v: 230, load_type: 'socket-outlets' }],
  };
  const { breaches, not_checked } = runRules(normalise([], design));
  assert.equal(breaches.length, 0, 'missing data is never a breach');
  assert.ok(not_checked.some((n) => n.startsWith('Voltage drop') && n.includes('W1')));
  assert.ok(not_checked.some((n) => n.startsWith('RCD protection') && n.includes('W1')));
}

testParseCableSize();
testExtractionBreaches();
testDrawingNotChecked();

console.log('compliance selfcheck: all assertions passed');
