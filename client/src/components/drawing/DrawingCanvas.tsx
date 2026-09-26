import { useEffect, useRef, useState } from 'react'
import { DEFAULT_WIRE } from '../../data/catalogue'
import { newId, type DrawingStore } from '../../lib/drawingStore'
import { wireLengthM, wirePath } from '../../lib/materials'
import { zoomView, type View } from '../../lib/view'
import type { ComponentKind, Point, Selection, Tool } from '../../types/drawing'
import { ComponentSymbol } from './Symbols'

const LABEL_PREFIX: Record<ComponentKind, string> = {
  socket: 'PO',
  'double-socket': 'PO',
  switch: 'SW',
  'two-way-switch': 'SW',
  light: 'L',
  downlight: 'DL',
  switchboard: 'DB',
  'junction-box': 'JB',
}

const SELECT_COLOUR = '#E3350D'
const INK = '#1a1a1a'
const WIRE_COLOUR = '#1f5fbf'

interface DrawingCanvasProps {
  store: DrawingStore
  tool: Tool
  setTool: (tool: Tool) => void
  selection: Selection
  setSelection: (selection: Selection) => void
  view: View
  setView: (update: (view: View) => View) => void
}

type Gesture =
  | { type: 'pan'; startClient: Point; startView: View; unitsPerPx: number }
  | { type: 'drag'; id: string; offset: Point }

interface WireDraft {
  tool: Tool
  fromId?: string
  points: Point[]
}

interface CalibrateDraft {
  tool: Tool
  start: Point
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
}

function DrawingCanvas({ store, tool, setTool, selection, setSelection, view, setView }: DrawingCanvasProps) {
  const { drawing } = store
  const background = drawing.background!
  const svgRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [wireDraftState, setWireDraft] = useState<WireDraft | null>(null)
  const [calibrateState, setCalibrateStart] = useState<CalibrateDraft | null>(null)
  // In-progress work only counts for the tool it was started with.
  const wireDraft = wireDraftState?.tool === tool ? wireDraftState : null
  const calibrateStart = calibrateState?.tool === tool ? calibrateState.start : null
  const [spaceHeld, setSpaceHeld] = useState(false)

  // Size of symbols relative to the drawing so they read well at "fit" zoom.
  const unit = Math.max(background.width, background.height) / 1100
  const stroke = unit * 1.6

  function toDrawing(clientX: number, clientY: number): Point {
    const svg = svgRef.current!
    const ctm = svg.getScreenCTM()!.inverse()
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm)
    return { x: p.x, y: p.y }
  }

  function finishWire(draft: WireDraft, toId?: string) {
    // Drop near-duplicate bend points (a double-click adds the same point twice).
    const points = draft.points.filter(
      (p, i, all) => i === 0 || Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y) > unit * 2,
    )
    draft = { ...draft, points }
    const pointCount = draft.points.length + (draft.fromId ? 1 : 0) + (toId ? 1 : 0)
    if (pointCount >= 2) {
      const id = newId()
      store.addWire({ id, fromId: draft.fromId, toId, points: draft.points, ...DEFAULT_WIRE })
      setSelection({ type: 'wire', id })
    }
    setWireDraft(null)
  }

  // Wheel zoom around the cursor. Needs a non-passive listener to stop page scroll.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const center = toDrawing(e.clientX, e.clientY)
      setView((v) => zoomView(v, e.deltaY > 0 ? 1.12 : 1 / 1.12, center, background.width))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [setView, background.width])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      const mod = e.ctrlKey || e.metaKey
      if (e.key === ' ') {
        e.preventDefault()
        setSpaceHeld(true)
      } else if (e.key === 'Escape') {
        if (wireDraft || calibrateStart) {
          setWireDraft(null)
          setCalibrateStart(null)
        } else {
          setSelection(null)
          setTool({ type: 'select' })
        }
      } else if (e.key === 'Enter' && wireDraft) {
        finishWire(wireDraft)
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        e.preventDefault()
        if (selection.type === 'component') store.removeComponent(selection.id)
        else store.removeWire(selection.id)
        setSelection(null)
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        store.redo()
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === ' ') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  })

  function startPan(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect()
    gesture.current = {
      type: 'pan',
      startClient: { x: e.clientX, y: e.clientY },
      startView: view,
      unitsPerPx: Math.max(view.w / rect.width, view.h / rect.height),
    }
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.button !== 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const point = toDrawing(e.clientX, e.clientY)
    const target = e.target as Element
    const componentId = target.closest('[data-component-id]')?.getAttribute('data-component-id') ?? undefined
    const wireId = target.closest('[data-wire-id]')?.getAttribute('data-wire-id') ?? undefined

    if (e.button === 1 || spaceHeld || tool.type === 'pan') {
      startPan(e)
      return
    }

    switch (tool.type) {
      case 'select': {
        if (componentId) {
          const component = drawing.components.find((c) => c.id === componentId)!
          setSelection({ type: 'component', id: componentId })
          store.checkpoint()
          gesture.current = {
            type: 'drag',
            id: componentId,
            offset: { x: point.x - component.x, y: point.y - component.y },
          }
        } else if (wireId) {
          setSelection({ type: 'wire', id: wireId })
        } else {
          setSelection(null)
          startPan(e)
        }
        return
      }
      case 'place': {
        const prefix = LABEL_PREFIX[tool.kind]
        const count = drawing.components.filter((c) => LABEL_PREFIX[c.kind] === prefix).length
        const id = newId()
        store.addComponent({
          id,
          kind: tool.kind,
          x: point.x,
          y: point.y,
          rotation: 0,
          label: `${prefix}${count + 1}`,
        })
        setSelection({ type: 'component', id })
        return
      }
      case 'wire': {
        if (!wireDraft) {
          setWireDraft(componentId ? { tool, fromId: componentId, points: [] } : { tool, points: [point] })
        } else if (componentId && componentId !== wireDraft.fromId) {
          finishWire(wireDraft, componentId)
        } else {
          setWireDraft({ ...wireDraft, points: [...wireDraft.points, point] })
        }
        return
      }
      case 'calibrate': {
        if (!calibrateStart) {
          setCalibrateStart({ tool, start: point })
          return
        }
        const px = Math.hypot(point.x - calibrateStart.x, point.y - calibrateStart.y)
        setCalibrateStart(null)
        if (px < 1) return
        const answer = window.prompt('Real-world length of the line you just drew, in metres:', '1')
        const metres = answer ? Number.parseFloat(answer) : NaN
        if (Number.isFinite(metres) && metres > 0) {
          store.setScale(metres / px)
          setTool({ type: 'select' })
        }
        return
      }
    }
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current
    if (g?.type === 'pan') {
      const dx = (e.clientX - g.startClient.x) * g.unitsPerPx
      const dy = (e.clientY - g.startClient.y) * g.unitsPerPx
      setView(() => ({ ...g.startView, x: g.startView.x - dx, y: g.startView.y - dy }))
      return
    }
    const point = toDrawing(e.clientX, e.clientY)
    if (g?.type === 'drag') {
      store.moveComponent(g.id, point.x - g.offset.x, point.y - g.offset.y)
      return
    }
    if (wireDraft || calibrateStart) setCursor(point)
  }

  function handlePointerUp() {
    gesture.current = null
  }

  const panning = spaceHeld || tool.type === 'pan'
  const cursorClass = panning
    ? 'cursor-grab active:cursor-grabbing'
    : tool.type === 'select'
      ? 'cursor-default'
      : 'cursor-crosshair'

  const draftPath: Point[] | null = wireDraft
    ? [
        ...(wireDraft.fromId
          ? [drawing.components.find((c) => c.id === wireDraft.fromId)!].map((c) => ({ x: c.x, y: c.y }))
          : []),
        ...wireDraft.points,
        ...(cursor ? [cursor] : []),
      ]
    : null

  const toPoints = (pts: Point[]) => pts.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      ref={svgRef}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet"
      className={`h-full w-full touch-none select-none ${cursorClass}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => wireDraft && finishWire(wireDraft)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <pattern id="sheet-grid" width={50} height={50} patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
        </pattern>
      </defs>

      <rect
        x={0}
        y={0}
        width={background.width}
        height={background.height}
        fill="white"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth={unit}
      />
      {background.dataUrl ? (
        <image href={background.dataUrl} x={0} y={0} width={background.width} height={background.height} />
      ) : (
        <rect x={0} y={0} width={background.width} height={background.height} fill="url(#sheet-grid)" />
      )}

      {drawing.wires.map((wire) => {
        const path = wirePath(wire, drawing.components)
        if (path.length < 2) return null
        const selected = selection?.type === 'wire' && selection.id === wire.id
        const length = wireLengthM(wire, drawing)
        const mid = path[Math.floor((path.length - 1) / 2)]
        const next = path[Math.floor((path.length - 1) / 2) + 1]
        const labelAt = { x: (mid.x + next.x) / 2, y: (mid.y + next.y) / 2 }
        const colour = selected ? SELECT_COLOUR : WIRE_COLOUR
        return (
          <g key={wire.id} data-wire-id={wire.id} className={tool.type === 'select' ? 'cursor-pointer' : ''}>
            <polyline points={toPoints(path)} fill="none" stroke="transparent" strokeWidth={unit * 10} />
            <polyline
              points={toPoints(path)}
              fill="none"
              stroke={colour}
              strokeWidth={stroke * (selected ? 1.6 : 1.1)}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={wire.voltage === 400 ? `${unit * 6} ${unit * 3}` : undefined}
            />
            <text
              x={labelAt.x}
              y={labelAt.y - unit * 5}
              fontSize={unit * 9}
              textAnchor="middle"
              fill={colour}
              stroke="white"
              strokeWidth={unit * 3}
              paintOrder="stroke"
              className="pointer-events-none font-[DM_Sans] font-semibold"
            >
              {wire.sizeMm2} mm²{length !== undefined ? ` · ${length.toFixed(1)} m` : ''}
            </text>
          </g>
        )
      })}

      {draftPath && draftPath.length >= 2 && (
        <polyline
          points={toPoints(draftPath)}
          fill="none"
          stroke={SELECT_COLOUR}
          strokeWidth={stroke}
          strokeDasharray={`${unit * 4} ${unit * 3}`}
          className="pointer-events-none"
        />
      )}

      {drawing.components.map((c) => {
        const selected = selection?.type === 'component' && selection.id === c.id
        return (
          <g
            key={c.id}
            data-component-id={c.id}
            transform={`translate(${c.x} ${c.y})`}
            className={tool.type === 'select' ? 'cursor-move' : tool.type === 'wire' ? 'cursor-pointer' : ''}
            style={{ color: selected ? SELECT_COLOUR : INK }}
          >
            {selected && <circle r={unit * 17} fill="rgba(255,204,0,0.35)" stroke="none" />}
            <g transform={`rotate(${c.rotation}) scale(${unit})`}>
              <circle r={14} fill="transparent" />
              <ComponentSymbol kind={c.kind} />
            </g>
            <text
              y={unit * 22}
              fontSize={unit * 9}
              textAnchor="middle"
              fill="currentColor"
              stroke="white"
              strokeWidth={unit * 3}
              paintOrder="stroke"
              className="pointer-events-none font-[DM_Sans] font-semibold"
            >
              {c.label}
            </text>
          </g>
        )
      })}

      {calibrateStart && (
        <g className="pointer-events-none" stroke={SELECT_COLOUR} strokeWidth={stroke}>
          <circle cx={calibrateStart.x} cy={calibrateStart.y} r={unit * 3} fill={SELECT_COLOUR} />
          {cursor && <line x1={calibrateStart.x} y1={calibrateStart.y} x2={cursor.x} y2={cursor.y} />}
        </g>
      )}
    </svg>
  )
}

export default DrawingCanvas
