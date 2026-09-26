import type { DocType, ExtractionDocument, Trace } from './schema.js';

const COLLECTIONS = [
  'legend_items',
  'plan_symbols',
  'circuits',
  'switchboards',
  'single_line_elements',
  'compliance_records',
  'financial_line_items',
  'cable_schedule_rows',
] as const;

type CollectionName = (typeof COLLECTIONS)[number];
type NeedsReviewEntry = ExtractionDocument['needs_review'][number];

const ITEM_REF_PATTERN = /^([a-z_]+)\[(\d+)\](.*)$/;

/** A page's own needs_review item_refs are indexed against that page's own arrays (e.g.
 * "circuits[0]"); once pages are concatenated, that index must shift by however many items
 * from earlier pages already landed in the same array. */
function remapItemRef(entry: NeedsReviewEntry, offsets: Record<CollectionName, number>): NeedsReviewEntry {
  const match = entry.item_ref.match(ITEM_REF_PATTERN);
  if (!match) return entry;
  const [, name, idxStr, rest] = match;
  if (!(name in offsets)) return entry;
  const offset = offsets[name as CollectionName];
  return { ...entry, item_ref: `${name}[${Number(idxStr) + offset}]${rest}` };
}

function pickOverallDocType(pageDocs: ExtractionDocument[]): DocType {
  const counts = new Map<DocType, number>();
  for (const doc of pageDocs) {
    if (doc.doc_type === 'other_noise') continue;
    counts.set(doc.doc_type, (counts.get(doc.doc_type) ?? 0) + 1);
  }
  let best: DocType | null = null;
  let bestCount = 0;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best ?? pageDocs[0]?.doc_type ?? 'other_noise';
}

/** Combines the independent per-page extraction calls back into the single ExtractionDocument
 * the rest of the app (validation, storage, the wiring-plan pass) expects per uploaded file. */
export function mergePageExtractions(
  pageDocs: ExtractionDocument[],
  docId: string,
  sourceFile: string,
  pagesTotal: number,
): ExtractionDocument {
  const merged: ExtractionDocument = {
    doc_id: docId,
    source_file: sourceFile,
    doc_type: pickOverallDocType(pageDocs),
    pages_total: pagesTotal,
    site_info: pageDocs.map((d) => d.site_info).find((s) => s != null) ?? null,
    legend_items: [],
    plan_symbols: [],
    circuits: [],
    switchboards: [],
    single_line_elements: [],
    compliance_records: [],
    financial_line_items: [],
    cable_schedule_rows: [],
    needs_review: [],
  };

  const offsets: Record<CollectionName, number> = {
    legend_items: 0,
    plan_symbols: 0,
    circuits: 0,
    switchboards: 0,
    single_line_elements: 0,
    compliance_records: 0,
    financial_line_items: 0,
    cable_schedule_rows: 0,
  };

  for (const doc of pageDocs) {
    for (const entry of doc.needs_review) {
      merged.needs_review.push(remapItemRef(entry, offsets));
    }
    for (const name of COLLECTIONS) {
      (merged[name] as unknown[]).push(...(doc[name] as unknown[]));
      offsets[name] += doc[name].length;
    }
  }

  return merged;
}

function withPage<T extends { trace: Trace }>(item: T, page: number): T {
  return { ...item, trace: { ...item.trace, page } };
}

/** One extraction call only ever sees a single page, but the model still writes its own guess
 * into every item's trace.page. Overwrite it with the true page number from the split, since
 * that's already known deterministically and shouldn't depend on the model getting it right. */
export function forcePageNumber(doc: ExtractionDocument, page: number): ExtractionDocument {
  return {
    ...doc,
    site_info: doc.site_info ? withPage(doc.site_info, page) : null,
    legend_items: doc.legend_items.map((item) => withPage(item, page)),
    plan_symbols: doc.plan_symbols.map((item) => withPage(item, page)),
    circuits: doc.circuits.map((item) => withPage(item, page)),
    switchboards: doc.switchboards.map((item) => withPage(item, page)),
    single_line_elements: doc.single_line_elements.map((item) => withPage(item, page)),
    compliance_records: doc.compliance_records.map((item) => withPage(item, page)),
    financial_line_items: doc.financial_line_items.map((item) => withPage(item, page)),
    cable_schedule_rows: doc.cable_schedule_rows.map((item) => withPage(item, page)),
  };
}
