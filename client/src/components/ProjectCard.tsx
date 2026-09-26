import { Link } from 'react-router-dom'
import type { Project } from '../lib/projects'

interface ProjectCardProps {
  project: Project
  onEdit?: (project: Project) => void
  onDelete?: (project: Project) => void
}

const iconButtonClass =
  'flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white/95 text-[#1a1a1a] shadow-sm transition-colors hover:bg-[#1a1a1a] hover:text-white focus-visible:outline-2 focus-visible:outline-[#E3350D]'

function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  return (
    <div className="group relative h-40 w-56 shrink-0">
      <Link
        to={`/projects/${project.id}`}
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] transition-colors hover:bg-black/[0.05]"
      >
        <div
          className="h-20 w-full shrink-0 border-b border-black/10 bg-[#FFCC00]/20"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(227,53,13,0.12) 0, rgba(227,53,13,0.12) 1px, transparent 1px, transparent 8px)',
          }}
        />
        <div className="flex flex-1 items-center px-4">
          <span className="line-clamp-2 font-[DM_Sans] text-base text-[#1a1a1a]">{project.name}</span>
        </div>
      </Link>

      {(onEdit || onDelete) && (
        // Always visible on touch screens; revealed on hover or keyboard focus elsewhere.
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {onEdit && (
            <button
              type="button"
              aria-label={`Edit ${project.name}`}
              title="Edit name and description"
              onClick={() => onEdit(project)}
              className={iconButtonClass}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label={`Delete ${project.name}`}
              title="Delete project"
              onClick={() => onDelete(project)}
              className={`${iconButtonClass} hover:border-[#E3350D] hover:bg-[#E3350D]`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ProjectCard
