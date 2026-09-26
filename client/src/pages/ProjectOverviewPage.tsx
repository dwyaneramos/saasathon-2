import { Link, useParams } from 'react-router-dom'
import { getProjectById } from '../data/projects'

interface InfoTile {
  label: string
  value: string
}

function ProjectOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const project = id ? getProjectById(id) : undefined

  if (!project) {
    return (
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 px-8 py-10">
        <Link
          to="/projects"
          className="self-start font-[DM_Sans] text-xs uppercase tracking-wide text-black/50 hover:text-black"
        >
          ← My Projects
        </Link>
        <p className="font-[DM_Sans] text-[#1a1a1a]">Project not found.</p>
      </div>
    )
  }

  const tiles: InfoTile[] = [
    { label: 'Status', value: project.status },
    { label: 'Owner', value: project.owner },
    { label: 'Priority', value: project.priority },
    { label: 'Start Date', value: project.startDate },
    { label: 'Due Date', value: project.dueDate },
    { label: 'Progress', value: project.progress },
  ]

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 px-8 py-10">
      <Link
        to="/projects"
        className="self-start font-[DM_Sans] text-xs uppercase tracking-wide text-black/50 hover:text-black"
      >
        ← My Projects
      </Link>

      <h1 className="font-[DM_Sans] text-2xl font-semibold text-[#1a1a1a]">{project.name}</h1>

      <div className="flex gap-6">
        <div className="grid flex-1 grid-cols-3 gap-6">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="flex h-40 flex-col justify-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] p-5"
            >
              <span className="font-[DM_Sans] text-xs uppercase tracking-wide text-black/50">
                {tile.label}
              </span>
              <span className="font-[DM_Sans] text-lg font-semibold text-[#1a1a1a]">
                {tile.value}
              </span>
            </div>
          ))}
        </div>

        <div className="w-80 shrink-0 rounded-lg border border-black/10 bg-black/[0.03] p-6">
          <span className="font-[DM_Sans] text-xs uppercase tracking-wide text-black/50">
            {project.type}
          </span>
          <p className="mt-3 mb-6 font-[DM_Sans] text-sm leading-relaxed text-[#1a1a1a]">
            {project.address}
          </p>
          <span className="font-[DM_Sans] text-xs uppercase tracking-wide text-black/50">
            Description
          </span>
          <p className="mt-3 font-[DM_Sans] text-sm leading-relaxed text-[#1a1a1a]">
            {project.description}
          </p>
        </div>
      </div>
    </div>
  )
}

export default ProjectOverviewPage
