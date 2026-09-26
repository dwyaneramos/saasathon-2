import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AddProjectCard from '../components/AddProjectCard'
import ProjectCard from '../components/ProjectCard'
import { MY_PROJECTS, SHARED_PROJECTS, type Project } from '../data/projects'

function handleAddProject() {
  console.log('Add project clicked')
}

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
  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 px-8 py-10">
      <Link
        to="/"
        className="self-start font-[DM_Sans] text-xs uppercase tracking-wide text-black/50 hover:text-black"
      >
        ← Back
      </Link>

      <div className="flex flex-col gap-12">
        <ProjectSection
          title="My Projects"
          projects={MY_PROJECTS}
          trailingSlot={<AddProjectCard onClick={handleAddProject} />}
        />

        <ProjectSection title="Shared Projects" projects={SHARED_PROJECTS} />
      </div>
    </div>
  )
}

export default ProjectsPage
