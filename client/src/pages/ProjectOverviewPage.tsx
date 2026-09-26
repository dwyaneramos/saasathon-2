import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DrawingCanvas from '../components/drawing/DrawingCanvas'
import Inspector from '../components/drawing/Inspector'
import ProjectSummary from '../components/drawing/ProjectSummary'
import Toolbar from '../components/drawing/Toolbar'
import UploadDropzone from '../components/drawing/UploadDropzone'
import { getProjectById, type Project } from '../data/projects'
import { useDrawing } from '../lib/drawingStore'
import { loadDrawingFile } from '../lib/loadDrawingFile'
import { computeMaterials } from '../lib/materials'
import { fitView, zoomView, type View } from '../lib/view'
import type { Selection, Tool } from '../types/drawing'

const backLinkClass =
  'self-start font-[DM_Sans] text-xs uppercase tracking-wide text-black/50 hover:text-black'

function ProjectWorkspace({ project }: { project: Project }) {
  const store = useDrawing(project.id)
  const { drawing } = store
  const background = drawing.background

  const [tool, setTool] = useState<Tool>({ type: 'select' })
  const [selection, setSelection] = useState<Selection>(null)
  // The view resets to "fit" whenever a different background is loaded.
  const bgKey = background ? `${background.fileName}:${background.width}x${background.height}` : ''
  const [viewState, setViewState] = useState<{ key: string; view: View }>({ key: '', view: fitView(1, 1) })
  const bgWidth = background?.width ?? 1
  const bgHeight = background?.height ?? 1
  const fitted = useMemo(() => fitView(bgWidth, bgHeight), [bgWidth, bgHeight])
  const view = viewState.key === bgKey ? viewState.view : fitted
  const setView = useCallback(
    (update: (v: View) => View) =>
      setViewState((s) => ({ key: bgKey, view: update(s.key === bgKey ? s.view : fitted) })),
    [bgKey, fitted],
  )

  // Drop the selection if the selected item no longer exists (e.g. after undo or delete).
  const selectionExists =
    selection === null ||
    (selection.type === 'component'
      ? drawing.components.some((c) => c.id === selection.id)
      : drawing.wires.some((w) => w.id === selection.id))
  const activeSelection = selectionExists ? selection : null

  const materials = useMemo(() => computeMaterials(drawing), [drawing])

  const viewCenter = { x: view.x + view.w / 2, y: view.y + view.h / 2 }

  function deleteSelection() {
    if (!activeSelection) return
    if (activeSelection.type === 'component') store.removeComponent(activeSelection.id)
    else store.removeWire(activeSelection.id)
    setSelection(null)
  }

  async function replaceFile(file: File) {
    try {
      store.setBackground(await loadDrawingFile(file))
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not load that file.')
    }
  }

  return (
    <div className="flex min-h-svh flex-col gap-6 px-6 pt-24 pb-6 lg:h-svh lg:flex-row">
      <section className="flex min-h-[70svh] min-w-0 flex-1 flex-col gap-4 lg:min-h-0">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-black/10 bg-black/[0.03]">
          {!store.loaded ? (
            <p className="p-6 font-[DM_Sans] text-sm text-black/50">Loading drawing…</p>
          ) : background ? (
            <DrawingCanvas
              store={store}
              tool={tool}
              setTool={setTool}
              selection={activeSelection}
              setSelection={setSelection}
              view={view}
              setView={setView}
            />
          ) : (
            <div className="h-full p-6">
              <UploadDropzone onLoaded={store.setBackground} />
            </div>
          )}
          {background && (
            <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 font-[DM_Sans] text-[11px] text-black/60">
              {background.fileName}
              {drawing.metresPerPx ? '' : ' · scale not set'}
            </span>
          )}
        </div>

        {background && (
          <div className="flex justify-center">
            <Toolbar
              tool={tool}
              setTool={setTool}
              canUndo={store.canUndo}
              canRedo={store.canRedo}
              canDelete={activeSelection !== null}
              scaleSet={drawing.metresPerPx !== undefined}
              onUndo={store.undo}
              onRedo={store.redo}
              onDelete={deleteSelection}
              onZoomIn={() => setView((v) => zoomView(v, 1 / 1.25, viewCenter, background.width))}
              onZoomOut={() => setView((v) => zoomView(v, 1.25, viewCenter, background.width))}
              onFit={() => setView(() => fitted)}
              onReplaceFile={(file) => void replaceFile(file)}
            />
          </div>
        )}
      </section>

      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-96 lg:min-h-0">
        <Link to="/projects" className={backLinkClass}>
          ← My Projects
        </Link>
        <h1 className="font-[DM_Sans] text-2xl font-semibold text-[#1a1a1a]">{project.name}</h1>
        <Inspector store={store} selection={activeSelection} />
        <ProjectSummary project={project} materials={materials} />
      </aside>
    </div>
  )
}

function ProjectOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const project = id ? getProjectById(id) : undefined

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
      <ProjectWorkspace key={project.id} project={project} />
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
