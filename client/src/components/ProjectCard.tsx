import { Link } from 'react-router-dom'
import type { Project } from '../lib/projects'

interface ProjectCardProps {
  project: Project
}

function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex h-40 w-56 shrink-0 flex-col overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] transition-colors hover:bg-black/[0.05]"
    >
      <div
        className="h-20 w-full shrink-0 border-b border-black/10 bg-[#FFCC00]/20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(227,53,13,0.12) 0, rgba(227,53,13,0.12) 1px, transparent 1px, transparent 8px)',
        }}
      />
      <div className="flex flex-1 items-center px-4">
        <span className="font-[DM_Sans] text-base text-[#1a1a1a]">{project.name}</span>
      </div>
    </Link>
  )
}

export default ProjectCard
