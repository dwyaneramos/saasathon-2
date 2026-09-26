import { fileExtension, type JobDocument } from '../data/documents'

// Same diagonal hatch the project cards use, so both card types read as one set.
const HATCH_BACKGROUND =
  'repeating-linear-gradient(45deg, rgba(227,53,13,0.12) 0, rgba(227,53,13,0.12) 1px, transparent 1px, transparent 8px)'

interface DocumentThumbnailProps {
  doc: JobDocument
  className?: string
}

export default function DocumentThumbnail({ doc, className = '' }: DocumentThumbnailProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border-b border-black/10 bg-[#FFCC00]/20 ${className}`}
      style={{ backgroundImage: HATCH_BACKGROUND }}
    >
      {doc.previewUrl ? (
        <img src={doc.previewUrl} alt={doc.fileName} className="h-full w-full object-cover" />
      ) : (
        <span className="rounded bg-white/90 px-2 py-1 font-[DM_Sans] text-[10px] font-semibold tracking-wide text-black/60">
          {fileExtension(doc.fileName)}
        </span>
      )}
    </div>
  )
}
