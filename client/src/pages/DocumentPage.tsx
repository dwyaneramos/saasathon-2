import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DocumentThumbnail from '../components/DocumentThumbnail'
import {
  STATUS_LABEL,
  STATUS_STYLE,
  type DocumentKind,
  type DocumentStatus,
  type JobDocument,
} from '../data/documents'
import { formatBytes } from '../data/sheets'

const labelClass = 'font-[DM_Sans] text-xs uppercase tracking-wide text-black/50'
const panelClass = 'rounded-lg border border-black/10 bg-black/[0.03] p-5'

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

interface DocumentDetail {
  id: string
  source_file: string
  doc_type: string | null
  status: 'intake' | 'pending' | 'extracted' | 'skipped_noise' | 'error'
  needs_review_count: number
  sheet_type: string | null
  size_bytes: number | null
  created_at: string
  extraction: unknown | null
}

function DocumentPage() {
  const { projectId, docId } = useParams<{ projectId: string; docId: string }>()
  const [detail, setDetail] = useState<DocumentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !docId) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/projects/${projectId}/documents/${docId}`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error ?? `request failed (${res.status})`)
        return body.document as DocumentDetail
      })
      .then((doc) => {
        if (!cancelled) setDetail(doc)
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
  }, [projectId, docId])

  const backLink = projectId ? `/projects/${projectId}?tab=documents` : '/projects'

  if (loading) {
    return (
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 px-8 pt-28 pb-10">
        <Link to={backLink} className={`self-start hover:text-black ${labelClass}`}>
          ← All documents
        </Link>
        <p className="font-[DM_Sans] text-[#1a1a1a]">Loading document…</p>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 px-8 pt-28 pb-10">
        <Link to={backLink} className={`self-start hover:text-black ${labelClass}`}>
          ← All documents
        </Link>
        <p className="font-[DM_Sans] text-[#1a1a1a]">{error ?? 'Document not found.'}</p>
      </div>
    )
  }

  const doc: JobDocument = {
    id: detail.id,
    fileName: detail.source_file,
    kind: DOC_TYPE_LABEL[detail.doc_type ?? ''] ?? 'Other',
    status: (detail.status === 'skipped_noise' ? 'skipped_all_noise' : detail.status) as DocumentStatus,
    needsReviewCount: detail.needs_review_count,
    sizeLabel: formatBytes(detail.size_bytes) || undefined,
    uploadedAt: new Date(detail.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    summary: '',
    extracted: detail.extraction ?? undefined,
  }

  const details = [
    { label: 'Type', value: doc.kind },
    { label: 'Tagged as', value: detail.sheet_type?.replace(/_/g, ' ') ?? 'Not tagged' },
    { label: 'Size', value: doc.sizeLabel ?? 'Not recorded' },
    { label: 'Uploaded', value: doc.uploadedAt },
  ]

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 px-8 pt-28 pb-10">
      <Link to={backLink} className={`self-start hover:text-black ${labelClass}`}>
        ← All documents
      </Link>

      <header className="flex flex-col gap-1">
        <span className={labelClass}>{doc.kind}</span>
        <h1 className="font-[DM_Sans] text-2xl font-semibold break-words text-[#1a1a1a]">
          {doc.fileName}
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <div className={`overflow-hidden ${panelClass}`}>
            <DocumentThumbnail doc={doc} className="aspect-[4/3] w-full border-b-0" />
          </div>

          {doc.extracted != null ? (
            <div className="flex flex-col gap-2">
              <h2 className={`${labelClass} font-semibold`}>Extracted data</h2>
              <pre className="max-h-96 overflow-auto rounded bg-white p-3 font-mono text-xs text-[#1a1a1a]">
                {JSON.stringify(doc.extracted, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="font-[DM_Sans] text-sm text-black/50">
              {doc.status === 'intake' || doc.status === 'pending'
                ? 'This sheet has not been through the pipeline yet.'
                : 'No structured data was extracted from this document.'}
            </p>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className={`flex flex-col gap-3 ${panelClass}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={labelClass}>Status</span>
              <span
                className={`font-[DM_Sans] text-xs font-semibold uppercase tracking-wide ${STATUS_STYLE[doc.status]}`}
              >
                {STATUS_LABEL[doc.status]}
              </span>
            </div>
            {doc.needsReviewCount ? (
              <p className="font-[DM_Sans] text-xs text-black/60">
                {doc.needsReviewCount} item{doc.needsReviewCount === 1 ? '' : 's'} flagged for
                review — nothing was guessed or dropped.
              </p>
            ) : null}
          </div>

          <dl className={`flex flex-col gap-3 ${panelClass}`}>
            {details.map((item) => (
              <div key={item.label} className="flex flex-col gap-0.5">
                <dt className={labelClass}>{item.label}</dt>
                <dd className="font-[DM_Sans] text-sm text-[#1a1a1a] capitalize">{item.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  )
}

export default DocumentPage
