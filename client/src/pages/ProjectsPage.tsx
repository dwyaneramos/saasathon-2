import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AddProjectCard from '../components/AddProjectCard'
import ProjectCard from '../components/ProjectCard'
import { listMyProjects, listSharedProjects, type Project } from '../lib/projects'

interface ProjectSectionProps {
  title: string
  projects: Project[]
  trailingSlot?: ReactNode
}

function ProjectSection({ title, projects, trailingSlot }: ProjectSectionProps) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="font-[DM_Sans] text-lg font-semibold uppercase tracking-wide text-[#1a1a1a]">
        {title}
      </h2>
      <div className="flex flex-wrap gap-6">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        {trailingSlot}
      </div>
    </section>
  )
}

function ProjectsPage() {
  const navigate = useNavigate()
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [sharedProjects, setSharedProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listMyProjects(), listSharedProjects()])
      .then(([mine, shared]) => {
        if (cancelled) return
        setMyProjects(mine)
        setSharedProjects(shared)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 px-8 py-10">
      <Link
        to="/"
        className="self-start font-[DM_Sans] text-xs uppercase tracking-wide text-black/50 hover:text-black"
      >
        ← Back
      </Link>

      {error && (
        <p className="font-[DM_Sans] text-sm text-[#E3350D]">Failed to load projects: {error}</p>
      )}

      {loading ? (
        <p className="font-[DM_Sans] text-sm text-black/50">Loading projects…</p>
      ) : (
        <div className="flex flex-col gap-12">
          <ProjectSection
            title="My Projects"
            projects={myProjects}
            trailingSlot={<AddProjectCard onClick={() => navigate('/projects/new')} />}
          />

          <ProjectSection title="Shared Projects" projects={sharedProjects} />
        </div>
      )}
    </div>
  )
}

export default ProjectsPage
