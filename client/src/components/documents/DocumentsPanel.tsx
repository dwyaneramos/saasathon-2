import { useEffect, useState } from 'react'
import DocumentCard from '../DocumentCard'
import { getDocumentsForProject, type JobDocument } from '../../lib/documents'

interface DocumentsPanelProps {
  projectId: string
}

function DocumentsPanel({ projectId }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<JobDocument[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    getDocumentsForProject(projectId)
      .then((docs) => {
        if (!cancelled) setDocuments(docs)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
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
          Every plan, schedule and certificate on this job. Open one to see what the pipeline
          pulled out of it.
        </p>
      </div>

      {error && <p className="font-[DM_Sans] text-sm text-[#E3350D]">Failed to load documents: {error}</p>}

      {documents.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      ) : (
        !error && (
          <p className="font-[DM_Sans] text-sm text-black/50">
            {loaded ? 'No documents on this job yet. Upload one in the Document Pipeline tab.' : 'Loading documents…'}
          </p>
        )
      )}
    </div>
  )
}

export default DocumentsPanel
