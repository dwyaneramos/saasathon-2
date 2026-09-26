import { z } from 'zod';

/**
 * Every extracted field is wrapped so downstream consumers can tell a read value
 * from a guess. `rule` is required (non-null) when provenance isn't 'extracted' -
 * it names the rule or source the inference/default came from.
 */
export const Provenance = z.enum(['extracted', 'inferred', 'assumed']);
export type Provenance = z.infer<typeof Provenance>;

export function field<T extends z.ZodTypeAny>(value: T) {
  return z.object({
    value: value.nullable(),
    provenance: Provenance,
    rule: z
      .string()
      .nullable()
      .describe(
        "The rule or source used, when provenance is 'inferred' or 'assumed'. Null when provenance is 'extracted'.",
      ),
    confidence: z.number().min(0).max(1),
  });
}
export type Field<T> = { value: T | null; provenance: Provenance; rule: string | null; confidence: number };

/** Per-item traceability: where this record came from and how it was produced. */
export const Trace = z.object({
  doc_id: z.string(),
  page: z.number().int().nullable(),
  bbox: z
    .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
    .nullable()
    .describe('Normalized 0-1 bounding box on the page, when the model can identify one; null otherwise.'),
  method: z.enum(['vision-llm', 'text-llm', 'local-parse']),
  confidence: z.number().min(0).max(1),
});
export type Trace = z.infer<typeof Trace>;

export const DocType = z.enum([
  'site_plan',
  'wiring_layout_plan',
  'switchboard_schedule',
  'single_line_diagram',
  'legend',
  'coc',
  'esc',
  'quote',
  'invoice',
  'cable_schedule',
  'spreadsheet_export',
  'other_noise',
]);
export type DocType = z.infer<typeof DocType>;

// ---- Classification (cheap model, noise filter) ----

export const PageClassification = z.object({
  page: z.number().int(),
  doc_type: DocType,
  is_noise: z.boolean().describe('True for blank, boilerplate, or otherwise irrelevant pages.'),
  noise_reason: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const ClassificationResult = z.object({
  doc_id: z.string(),
  pages_total: z.number().int(),
  pages: z.array(PageClassification),
  overall_doc_type: z.enum([...DocType.options, 'mixed', 'unknown']),
});
export type ClassificationResult = z.infer<typeof ClassificationResult>;

// ---- Extraction entities (strong model) ----

const withTrace = <S extends z.ZodRawShape>(shape: S) => z.object({ trace: Trace, ...shape });

export const SiteInfo = withTrace({
  address: field(z.string()),
  legal_description: field(z.string()),
});

export const LegendItem = withTrace({
  symbol: field(z.string()).describe('Symbol as drawn or labelled, in the surveyor/drafter\'s own words.'),
  meaning: field(z.string()),
});

export const Circuit = withTrace({
  circuit_id: field(z.string()),
  description: field(z.string()),
  load_type: field(z.string()).describe('As labelled on the plan (e.g. "lighting", "oven") - never inferred cable sizing.'),
  phase: field(z.enum(['1', '2', '3'])),
  rated_current_a: field(z.number()).describe('Breaker/circuit rating as printed on the schedule.'),
  switchboard_ref: field(z.string()).describe('board_id of the switchboard this circuit belongs to.'),
});

export const SwitchboardSchedule = withTrace({
  board_id: field(z.string()),
  location: field(z.string()),
  main_switch_rating_a: field(z.number()),
  supply_phase: field(z.enum(['1', '3'])),
  ways_total: field(z.number().int()),
});

export const SingleLineElement = withTrace({
  element_type: field(z.enum(['supply', 'main_switch', 'distribution_board', 'feeder', 'meter', 'other'])),
  label: field(z.string()),
  rating_a: field(z.number()),
  from_ref: field(z.string()),
  to_ref: field(z.string()),
});

export const ComplianceRecord = withTrace({
  certificate_type: field(z.enum(['COC', 'ESC'])),
  certificate_number: field(z.string()),
  issue_date: field(z.string()).describe('ISO 8601 date as printed on the certificate.'),
  practitioner_name: field(z.string()),
  company_name: field(z.string()),
  site_address: field(z.string()),
  work_description: field(z.string()),
});

export const FinancialLineItem = withTrace({
  source_doc_type: field(z.enum(['quote', 'invoice'])),
  line_no: field(z.number().int()),
  description: field(z.string()),
  quantity: field(z.number()),
  unit: field(z.string()),
  unit_price: field(z.number()).describe('As printed - never computed or estimated.'),
  line_total: field(z.number()).describe('As printed - never computed or estimated.'),
});

export const CableScheduleRow = withTrace({
  cable_id: field(z.string()),
  from_ref: field(z.string()),
  to_ref: field(z.string()),
  cable_type: field(z.string()).describe('As printed (e.g. "TPS 2.5mm2") - never a sizing recommendation.'),
  length_m: field(z.number()),
  notes: field(z.string()),
});

export const NeedsReviewEntry = z.object({
  item_ref: z.string().describe('A path-like reference to the flagged item, e.g. "circuits[3].rated_current_a".'),
  reason: z.string(),
});

export const ExtractionDocument = z.object({
  doc_id: z.string(),
  source_file: z.string(),
  doc_type: DocType,
  pages_total: z.number().int().nullable(),
  site_info: SiteInfo.nullable(),
  legend_items: z.array(LegendItem),
  circuits: z.array(Circuit),
  switchboards: z.array(SwitchboardSchedule),
  single_line_elements: z.array(SingleLineElement),
  compliance_records: z.array(ComplianceRecord),
  financial_line_items: z.array(FinancialLineItem),
  cable_schedule_rows: z.array(CableScheduleRow),
  needs_review: z.array(NeedsReviewEntry),
});
export type ExtractionDocument = z.infer<typeof ExtractionDocument>;
