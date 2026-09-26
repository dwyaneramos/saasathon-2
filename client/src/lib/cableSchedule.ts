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

// ---- Editable cable schedule (saved per project in Supabase) ----

export type CableVoltage = '230 V' | '400 V' | 'ELV'
export type ProtectiveDevice = '' | 'MCB' | 'RCBO' | 'Fuse'

/** One core of a multicore cable and where it lands at each end. */
export interface CoreAllocation {
  core: string
  colour: string
  from: string
  to: string
  function: string
}

/** Mirrors the CableRow schema in server/src/routes/cable-schedule.ts. */
export interface CableRow {
  id: string
  /** Section heading the row sits under, e.g. "Belt conveyor 1" or "DB1 - Level 2". */
  group: string
  cableNo: string
  from: string
  to: string
  cableType: string
  cores: string
  sizeMm2: number | null
  earthMm2: number | null
  /** AS/NZS 3008.1.2 installation method, which the cable's current rating depends on. */
  installMethod: string
  route: string
  lengthM: number | null
  voltage: CableVoltage
  protectionA: number | null
  device: ProtectiveDevice
  rcd: boolean
  application: string
  coreAllocation: CoreAllocation[]
}

export const CABLE_TYPE_OPTIONS = ['TPS', 'PVC/PVC', 'XLPE/PVC', 'SWA (steel wire armoured)', 'Flexible cord', 'Screened instrumentation']
export const CORE_OPTIONS = ['2C+E', '3C+E', '4C', '4C+E', '1C', 'Twin', 'Pair']
export const INSTALL_METHOD_OPTIONS = [
  'Unenclosed - clipped direct',
  'Enclosed in conduit',
  'On cable tray / ladder',
  'In thermal insulation',
  'Buried direct',
  'In underground conduit',
]
// AS/NZS 3000 core colours: active red (or brown), neutral black (or light blue), earth green/yellow.
export const CORE_COLOUR_OPTIONS = ['Red', 'White', 'Blue', 'Brown', 'Black', 'Light blue', 'Grey', 'Green/yellow']

export function newCableRow(group = ''): CableRow {
  return {
    id: crypto.randomUUID(),
    group,
    cableNo: '',
    from: '',
    to: '',
    cableType: 'TPS',
    cores: '2C+E',
    sizeMm2: null,
    earthMm2: null,
    installMethod: '',
    route: '',
    lengthM: null,
    voltage: '230 V',
    protectionA: null,
    device: 'MCB',
    rcd: false,
    application: '',
    coreAllocation: [],
  }
}

/** Starts a row from a document-derived entry, keeping only what the document stated. */
export function rowFromEntry(entry: CableScheduleEntry): CableRow {
  const printedType = entry.cableType?.replace(/\s*\d+(?:\.\d+)?\s*(?:mm\s*(?:2|²|sq)?|sq\s*mm)\s*/i, ' ').trim()
  return {
    ...newCableRow(),
    group: entry.sourceFile,
    cableNo: entry.ref,
    from: entry.from ?? '',
    to: entry.to ?? '',
    cableType: printedType || entry.cableType || '',
    cores: '',
    sizeMm2: entry.sizeMm2,
    lengthM: entry.lengthM,
    voltage: entry.phase === '3' ? '400 V' : '230 V',
    protectionA: entry.protectionA,
    device: '',
    application: entry.description ?? '',
  }
}

/** Mains cables in the shape the compliance rules read (an extracted document). ELV is skipped. */
export function rowsToComplianceDocument(rows: CableRow[]) {
  const mains = rows.filter((r) => r.voltage !== 'ELV' && r.cableNo.trim())
  return {
    source_file: 'Cable schedule',
    circuits: mains.map((r) => ({
      circuit_id: r.cableNo,
      description: r.application,
      load_type: r.application,
      phase: r.voltage === '400 V' ? '3' : '1',
      rated_current_a: r.protectionA,
      rcd_protected: r.rcd || r.device === 'RCBO',
    })),
    cable_schedule_rows: mains.map((r) => ({
      cable_id: r.cableNo,
      from_ref: r.from,
      to_ref: r.to,
      cable_type: r.sizeMm2 !== null ? `${r.cableType} ${r.sizeMm2}mm2` : r.cableType,
      length_m: r.lengthM,
    })),
  }
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_DELAY_MS = 800

export function useCableScheduleRows(projectId: string) {
  const [rows, setRowsState] = useState<CableRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/projects/${projectId}/cable-schedule/saved`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error ?? `request failed (${res.status})`)
        if (!cancelled) setRowsState(body.rows as CableRow[])
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  // Debounced auto-save after edits. Never saves before the first load, so a failed load
  // can't overwrite the stored schedule with an empty one.
  useEffect(() => {
    if (!dirty || !loaded || loadError) return
    const timer = window.setTimeout(async () => {
      setSaveStatus('saving')
      try {
        const res = await fetch(`/api/projects/${projectId}/cable-schedule/saved`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error ?? `request failed (${res.status})`)
        setDirty(false)
        setSaveStatus('saved')
        setSaveError(null)
      } catch (err) {
        setSaveStatus('error')
        setSaveError(err instanceof Error ? err.message : String(err))
      }
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [rows, dirty, loaded, loadError, projectId])

  const setRows = useCallback((update: (rows: CableRow[]) => CableRow[]) => {
    setRowsState(update)
    setDirty(true)
  }, [])

  return { rows, setRows, loaded, loadError, saveStatus, saveError }
}

export async function fetchDocumentCableEntries(projectId: string): Promise<CableScheduleEntry[]> {
  const res = await fetch(`/api/projects/${projectId}/cable-schedule`)
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error ?? `request failed (${res.status})`)
  return body.entries as CableScheduleEntry[]
}
