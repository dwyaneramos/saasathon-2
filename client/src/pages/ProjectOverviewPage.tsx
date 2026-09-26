import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DrawingCanvas from '../components/drawing/DrawingCanvas'
import Inspector from '../components/drawing/Inspector'
import ProjectSummary from '../components/drawing/ProjectSummary'
import Toolbar from '../components/drawing/Toolbar'
import UploadDropzone from '../components/drawing/UploadDropzone'
import DocumentPipeline from '../components/pipeline/DocumentPipeline'
import { getProjectById, type Project } from '../data/projects'
import { useDrawing } from '../lib/drawingStore'
import { loadDrawingFile } from '../lib/loadDrawingFile'
import { computeMaterials } from '../lib/materials'
import { fitView, zoomView, type View } from '../lib/view'
import type { Selection, Tool } from '../types/drawing'

type WorkspaceTab = 'drawing' | 'pipeline'

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'drawing', label: 'Drawing' },
  { id: 'pipeline', label: 'Document pipeline' },
]

const backLinkClass =
  'self-start font-[DM_Sans] text-xs uppercase tracking-wide text-black/50 hover:text-black'

function ProjectWorkspace({ project }: { project: Project }) {
  const store = useDrawing(project.id)
  const { drawing } = store
  const background = drawing.background

  const [tab, setTab] = useState<WorkspaceTab>('drawing')
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
        <div role="tablist" className="flex gap-1 self-start rounded-full border-2 border-[#1a1a1a] bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 font-[DM_Sans] text-xs font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors ${
                tab === t.id ? 'bg-[#FFCC00]' : 'hover:bg-black/[0.06]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Kept mounted while hidden so pipeline results survive switching tabs. */}
        <div
          className={`min-h-0 flex-1 overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] ${
            tab === 'pipeline' ? '' : 'hidden'
          }`}
        >
          <DocumentPipeline />
        </div>

        <div
          className={`relative min-h-0 flex-1 overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] ${
            tab === 'drawing' ? '' : 'hidden'
          }`}
        >
          {!store.loaded ? (
            <p className="p-6 font-[DM_Sans] text-sm text-black/50">Loading drawing…</p>
          ) : tab !== 'drawing' ? null : background ? (
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

        {tab === 'drawing' && background && (
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
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-[DM_Sans] text-2xl font-semibold text-[#1a1a1a]">{project.name}</h1>
          <Link
            to={`/client/projects/${project.id}`}
            className="shrink-0 rounded-full bg-[#FFCC00] px-4 py-1.5 font-[DM_Sans] text-xs font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-[#E3350D] hover:text-white"
          >
            Client view →
          </Link>
        </div>
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

  return <ProjectWorkspace key={project.id} project={project} />
}

export default ProjectOverviewPage
