// A processed document: one row of the server's `documents` table, rendered as a card.
// Distinct from JobSheet (data/sheets.ts), which is an uploaded input that hasn't been run
// through the pipeline yet.

export type DocumentKind =
  | 'Site plan'
  | 'Power plan'
  | 'Lighting / RCP plan'
  | 'LV / specialty plan'
  | 'Wiring layout'
  | 'Panel schedule'
  | 'Single-line diagram'
  | 'Legend'
  | 'COC'
  | 'ESC'
  | 'Quote'
  | 'Invoice'
  | 'Cable schedule'
  | 'Spreadsheet'
  | 'Other'

export type DocumentStatus = 'intake' | 'pending' | 'extracted' | 'needs_review' | 'skipped_all_noise' | 'error'

export interface JobDocument {
  id: string
  fileName: string
  kind: DocumentKind
  status: DocumentStatus
  pageCount?: number
  sizeLabel?: string
  /** Absent until uploads are attributed to a user; nothing records that server-side yet. */
  uploadedBy?: string
  /** Display format used by the rest of the app, e.g. "Sep 14, 2026". */
  uploadedAt: string
  needsReviewCount?: number
  summary: string
  /** Pipeline JSON, when the document has been through extraction. */
  extracted?: unknown
  /** Optional real page image. Falls back to the hatched placeholder. */
  previewUrl?: string
}

export const STATUS_LABEL: Record<DocumentStatus, string> = {
  intake: 'Awaiting processing',
  pending: 'Processing',
  extracted: 'Extracted',
  needs_review: 'Needs review',
  skipped_all_noise: 'All noise',
  error: 'Error',
}

export const STATUS_STYLE: Record<DocumentStatus, string> = {
  intake: 'text-black/50',
  pending: 'text-black/50',
  extracted: 'text-[#1a7a3d]',
  needs_review: 'text-[#a16207]',
  skipped_all_noise: 'text-black/50',
  error: 'text-[#E3350D]',
}

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? 'FILE' : fileName.slice(dot + 1).toUpperCase()
}
