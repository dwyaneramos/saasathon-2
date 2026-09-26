import { useEffect, useRef, useState, type FormEvent } from 'react'
import PulsingDot from './PulsingDot'
import WiringPlanPanel, { type WiringPlanPanelHandle } from './WiringPlanPanel'
import { documentFromPipelineResult, type DocumentStatus, type PipelineDocResult } from '../data/documents'
import { useDocuments } from '../lib/documentStore'

interface DocumentRow {
  id: string
  source_file: string
  doc_type: string | null
  status: 'pending' | 'extracted' | 'skipped_noise' | 'error'
  needs_review_count: number
  created_at: string
  extraction: unknown | null
}

const STATUS_STYLE: Record<DocumentRow['status'], string> = {
  pending: 'text-black/50',
  extracted: 'text-[#1a7a3d]',
  skipped_noise: 'text-black/50',
  error: 'text-[#E3350D]',
}

// Maps the server's persisted status onto the richer status set the Documents tab uses.
function toDocumentStatus(row: DocumentRow): DocumentStatus {
  if (row.status === 'skipped_noise') return 'skipped_all_noise'
  if (row.status === 'extracted' && row.needs_review_count > 0) return 'needs_review'
  return row.status as DocumentStatus
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface ProjectDocumentsTabProps {
  projectId: string
  /** Called after an upload finishes, e.g. so compliance can re-check the new extractions. */
  onDocumentsChanged?: () => void
}

function ProjectDocumentsTab({ projectId, onDocumentsChanged }: ProjectDocumentsTabProps) {
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const wiringPlanRef = useRef<WiringPlanPanelHandle>(null)
  const { addDocuments } = useDocuments()

  async function refresh(): Promise<DocumentRow[]> {
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/documents`)
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? `request failed (${res.status})`)
      const docs = body.documents as DocumentRow[]
      setDocuments(docs)
      return docs
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function handleUpload(event: FormEvent) {
    event.preventDefault()
    if (files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      const res = await fetch(`/api/projects/${projectId}/documents`, { method: 'POST', body: formData })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? `request failed (${res.status})`)
      setFiles([])
      const docs = await refresh()
      onDocumentsChanged?.()

      // Keep the Documents tab's card view in sync with what was just processed.
      const ranAt = formatTimestamp(new Date().toISOString())
      const results = body.results as {
        docId: string
        sourceFile: string
        status: DocumentRow['status']
        needsReviewCount: number
        error: string | null
        extraction: unknown | null
      }[]
      addDocuments(
        results.map((r) => {
          const pipelineResult: PipelineDocResult = {
            docId: r.docId,
            sourceFile: r.sourceFile,
            status: toDocumentStatus({
              id: r.docId,
              source_file: r.sourceFile,
              doc_type: null,
              status: r.status,
              needs_review_count: r.needsReviewCount,
              created_at: new Date().toISOString(),
              extraction: r.extraction,
            }),
            outputFile: null,
            needsReviewCount: r.needsReviewCount,
            error: r.error,
            extracted: r.extraction,
          }
          return documentFromPipelineResult(pipelineResult, projectId, ranAt)
        }),
      )

      // Regenerate the plan whenever a fresh extraction is available, so it always
      // reflects everything uploaded so far, without waiting for a manual click.
      if (docs.some((doc) => doc.status === 'extracted')) {
        wiringPlanRef.current?.generate()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  const hasExtracted = documents.some((doc) => doc.status === 'extracted')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-[DM_Sans] text-lg font-semibold text-[#1a1a1a]">Analyse</h2>
        <p className="max-w-2xl font-[DM_Sans] text-sm text-black/60">
          Upload site plans, wiring plans, or legacy job files for this project (.pdf, .png/.jpg,
          .txt/.csv/.tsv). Each one runs through the noise-filter and extraction pipeline, and a
          wiring plan is generated automatically once anything comes back extracted.
        </p>
      </div>

      <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-4">
        <input
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.tsv"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="font-[DM_Sans] text-sm"
        />
        <button
          type="submit"
          disabled={files.length === 0 || uploading}
          className="flex items-center gap-2 rounded-full bg-[#FFCC00] px-5 py-2 font-[DM_Sans] text-sm font-semibold uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-[#E3350D] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? (
            <>
              <PulsingDot className="bg-[#1a1a1a]" />
              Uploading…
            </>
          ) : (
            'Upload'
          )}
        </button>
      </form>

      {error && (
        <p className="rounded-lg border border-[#E3350D]/30 bg-[#E3350D]/5 p-4 font-[DM_Sans] text-sm text-[#E3350D]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="font-[DM_Sans] text-sm text-black/50">Loading documents…</p>
      ) : documents.length === 0 ? (
        <p className="font-[DM_Sans] text-sm text-black/50">No documents uploaded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li key={doc.id} className="rounded-lg border border-black/10 bg-black/[0.03] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="font-[DM_Sans] text-sm text-[#1a1a1a]">{doc.source_file}</span>
                <span className={`font-[DM_Sans] text-xs font-semibold uppercase ${STATUS_STYLE[doc.status]}`}>
                  {doc.status}
                  {doc.needs_review_count > 0 && ` (${doc.needs_review_count} needs review)`}
                </span>
              </div>
              {doc.extraction != null && (
                <details className="mt-3">
                  <summary className="cursor-pointer font-[DM_Sans] text-xs uppercase tracking-wide text-black/50">
                    Raw extraction
                  </summary>
                  <pre className="mt-2 max-h-96 overflow-auto rounded bg-white p-3 font-mono text-xs text-[#1a1a1a]">
                    {JSON.stringify(doc.extraction, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      <WiringPlanPanel ref={wiringPlanRef} projectId={projectId} hasExtractedDocuments={hasExtracted} />
    </div>
  )
}

export default ProjectDocumentsTab
