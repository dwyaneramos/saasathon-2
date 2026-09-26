import DocumentCard from '../DocumentCard'
import { useDocuments } from '../../lib/documentStore'

interface DocumentsPanelProps {
  projectId: string
}

function DocumentsPanel({ projectId }: DocumentsPanelProps) {
  const { documents, loaded } = useDocuments()
  const projectDocuments = documents.filter((doc) => doc.projectId === projectId)

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-[DM_Sans] text-lg font-semibold text-[#1a1a1a]">All documents</h2>
        <p className="font-[DM_Sans] text-sm text-black/60">
          Every plan, schedule and certificate on this job. Open one to see what the pipeline
          pulled out of it.
        </p>
      </div>

      {projectDocuments.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4">
          {projectDocuments.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      ) : (
        <p className="font-[DM_Sans] text-sm text-black/50">
          {loaded
            ? 'No documents on this job yet. Run the pipeline tab to add some.'
            : 'Loading documents…'}
        </p>
      )}
    </div>
  )
}

export default DocumentsPanel
