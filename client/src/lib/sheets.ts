import { useCallback, useEffect, useState } from 'react'
import type { JobSheet, SheetSetResponse, SheetType } from '../data/sheets'

export interface SheetSet {
  sheets: JobSheet[]
  loaded: boolean
  busy: boolean
  error: string | null
  refresh: () => Promise<SheetSetResponse | null>
  addSheet: (file: File, sheetType: SheetType) => Promise<boolean>
  removeSheet: (sheetId: string) => Promise<boolean>
  processSet: () => Promise<boolean>
}

async function errorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null)
  return body?.error ?? `request failed (${res.status})`
}

/**
 * Loads and mutates a project's drawing set. Call this once and pass the result down, rather
 * than calling it from several components: two independent copies would each hold their own
 * state, and adding the last required sheet wouldn't unlock the workspace gate until a reload.
 */
export function useSheetSet(projectId: string): SheetSet {
  const [sheets, setSheets] = useState<JobSheet[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) {
      setLoaded(true)
      return null
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/sheets`)
      if (!res.ok) throw new Error(await errorMessage(res))
      const body = (await res.json()) as SheetSetResponse
      setSheets(body.sheets)
      return body
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      setLoaded(true)
    }
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** One sheet per submit - a set is assembled piece by piece, not in a single batch. */
  const addSheet = useCallback(
    async (file: File, sheetType: SheetType) => {
      setBusy(true)
      setError(null)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('sheet_type', sheetType)
        const res = await fetch(`/api/projects/${projectId}/sheets`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) throw new Error(await errorMessage(res))
        await refresh()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return false
      } finally {
        setBusy(false)
      }
    },
    [projectId, refresh],
  )

  const removeSheet = useCallback(
    async (sheetId: string) => {
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/projects/${projectId}/sheets/${sheetId}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(await errorMessage(res))
        await refresh()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return false
      } finally {
        setBusy(false)
      }
    },
    [projectId, refresh],
  )

  const processSet = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/sheets/process`, { method: 'POST' })
      if (!res.ok) throw new Error(await errorMessage(res))
      await refresh()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setBusy(false)
    }
  }, [projectId, refresh])

  return { sheets, loaded, busy, error, refresh, addSheet, removeSheet, processSet }
}
