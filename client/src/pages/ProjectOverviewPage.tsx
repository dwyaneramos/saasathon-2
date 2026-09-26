import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ProjectDocumentsTab from '../components/ProjectDocumentsTab'
import { getProjectById, type Project } from '../lib/projects'

interface InfoTile {
  label: string
  value: string
}

type Tab = 'overview' | 'documents'

function ProjectOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    if (!id) {
      setProject(null)
      return
    }
    let cancelled = false
    getProjectById(id)
      .then((result) => {
        if (!cancelled) setProject(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return (
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 px-8 py-10">
        <p className="font-[DM_Sans] text-sm text-[#E3350D]">Failed to load project: {error}</p>
      </div>
    )
  }

  if (project === undefined) {
    return (
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 px-8 py-10">
        <p className="font-[DM_Sans] text-sm text-black/50">Loading…</p>
      </div>
    )
  }

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

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide transition-colors ${
      active ? 'bg-[#1a1a1a] text-white' : 'text-black/50 hover:text-black'
    }`

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 px-8 py-10">
      <Link
        to="/projects"
        className="self-start font-[DM_Sans] text-xs uppercase tracking-wide text-black/50 hover:text-black"
      >
        ← My Projects
      </Link>

      <div className="flex items-center justify-between gap-4">
        <h1 className="font-[DM_Sans] text-2xl font-semibold text-[#1a1a1a]">{project.name}</h1>
        <Link
          to={`/client/projects/${project.id}`}
          className="rounded-full bg-[#FFCC00] px-4 py-1.5 font-[DM_Sans] text-xs font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-[#E3350D] hover:text-white"
        >
          Client view →
        </Link>
      </div>

      <div className="flex gap-2">
        <button type="button" className={tabClass(tab === 'overview')} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button type="button" className={tabClass(tab === 'documents')} onClick={() => setTab('documents')}>
          Documents
        </button>
      </div>

      {tab === 'overview' ? (
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
      ) : (
        <ProjectDocumentsTab projectId={project.id} />
      )}
    </div>
  )
}

export default ProjectOverviewPage
