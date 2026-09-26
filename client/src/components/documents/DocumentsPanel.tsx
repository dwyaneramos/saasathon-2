import { useEffect, useState } from 'react'
import DocumentCard from '../DocumentCard'
import type { DocumentKind, JobDocument } from '../../data/documents'

interface DocumentRow {
  id: string
  source_file: string
  doc_type: string | null
  status: 'intake' | 'pending' | 'extracted' | 'skipped_noise' | 'error'
  needs_review_count: number
  sheet_type: string | null
  created_at: string
}

// The AI's own classification, used only when the estimator didn't tag the sheet themselves.
const DOC_TYPE_LABEL: Record<string, DocumentKind> = {
  site_plan: 'Site plan',
  power_plan: 'Power plan',
  lighting_rcp_plan: 'Lighting / RCP plan',
  lv_specialty_plan: 'LV / specialty plan',
  wiring_layout_plan: 'Wiring layout',
  switchboard_schedule: 'Panel schedule',
  single_line_diagram: 'Single-line diagram',
  legend: 'Legend',
  coc: 'COC',
  esc: 'ESC',
  quote: 'Quote',
  invoice: 'Invoice',
  cable_schedule: 'Cable schedule',
  spreadsheet_export: 'Spreadsheet',
  other_noise: 'Other',
}

function toJobDocument(row: DocumentRow): JobDocument {
  return {
    id: row.id,
    fileName: row.source_file,
    kind: DOC_TYPE_LABEL[row.doc_type ?? ''] ?? 'Other',
    status: row.status === 'skipped_noise' ? 'skipped_all_noise' : row.status,
    needsReviewCount: row.needs_review_count,
    uploadedAt: new Date(row.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    summary: '',
  }
}

interface DocumentsPanelProps {
  projectId: string
}

function DocumentsPanel({ projectId }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<JobDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/projects/${projectId}/documents`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error ?? `request failed (${res.status})`)
        return body.documents as DocumentRow[]
      })
      .then((rows) => {
        if (!cancelled) setDocuments(rows.map(toJobDocument))
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-[DM_Sans] text-lg font-semibold text-[#1a1a1a]">All documents</h2>
        <p className="font-[DM_Sans] text-sm text-black/60">
          Every sheet in this job's drawing set, and what the pipeline made of it.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-[#E3350D]/30 bg-[#E3350D]/5 p-4 font-[DM_Sans] text-sm text-[#E3350D]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="font-[DM_Sans] text-sm text-black/50">Loading documents…</p>
      ) : documents.length === 0 ? (
        <p className="font-[DM_Sans] text-sm text-black/50">
          No documents yet. Add sheets in the Setup tab.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} projectId={projectId} />
          ))}
        </div>
      )}
    </div>
  )
}

export default DocumentsPanel
