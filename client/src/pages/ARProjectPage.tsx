import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ARView from '../components/ar/ARView'
import { getProjectById, type Project } from '../lib/projects'
import { useDrawing } from '../lib/drawingStore'

const backLinkClass =
  'self-start font-[DM_Sans] text-xs uppercase tracking-wide text-black/50 hover:text-black'

function ARProjectPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null | undefined>(undefined)
  const store = useDrawing(id ?? '')

  useEffect(() => {
    if (!id) {
      setProject(null)
      return
    }
    let cancelled = false
    getProjectById(id).then((result) => {
      if (!cancelled) setProject(result)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (project === undefined) {
    return (
      <div className="flex min-h-svh flex-col gap-6 bg-black px-8 pt-6 pb-10">
        <p className="font-[DM_Sans] text-sm text-white/70">Loading…</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 px-8 pt-24 pb-10">
        <Link to="/projects" className={backLinkClass}>
          ← My Projects
        </Link>
        <p className="font-[DM_Sans] text-[#1a1a1a]">Project not found.</p>
      </div>
    )
  }

  const { drawing } = store
  const backLink = (
    <Link
      to={`/projects/${project.id}`}
      className="rounded-full bg-white/90 px-4 py-1.5 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-[#1a1a1a] hover:bg-white"
    >
      ← {project.name}
    </Link>
  )

  if (!store.loaded) {
    return (
      <div className="flex min-h-svh flex-col gap-6 bg-black px-8 pt-6 pb-10">
        {backLink}
        <p className="font-[DM_Sans] text-sm text-white/70">Loading drawing…</p>
      </div>
    )
  }

  if (!drawing.background || !drawing.metresPerPx) {
    return (
      <div className="flex min-h-svh flex-col gap-6 bg-black px-8 pt-6 pb-10">
        {backLink}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="max-w-sm font-[DM_Sans] text-sm text-white/80">
            {drawing.background
              ? "This drawing hasn't been scaled yet. Use the calibrate tool on the Drawing tab to set a real-world scale before viewing it in AR."
              : 'Upload a plan on the Drawing tab first.'}
          </p>
          <Link
            to={`/projects/${project.id}`}
            className="rounded-full bg-[#FFCC00] px-4 py-1.5 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-[#1a1a1a] hover:bg-[#E3350D] hover:text-white"
          >
            Back to drawing
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-svh bg-black">
      <div className="absolute top-6 left-6 z-10">{backLink}</div>
      <ARView drawing={drawing} />
    </div>
  )
}

export default ARProjectPage
