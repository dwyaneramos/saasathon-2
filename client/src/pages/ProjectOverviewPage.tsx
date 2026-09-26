import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import DrawingCanvas from '../components/drawing/DrawingCanvas'
import Inspector from '../components/drawing/Inspector'
import CableScheduleEditor from '../components/cableSchedule/CableScheduleEditor'
import ProjectSummary from '../components/drawing/ProjectSummary'
import Toolbar from '../components/drawing/Toolbar'
import UploadDropzone from '../components/drawing/UploadDropzone'
import ComplianceBreaches from '../components/pipeline/ComplianceBreaches'
import DocumentsPanel from '../components/documents/DocumentsPanel'
import ProjectDocumentsTab from '../components/ProjectDocumentsTab'
import { DEFAULT_WIRE } from '../data/catalogue'
import { rowsToComplianceDocument, useCableScheduleRows } from '../lib/cableSchedule'
import { getProjectById, type Project } from '../lib/projects'
import { detectDrawing } from '../lib/detectDrawing'
import { newId, nextComponentLabel, useDrawing } from '../lib/drawingStore'
import { loadDrawingFile } from '../lib/loadDrawingFile'
import { computeMaterials } from '../lib/materials'
import { useCompliance } from '../lib/useCompliance'
import { fitView, zoomView, type View } from '../lib/view'
import type { DrawingBackground, PlacedComponent, Selection, Tool } from '../types/drawing'

// Components below this confidence are skipped rather than added - better to miss
// a faint symbol than plant something that isn't really there.
const AUTO_PLACE_CONFIDENCE = 0.5
const AUTO_SCALE_CONFIDENCE = 0.5

type WorkspaceTab = 'drawing' | 'analyse' | 'documents'

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'drawing', label: 'Drawing' },
  { id: 'analyse', label: 'Analyse' },
  { id: 'documents', label: 'Documents' },
]

const backLinkClass =
  'self-start font-[DM_Sans] text-xs uppercase tracking-wide text-black/50 hover:text-black'

function ProjectWorkspace({ project }: { project: Project }) {
  const store = useDrawing(project.id)
  const { drawing } = store
  const background = drawing.background

  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<WorkspaceTab>(() => {
    // Lets the document page link back to the tab it came from.
    const requested = searchParams.get('tab')
    return TABS.some((t) => t.id === requested) ? (requested as WorkspaceTab) : 'drawing'
  })
  const [tool, setTool] = useState<Tool>({ type: 'select' })
  const [selection, setSelection] = useState<Selection>(null)
  const [detecting, setDetecting] = useState(false)
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

  // Navigating away mid-detection unmounts this page (and its useDrawing instance) before
  // the results ever get a chance to save - block it instead of losing the work silently.
  function guardNavigation(e: MouseEvent) {
    if (!detecting) return
    e.preventDefault()
    window.alert("Still detecting components from your plan - hang on until that finishes before navigating away.")
  }

  function deleteSelection() {
    if (!activeSelection) return
    if (activeSelection.type === 'component') store.removeComponent(activeSelection.id)
    else store.removeWire(activeSelection.id)
    setSelection(null)
  }

  // Sets the background, then asks the vision model what's already drawn on it (symbols +
  // any stated measurement) so the drawing can go straight to AR without manual re-entry.
  // Never invents a scale: if the plan states no measurement, metresPerPx stays unset and
  // the user still calibrates by hand.
  async function loadAndDetect(background: DrawingBackground) {
    store.setBackground(background)
    if (!background.dataUrl) return // blank sheet - nothing to detect

    setDetecting(true)
    try {
      const result = await detectDrawing(background.dataUrl, background.width, background.height)

      // A local running list so labels number correctly across the batch - store.drawing
      // won't reflect components added earlier in this same loop until the next render.
      const placedSoFar: PlacedComponent[] = [...store.drawing.components]
      // Maps the model's own per-response ids (e.g. "c1") to the real component ids we
      // generate, so wires can be linked to the actual placed component - not just guessed
      // by proximity, which is what let some wires end up pointing at nothing.
      const idMap = new Map<string, string>()
      let added = 0
      for (const detected of result.components) {
        if (detected.confidence < AUTO_PLACE_CONFIDENCE) continue
        const placed: PlacedComponent = {
          id: newId(),
          kind: detected.kind,
          x: detected.x,
          y: detected.y,
          rotation: 0,
          label: nextComponentLabel(placedSoFar, detected.kind),
        }
        store.addComponent(placed)
        placedSoFar.push(placed)
        idMap.set(detected.id, placed.id)
        added += 1
      }

      let addedWires = 0
      let skippedWires = 0
      for (const detected of result.wires) {
        if (detected.confidence < AUTO_PLACE_CONFIDENCE) continue

        // Only null when the model says the wire genuinely has no component there; anything
        // else must resolve to a component we actually placed, or this wire is dropped rather
        // than drawn half-connected to a component that was filtered out or never existed.
        const fromId = detected.fromComponentId ? idMap.get(detected.fromComponentId) : undefined
        const toId = detected.toComponentId ? idMap.get(detected.toComponentId) : undefined
        if ((detected.fromComponentId && !fromId) || (detected.toComponentId && !toId)) {
          skippedWires += 1
          continue
        }

        // wirePath() re-derives the endpoints from the linked component's own position, so
        // strip the model's (slightly imprecise) traced endpoints to avoid a tiny duplicate
        // kink where the wire meets the marker.
        let points = detected.points
        if (fromId) points = points.slice(1)
        if (toId) points = points.slice(0, points.length - 1)

        store.addWire({ id: newId(), fromId, toId, points, ...DEFAULT_WIRE })
        addedWires += 1
      }

      const scaleApplied = result.metresPerPx !== null && result.scaleConfidence >= AUTO_SCALE_CONFIDENCE
      if (scaleApplied) store.setScale(result.metresPerPx!)

      window.alert(
        `Detected ${added} component${added === 1 ? '' : 's'} and ${addedWires} wire${addedWires === 1 ? '' : 's'} on the plan` +
          (skippedWires > 0 ? ` (skipped ${skippedWires} wire${skippedWires === 1 ? '' : 's'} that didn't clearly connect to a placed component)` : '') +
          '. ' +
          (scaleApplied
            ? `Scale set automatically (${result.scaleEvidence ?? 'measurement found on the plan'}) - ready for AR.`
            : 'No reliable measurement was found on the plan - use the SCALE tool to calibrate before using AR.'),
      )
    } catch (err) {
      window.alert(
        `Couldn't auto-detect components: ${err instanceof Error ? err.message : String(err)}. You can still place components and calibrate manually.`,
      )
    } finally {
      setDetecting(false)
    }
  }

  // Bumped after each document upload so compliance re-checks the new extractions.
  const [documentsVersion, setDocumentsVersion] = useState(0)
  const cableSchedule = useCableScheduleRows(project.id)
  // The edited cable schedule is checked alongside the uploaded documents and the drawing.
  const scheduleDocuments = useMemo(
    () => (cableSchedule.rows.length > 0 ? [rowsToComplianceDocument(cableSchedule.rows)] : []),
    [cableSchedule.rows],
  )
  const compliance = useCompliance(drawing, project.id, documentsVersion, scheduleDocuments)

  async function replaceFile(file: File) {
    try {
      await loadAndDetect(await loadDrawingFile(file))
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not load that file.')
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex min-h-svh flex-col gap-6 px-6 pt-24 pb-6 lg:h-svh lg:flex-row">
        <section className="flex min-h-[70svh] min-w-0 flex-1 flex-col gap-4 lg:min-h-0">
          <div role="tablist" className="flex flex-wrap gap-1 self-start rounded-full border-2 border-[#1a1a1a] bg-white p-1">
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
          className={`min-h-0 flex-1 overflow-auto rounded-lg border border-black/10 bg-black/[0.03] p-6 ${
            tab === 'analyse' ? '' : 'hidden'
          }`}
        >
          <ProjectDocumentsTab
              projectId={project.id}
              onDocumentsChanged={() => setDocumentsVersion((v) => v + 1)}
            />
        </div>

          <div
            className={`min-h-0 flex-1 overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] ${
              tab === 'documents' ? '' : 'hidden'
            }`}
          >
            <DocumentsPanel projectId={project.id} />
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
                <UploadDropzone onLoaded={(bg) => void loadAndDetect(bg)} />
              </div>
            )}
            {background && (
              <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 font-[DM_Sans] text-[11px] text-black/60">
                {background.fileName}
                {drawing.metresPerPx ? '' : ' · scale not set'}
              </span>
            )}
          {detecting && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 backdrop-blur-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/15 border-t-[#E3350D]" />
              <p className="max-w-xs text-center font-[DM_Sans] text-sm text-[#1a1a1a]">
                Detecting components from your plan - this can take up to a minute.
                <br />
                <span className="font-semibold">Please don't navigate away.</span>
              </p>
            </div>
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
          <Link to="/projects" className={backLinkClass} onClick={guardNavigation}>
            ← My Projects
          </Link>
          <div className="flex items-center justify-between gap-4">
            <h1 className="font-[DM_Sans] text-2xl font-semibold text-[#1a1a1a]">{project.name}</h1>
          <div className="flex shrink-0 gap-2">
            <Link
              to={`/projects/${project.id}/ar`}
              onClick={guardNavigation}
              className="rounded-full border-2 border-[#1a1a1a] px-4 py-1.5 font-[DM_Sans] text-xs font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-[#1a1a1a] hover:text-white"
            >
              View in AR
            </Link>
              <Link
                to={`/client/projects/${project.id}`}
              onClick={guardNavigation}
                className="rounded-full bg-[#FFCC00] px-4 py-1.5 font-[DM_Sans] text-xs font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-[#E3350D] hover:text-white"
              >
                Client view →
              </Link>
          </div>
          </div>
          <Inspector store={store} selection={activeSelection} />
          <ProjectSummary project={project} materials={materials} cableCount={cableSchedule.rows.length} />
        </aside>
      </div>

      {/* Right padding = sidebar (w-96) + gap + page padding, so this lines up with the drawing column. */}
      <div className="px-6 lg:pr-[calc(24rem+3rem)]">
        <ComplianceBreaches state={compliance.state} onAskAi={compliance.askAi} />
      </div>

      <div id="cable-schedule" className="scroll-mt-24 px-6">
        <CableScheduleEditor projectId={project.id} {...cableSchedule} />
      </div>
    </div>
  )
}

function ProjectOverviewPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

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
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 px-8 pt-24 pb-10">
        <p className="font-[DM_Sans] text-sm text-[#E3350D]">Failed to load project: {error}</p>
      </div>
    )
  }

  if (project === undefined) {
    return (
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 px-8 pt-24 pb-10">
        <p className="font-[DM_Sans] text-sm text-black/50">Loading…</p>
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

  return <ProjectWorkspace key={project.id} project={project} />
}

export default ProjectOverviewPage
