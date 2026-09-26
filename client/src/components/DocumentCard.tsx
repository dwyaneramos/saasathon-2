import { Link } from 'react-router-dom'
import { STATUS_LABEL, STATUS_STYLE, type JobDocument } from '../data/documents'
import DocumentThumbnail from './DocumentThumbnail'

interface DocumentCardProps {
  doc: JobDocument
  projectId: string
}

function DocumentCard({ doc, projectId }: DocumentCardProps) {
  return (
    <Link
      to={`/projects/${projectId}/documents/${doc.id}`}
      className="flex min-h-44 flex-col overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] transition-colors hover:bg-black/[0.05]"
    >
      <DocumentThumbnail doc={doc} className="h-20 w-full" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span
          title={doc.fileName}
          className="truncate font-[DM_Sans] text-xs font-semibold text-[#1a1a1a]"
        >
          {doc.fileName}
        </span>
        <span className="font-[DM_Sans] text-[11px] text-black/60">{doc.kind}</span>
        <span
          className={`font-[DM_Sans] text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLE[doc.status]}`}
        >
          {STATUS_LABEL[doc.status]}
          {doc.status === 'needs_review' && doc.needsReviewCount
            ? ` · ${doc.needsReviewCount}`
            : ''}
        </span>
        <span className="mt-auto font-[DM_Sans] text-[10px] text-black/50">
          {doc.pageCount ? `${doc.pageCount} page${doc.pageCount === 1 ? '' : 's'} · ` : ''}
          {doc.uploadedAt}
        </span>
      </div>
    </Link>
  )
}

export default DocumentCard
