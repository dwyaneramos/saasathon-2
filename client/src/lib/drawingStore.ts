import { get, set } from 'idb-keyval'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { supabase } from './supabase'
import type { ComponentKind, Drawing, DrawingBackground, PlacedComponent, Wire } from '../types/drawing'

const HISTORY_LIMIT = 100
const SAVE_DEBOUNCE_MS = 400

const storageKey = (projectId: string) => `drawing:${projectId}`

export const newId = () => crypto.randomUUID()

// Shared between manual placement and auto-detected components so both number
// consistently (PO1, SW1, L1, ...).
export const LABEL_PREFIX: Record<ComponentKind, string> = {
  socket: 'PO',
  'double-socket': 'PO',
  switch: 'SW',
  'two-way-switch': 'SW',
  light: 'L',
  downlight: 'DL',
  switchboard: 'DB',
  'junction-box': 'JB',
}

export function nextComponentLabel(existing: readonly PlacedComponent[], kind: ComponentKind): string {
  const prefix = LABEL_PREFIX[kind]
  const count = existing.filter((c) => LABEL_PREFIX[c.kind] === prefix).length
  return `${prefix}${count + 1}`
}

function emptyDrawing(projectId: string): Drawing {
  return { projectId, components: [], wires: [], updatedAt: Date.now() }
}

interface State {
  loaded: boolean
  present: Drawing
  past: Drawing[]
  future: Drawing[]
}

type Action =
  | { type: 'load'; drawing: Drawing }
  | { type: 'change'; update: (d: Drawing) => Drawing; record: boolean }
  | { type: 'checkpoint' }
  | { type: 'undo' }
  | { type: 'redo' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load':
      return { loaded: true, present: action.drawing, past: [], future: [] }
    case 'change': {
      const next = { ...action.update(state.present), updatedAt: Date.now() }
      if (!action.record) return { ...state, present: next }
      return {
        ...state,
        present: next,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        future: [],
      }
    }
    case 'checkpoint':
      return {
        ...state,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        future: [],
      }
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        ...state,
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
      }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return { ...state, present: next, past: [...state.past, state.present], future: rest }
    }
  }
}

export function useDrawing(projectId: string) {
  const [state, dispatch] = useReducer(reducer, projectId, (id) => ({
    loaded: false,
    present: emptyDrawing(id),
    past: [],
    future: [],
  }))

  useEffect(() => {
    let cancelled = false
    async function load() {
      const cached = await get<Drawing>(storageKey(projectId)).catch(() => undefined)
      const { data, error } = await supabase
        .from('project_drawings')
        .select('drawing')
        .eq('project_id', projectId)
        .maybeSingle()

      if (error) console.error('Failed to load drawing', error)
      if (!cancelled) dispatch({ type: 'load', drawing: (data?.drawing as Drawing | undefined) ?? cached ?? emptyDrawing(projectId) })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const saveTimer = useRef<number | undefined>(undefined)
  const pendingSaveRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (!state.loaded || state.present.projectId !== projectId) return
    window.clearTimeout(saveTimer.current)
    const drawing = state.present
    const flush = () => {
      pendingSaveRef.current = null
      set(storageKey(projectId), drawing).catch((err) => console.error('Failed to save drawing', err))
      supabase
        .from('project_drawings')
        .upsert({ project_id: projectId, drawing, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (error) console.error('Failed to save drawing', error)
        })
    }
    pendingSaveRef.current = flush
    saveTimer.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS)
  }, [state.present, state.loaded, projectId])

  // Flush any save still debouncing when this hook unmounts - otherwise a change made
  // just before navigating away (e.g. calibrating scale, then jumping straight to AR)
  // gets silently dropped instead of written.
  useEffect(() => {
    return () => {
      window.clearTimeout(saveTimer.current)
      pendingSaveRef.current?.()
    }
  }, [])

  const change = useCallback(
    (update: (d: Drawing) => Drawing, record = true) => dispatch({ type: 'change', update, record }),
    [],
  )

  const actions = useMemo(
    () => ({
      checkpoint: () => dispatch({ type: 'checkpoint' }),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      setBackground: (background: DrawingBackground) => change((d) => ({ ...d, background })),
      setScale: (metresPerPx: number) => change((d) => ({ ...d, metresPerPx })),
      addComponent: (component: PlacedComponent) =>
        change((d) => ({ ...d, components: [...d.components, component] })),
      // Moves are not recorded individually; call checkpoint() when a drag starts.
      moveComponent: (id: string, x: number, y: number) =>
        change(
          (d) => ({ ...d, components: d.components.map((c) => (c.id === id ? { ...c, x, y } : c)) }),
          false,
        ),
      updateComponent: (id: string, patch: Partial<PlacedComponent>) =>
        change((d) => ({
          ...d,
          components: d.components.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      addWire: (wire: Wire) => change((d) => ({ ...d, wires: [...d.wires, wire] })),
      updateWire: (id: string, patch: Partial<Wire>) =>
        change((d) => ({ ...d, wires: d.wires.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
      removeComponent: (id: string) =>
        change((d) => ({
          ...d,
          components: d.components.filter((c) => c.id !== id),
          wires: d.wires.filter((w) => w.fromId !== id && w.toId !== id),
        })),
      removeWire: (id: string) => change((d) => ({ ...d, wires: d.wires.filter((w) => w.id !== id) })),
    }),
    [change],
  )

  return {
    drawing: state.present,
    loaded: state.loaded,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    ...actions,
  }
}

export type DrawingStore = ReturnType<typeof useDrawing>
