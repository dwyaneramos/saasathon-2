// Mirrors the pipeline's DocType union (server/src/pipeline/schema.ts) as labels for the UI.
export type DocumentKind =
  | 'Site plan'
  | 'Wiring layout'
  | 'Switchboard schedule'
  | 'Single line diagram'
  | 'Legend'
  | 'COC'
  | 'ESC'
  | 'Quote'
  | 'Invoice'
  | 'Cable schedule'
  | 'Spreadsheet'
  | 'Other'

export type DocumentStatus = 'extracted' | 'needs_review' | 'skipped_all_noise' | 'error'

export interface JobDocument {
  id: string
  projectId: string
  fileName: string
  kind: DocumentKind
  status: DocumentStatus
  pageCount?: number
  sizeLabel?: string
  uploadedBy: string
  /** Display format used by the rest of the app, e.g. "Sep 14, 2026". */
  uploadedAt: string
  needsReviewCount?: number
  summary: string
  /** Pipeline JSON, when the document has been through extraction. */
  extracted?: unknown
  /** Optional real page image. Seeded documents fall back to the hatched placeholder. */
  previewUrl?: string
}

export const STATUS_LABEL: Record<DocumentStatus, string> = {
  extracted: 'Extracted',
  needs_review: 'Needs review',
  skipped_all_noise: 'All noise',
  error: 'Error',
}

export const STATUS_STYLE: Record<DocumentStatus, string> = {
  extracted: 'text-[#1a7a3d]',
  needs_review: 'text-[#a16207]',
  skipped_all_noise: 'text-black/50',
  error: 'text-[#E3350D]',
}

const KIND_BY_DOC_TYPE: Record<string, DocumentKind> = {
  site_plan: 'Site plan',
  wiring_layout_plan: 'Wiring layout',
  switchboard_schedule: 'Switchboard schedule',
  single_line_diagram: 'Single line diagram',
  legend: 'Legend',
  coc: 'COC',
  esc: 'ESC',
  quote: 'Quote',
  invoice: 'Invoice',
  cable_schedule: 'Cable schedule',
  spreadsheet_export: 'Spreadsheet',
  other_noise: 'Other',
}

/** The subset of the pipeline's extraction output the UI reads. */
interface ExtractionOutput {
  doc_type?: string
  pages_total?: number | null
  legend_items?: unknown[]
  circuits?: unknown[]
  switchboards?: unknown[]
  single_line_elements?: unknown[]
  compliance_records?: unknown[]
  financial_line_items?: unknown[]
  cable_schedule_rows?: unknown[]
  needs_review?: unknown[]
}

type ExtractionCollection = Exclude<keyof ExtractionOutput, 'doc_type' | 'pages_total'>

const COLLECTION_NOUNS: [ExtractionCollection, string][] = [
  ['circuits', 'circuit'],
  ['switchboards', 'switchboard'],
  ['single_line_elements', 'single-line element'],
  ['compliance_records', 'compliance record'],
  ['financial_line_items', 'line item'],
  ['cable_schedule_rows', 'cable run'],
  ['legend_items', 'legend item'],
]

function summariseExtraction(extracted: unknown): string {
  if (!extracted || typeof extracted !== 'object') return ''
  const doc = extracted as ExtractionOutput

  const parts: string[] = []
  for (const [key, noun] of COLLECTION_NOUNS) {
    const count = doc[key]?.length ?? 0
    if (count > 0) parts.push(`${count} ${noun}${count === 1 ? '' : 's'}`)
  }
  const needsReview = doc.needs_review?.length ?? 0
  if (needsReview > 0) parts.push(`${needsReview} needing review`)
  return parts.join(' · ')
}

/** Builds a storable document from one pipeline result. */
export function documentFromPipelineResult(
  result: PipelineDocResult,
  projectId: string,
  uploadedAt: string,
): JobDocument {
  const extracted = result.extracted as ExtractionOutput | null
  const kind = extracted?.doc_type ? KIND_BY_DOC_TYPE[extracted.doc_type] : undefined

  return {
    id: `upload:${result.docId}`,
    projectId,
    fileName: result.sourceFile,
    kind: kind ?? 'Other',
    status: result.status,
    pageCount: extracted?.pages_total ?? undefined,
    uploadedBy: 'You',
    uploadedAt,
    needsReviewCount: result.needsReviewCount,
    summary: result.error
      ? result.error
      : summariseExtraction(extracted) ||
        (result.status === 'skipped_all_noise' ? 'No relevant pages found in this file.' : ''),
    extracted: result.extracted ?? undefined,
  }
}

// Mirrors what POST /api/pipeline/run returns per document.
export interface PipelineDocResult {
  docId: string
  sourceFile: string
  status: DocumentStatus
  outputFile: string | null
  needsReviewCount: number
  error: string | null
  extracted: unknown | null
}

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? 'FILE' : fileName.slice(dot + 1).toUpperCase()
}

export const DOCUMENTS: JobDocument[] = [
  {
    id: 'd1',
    projectId: 'p1',
    fileName: 'kitchen-wiring-ground-floor.pdf',
    kind: 'Wiring layout',
    status: 'extracted',
    pageCount: 2,
    sizeLabel: '1.8 MB',
    uploadedBy: 'Maya Chen',
    uploadedAt: 'Sep 14, 2026',
    summary: '3 circuits · 8 single-line elements',
    extracted: {
      doc_id: 'd1',
      source_file: 'kitchen-wiring-ground-floor.pdf',
      doc_type: 'wiring_layout_plan',
      pages_total: 2,
      circuits: [
        {
          circuit_ref: 'C1',
          description: 'Oven + hob',
          cable_type: 'TPS 2.5mm2',
          rated_current_a: { value: 32, provenance: 'extracted', rule: null, confidence: 0.94 },
        },
        {
          circuit_ref: 'C2',
          description: 'Bench double outlets',
          cable_type: 'TPS 2.5mm2',
          rated_current_a: { value: 20, provenance: 'inferred', rule: 'AS/NZS 3008 socket circuit guidance', confidence: 0.71 },
        },
        {
          circuit_ref: 'C3',
          description: 'LED downlights',
          cable_type: 'TPS 1.5mm2',
          rated_current_a: { value: 10, provenance: 'extracted', rule: null, confidence: 0.88 },
        },
      ],
      needs_review: [],
    },
  },
  {
    id: 'd2',
    projectId: 'p1',
    fileName: 'switchboard-upgrade-schematic.pdf',
    kind: 'Switchboard schedule',
    status: 'needs_review',
    pageCount: 1,
    sizeLabel: '640 KB',
    uploadedBy: 'Maya Chen',
    uploadedAt: 'Sep 12, 2026',
    needsReviewCount: 2,
    summary: '1 switchboard · 1 legend item · 2 needing review',
  },
  {
    id: 'd3',
    projectId: 'p1',
    fileName: 'coc-2291-signed.pdf',
    kind: 'COC',
    status: 'extracted',
    pageCount: 1,
    sizeLabel: '310 KB',
    uploadedBy: 'Maya Chen',
    uploadedAt: 'Sep 18, 2026',
    summary: '1 compliance record',
    extracted: {
      doc_id: 'd3',
      source_file: 'coc-2291-signed.pdf',
      doc_type: 'coc',
      pages_total: 1,
      compliance_records: [
        {
          certificate_type: 'COC',
          certificate_number: '2291',
          issue_date: '2026-09-18',
          practitioner_name: 'A. Rewiti',
          company_name: 'Chen Electrical Ltd',
          site_address: '12 Rimu St, Ponsonby, Auckland 1011',
          work_description: 'Full kitchen rewire, new oven and induction circuits, LED downlight conversion.',
        },
      ],
      needs_review: [],
    },
  },
  {
    id: 'd4',
    projectId: 'p1',
    fileName: 'kitchen-cable-schedule.csv',
    kind: 'Cable schedule',
    status: 'extracted',
    pageCount: 1,
    sizeLabel: '8 KB',
    uploadedBy: 'Maya Chen',
    uploadedAt: 'Sep 14, 2026',
    summary: '5 cable runs',
  },
  {
    id: 'd5',
    projectId: 'p1',
    fileName: 'quote-kitchen-rewire.pdf',
    kind: 'Quote',
    status: 'extracted',
    pageCount: 2,
    sizeLabel: '420 KB',
    uploadedBy: 'Maya Chen',
    uploadedAt: 'Sep 11, 2026',
    summary: '9 line items',
  },
  {
    id: 'd6',
    projectId: 'p2',
    fileName: 'level3-lighting-layout.pdf',
    kind: 'Wiring layout',
    status: 'extracted',
    pageCount: 3,
    sizeLabel: '2.6 MB',
    uploadedBy: 'Sam Rivera',
    uploadedAt: 'Aug 19, 2026',
    summary: '6 circuits · 4 switchboards',
  },
  {
    id: 'd7',
    projectId: 'p2',
    fileName: 'floor-box-schedule.pdf',
    kind: 'Switchboard schedule',
    status: 'needs_review',
    pageCount: 1,
    sizeLabel: '510 KB',
    uploadedBy: 'Sam Rivera',
    uploadedAt: 'Aug 21, 2026',
    needsReviewCount: 4,
    summary: '2 switchboards · 4 needing review',
  },
  {
    id: 'd8',
    projectId: 'p2',
    fileName: 'data-power-coordination.png',
    kind: 'Site plan',
    status: 'extracted',
    pageCount: 1,
    sizeLabel: '3.1 MB',
    uploadedBy: 'Sam Rivera',
    uploadedAt: 'Aug 24, 2026',
    summary: '5 circuits · 11 legend items',
  },
  {
    id: 'd9',
    projectId: 'p3',
    fileName: 'garage-sub-board-schematic.pdf',
    kind: 'Single line diagram',
    status: 'extracted',
    pageCount: 1,
    sizeLabel: '380 KB',
    uploadedBy: 'Priya Nair',
    uploadedAt: 'Jul 22, 2026',
    summary: '6 single-line elements',
  },
  {
    id: 'd10',
    projectId: 'p3',
    fileName: 'garage-conversion-site-plan.pdf',
    kind: 'Site plan',
    status: 'extracted',
    pageCount: 2,
    sizeLabel: '1.2 MB',
    uploadedBy: 'Priya Nair',
    uploadedAt: 'Jul 20, 2026',
    summary: '4 circuits · 7 legend items',
  },
  {
    id: 'd11',
    projectId: 'p3',
    fileName: 'coc-2310-signed.pdf',
    kind: 'COC',
    status: 'extracted',
    pageCount: 1,
    sizeLabel: '295 KB',
    uploadedBy: 'Priya Nair',
    uploadedAt: 'Sep 2, 2026',
    summary: '1 compliance record',
  },
  {
    id: 'd12',
    projectId: 'p3',
    fileName: 'esc-earthing-test.pdf',
    kind: 'ESC',
    status: 'extracted',
    pageCount: 1,
    sizeLabel: '260 KB',
    uploadedBy: 'Priya Nair',
    uploadedAt: 'Sep 2, 2026',
    summary: '1 compliance record',
  },
  {
    id: 'd13',
    projectId: 's1',
    fileName: 'units-1-4-site-plan.pdf',
    kind: 'Site plan',
    status: 'extracted',
    pageCount: 5,
    sizeLabel: '4.4 MB',
    uploadedBy: 'Jordan Lee',
    uploadedAt: 'Sep 3, 2026',
    summary: '12 circuits · 9 legend items',
  },
  {
    id: 'd14',
    projectId: 's1',
    fileName: 'unit3-revised-lighting.pdf',
    kind: 'Wiring layout',
    status: 'needs_review',
    pageCount: 2,
    sizeLabel: '1.5 MB',
    uploadedBy: 'Jordan Lee',
    uploadedAt: 'Sep 18, 2026',
    needsReviewCount: 3,
    summary: '4 circuits · 3 needing review',
  },
  {
    id: 'd15',
    projectId: 's1',
    fileName: 'common-and-tenant-boards.pdf',
    kind: 'Switchboard schedule',
    status: 'needs_review',
    pageCount: 2,
    sizeLabel: '890 KB',
    uploadedBy: 'Jordan Lee',
    uploadedAt: 'Sep 8, 2026',
    needsReviewCount: 1,
    summary: '2 switchboards · 1 needing review',
  },
  {
    id: 'd16',
    projectId: 's1',
    fileName: 'quote-revised-drawings.pdf',
    kind: 'Quote',
    status: 'extracted',
    pageCount: 2,
    sizeLabel: '470 KB',
    uploadedBy: 'Jordan Lee',
    uploadedAt: 'Sep 19, 2026',
    summary: '6 line items',
  },
]

export function getDocumentsForProject(projectId: string): JobDocument[] {
  return DOCUMENTS.filter((doc) => doc.projectId === projectId)
}

export function getDocumentById(id: string): JobDocument | undefined {
  return DOCUMENTS.find((doc) => doc.id === id)
}
