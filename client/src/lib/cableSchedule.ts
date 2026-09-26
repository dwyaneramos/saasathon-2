import { useCallback, useEffect, useState } from 'react'

/** Mirrors server/src/pipeline/cableSchedule.ts. Every value is copied from an uploaded document. */
export interface CableScheduleEntry {
  ref: string
  circuit: string | null
  description: string | null
  from: string | null
  to: string | null
  cableType: string | null
  sizeMm2: number | null
  lengthM: number | null
  lengthEstimated: boolean
  protectionA: number | null
  phase: '1' | '2' | '3' | null
  sourceFile: string
  missing: string[]
  verify: string[]
}

interface CableScheduleState {
  entries: CableScheduleEntry[]
  documentCount: number
  loading: boolean
  error: string | null
}

export function useCableSchedule(projectId: string) {
  const [state, setState] = useState<CableScheduleState>({ entries: [], documentCount: 0, loading: true, error: null })

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/cable-schedule`)
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? `request failed (${res.status})`)
      setState({ entries: body.entries, documentCount: body.documentCount, loading: false, error: null })
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : String(err) }))
    }
  }, [projectId])

  // Initial state is already "loading", so the first fetch doesn't need to set it.
  useEffect(() => {
    void load()
  }, [load])

  function refresh() {
    setState((s) => ({ ...s, loading: true, error: null }))
    return load()
  }

  return { ...state, refresh }
}
