import { Link, useParams } from 'react-router-dom'
import DocumentThumbnail from '../components/DocumentThumbnail'
import { STATUS_LABEL, STATUS_STYLE } from '../data/documents'
import { getProjectById } from '../data/projects'
import { useDocuments } from '../lib/documentStore'

const labelClass = 'font-[DM_Sans] text-xs uppercase tracking-wide text-black/50'
const panelClass = 'rounded-lg border border-black/10 bg-black/[0.03] p-5'

function DocumentPage() {
  const { id } = useParams<{ id: string }>()
  const { documents, loaded } = useDocuments()
  const doc = id ? documents.find((document) => document.id === id) : undefined

  if (!doc) {
    return (
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 px-8 pt-28 pb-10">
        <Link to="/projects" className={`self-start hover:text-black ${labelClass}`}>
          ← My Projects
        </Link>
        <p className="font-[DM_Sans] text-[#1a1a1a]">
          {loaded ? 'Document not found.' : 'Loading document…'}
        </p>
      </div>
    )
  }

  const project = getProjectById(doc.projectId)
  const backLink = `/projects/${doc.projectId}?tab=documents`

  const details = [
    { label: 'Project', value: project?.name ?? doc.projectId },
    { label: 'Type', value: doc.kind },
    { label: 'Pages', value: doc.pageCount ? String(doc.pageCount) : 'Not recorded' },
    { label: 'Size', value: doc.sizeLabel ?? 'Not recorded' },
    { label: 'Uploaded by', value: doc.uploadedBy },
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

          {doc.summary && (
            <p className="font-[DM_Sans] text-sm text-[#1a1a1a]/80">{doc.summary}</p>
          )}

          {doc.extracted != null && (
            <div className="flex flex-col gap-2">
              <h2 className={`${labelClass} font-semibold`}>Extracted data</h2>
              <pre className="max-h-96 overflow-auto rounded bg-white p-3 font-mono text-xs text-[#1a1a1a]">
                {JSON.stringify(doc.extracted, null, 2)}
              </pre>
            </div>
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
                {doc.needsReviewCount} item{doc.needsReviewCount === 1 ? '' : 's'} flagged for review
                — nothing was guessed or dropped.
              </p>
            ) : null}
          </div>

          <dl className={`flex flex-col gap-3 ${panelClass}`}>
            {details.map((detail) => (
              <div key={detail.label} className="flex flex-col gap-0.5">
                <dt className={labelClass}>{detail.label}</dt>
                <dd className="font-[DM_Sans] text-sm text-[#1a1a1a]">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  )
}

export default DocumentPage
