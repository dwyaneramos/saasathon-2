import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { planWiring } from './plan.js';
import type { ExtractionDocument } from './schema.js';

const FIXTURES_DIR = path.join(import.meta.dirname, 'fixtures', 'plan');

function loadFixture(name: string): ExtractionDocument {
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, name), 'utf8')) as ExtractionDocument;
}

async function testCleanSingleSourceIsHighConfidence(): Promise<void> {
  const plan = await planWiring([loadFixture('clean.json')]);
  assert.ok(plan.items.length > 0, 'expected at least one item from a clean fixture');
  assert.ok(
    plan.items.some((item) => item.confidence === 'high'),
    'a single, complete, high-confidence source should produce a high-confidence item',
  );
}

async function testMissingQuantityIsLowConfidence(): Promise<void> {
  const plan = await planWiring([loadFixture('missing-quantity.json')]);
  assert.ok(plan.items.length > 0, 'expected at least one item even with a missing spec');
  const item = plan.items[0];
  assert.equal(item?.confidence, 'low', 'a missing required spec should be low confidence');
  assert.ok(item?.needs_info, 'needs_info should explain what is missing');
}

async function testConflictingSourcesAreFlagged(): Promise<void> {
  const plan = await planWiring([loadFixture('conflicting-a.json'), loadFixture('conflicting-b.json')]);
  assert.ok(plan.items.length >= 2, 'conflicting claims should produce separate items, not a silent pick');
  assert.ok(
    plan.items.every((item) => item.confidence !== 'high'),
    'no item should be high confidence when sources disagree',
  );
}

if (!process.env.OPENAI_API_KEY) {
  console.log('plan selfcheck: skipped (OPENAI_API_KEY not set)');
  process.exit(0);
}

await testCleanSingleSourceIsHighConfidence();
await testMissingQuantityIsLowConfidence();
await testConflictingSourcesAreFlagged();

console.log('plan selfcheck: all assertions passed');
