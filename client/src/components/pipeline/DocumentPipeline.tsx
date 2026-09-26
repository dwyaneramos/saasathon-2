import { useState } from 'react'

interface PipelineDocResult {
  docId: string
  sourceFile: string
  status: 'extracted' | 'skipped_all_noise' | 'error'
  outputFile: string | null
  needsReviewCount: number
  error: string | null
  extracted: unknown | null
}

interface PipelineResponse {
  ranAt: string
  skippedFiles: { sourceFile: string; reason: string }[]
  results: PipelineDocResult[]
}

const STATUS_STYLE: Record<PipelineDocResult['status'], string> = {
  extracted: 'text-[#1a7a3d]',
  skipped_all_noise: 'text-black/50',
  error: 'text-[#E3350D]',
}

function DocumentPipeline() {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PipelineResponse | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))

      const res = await fetch('/api/pipeline/run', { method: 'POST', body: formData })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? `request failed (${res.status})`)
      setResult(body as PipelineResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-[DM_Sans] text-lg font-semibold text-[#1a1a1a]">Document pipeline</h2>
        <p className="max-w-2xl font-[DM_Sans] text-sm text-black/60">
          Upload site plans, wiring plans, or legacy job files for this project (.pdf, .png/.jpg,
          .txt/.csv/.tsv). Each one runs through the noise-filter and extraction pipeline and comes back
          as JSON.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-4">
        <input
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.tsv"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="font-[DM_Sans] text-sm"
        />
        <button
          type="submit"
          disabled={files.length === 0 || loading}
          className="rounded-full bg-[#FFCC00] px-5 py-2 font-[DM_Sans] text-sm font-semibold uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-[#E3350D] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Running…' : 'Run pipeline'}
        </button>
      </form>

      {error && (
        <p className="rounded-lg border border-[#E3350D]/30 bg-[#E3350D]/5 p-4 font-[DM_Sans] text-sm text-[#E3350D]">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          <p className="font-[DM_Sans] text-xs uppercase tracking-wide text-black/50">
            Ran at {new Date(result.ranAt).toLocaleString()}
          </p>

          {result.skippedFiles.length > 0 && (
            <div className="rounded-lg border border-black/10 bg-black/[0.03] p-4">
              <span className="font-[DM_Sans] text-xs uppercase tracking-wide text-black/50">
                Unsupported files (skipped, not deleted)
              </span>
              <ul className="mt-2 font-[DM_Sans] text-sm text-[#1a1a1a]">
                {result.skippedFiles.map((s) => (
                  <li key={s.sourceFile}>
                    {s.sourceFile} — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.results.map((doc) => (
            <details
              key={doc.docId}
              className="rounded-lg border border-black/10 bg-black/[0.03] p-4"
              open={doc.status !== 'skipped_all_noise'}
            >
              <summary className="cursor-pointer font-[DM_Sans] text-sm font-semibold text-[#1a1a1a]">
                {doc.sourceFile} — <span className={STATUS_STYLE[doc.status]}>{doc.status}</span>
                {doc.needsReviewCount > 0 && (
                  <span className="ml-2 text-xs font-normal text-black/50">
                    ({doc.needsReviewCount} needs_review)
                  </span>
                )}
              </summary>
              {doc.error && (
                <p className="mt-3 font-[DM_Sans] text-sm text-[#E3350D]">{doc.error}</p>
              )}
              {doc.extracted != null && (
                <pre className="mt-3 max-h-96 overflow-auto rounded bg-white p-3 font-mono text-xs text-[#1a1a1a]">
                  {JSON.stringify(doc.extracted, null, 2)}
                </pre>
              )}
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

export default DocumentPipeline
