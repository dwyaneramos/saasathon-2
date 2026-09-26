import { Fragment, useState, type ReactNode } from 'react'
import {
  CABLE_TYPE_OPTIONS,
  CORE_COLOUR_OPTIONS,
  CORE_OPTIONS,
  INSTALL_METHOD_OPTIONS,
  fetchDocumentCableEntries,
  newCableRow,
  rowFromEntry,
  type CableRow,
  type CableVoltage,
  type CoreAllocation,
  type ProtectiveDevice,
  type SaveStatus,
} from '../../lib/cableSchedule'

interface CableScheduleEditorProps {
  projectId: string
  rows: CableRow[]
  setRows: (update: (rows: CableRow[]) => CableRow[]) => void
  loaded: boolean
  loadError: string | null
  saveStatus: SaveStatus
  saveError: string | null
}

const cellInput =
  'w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-[#1a1a1a] outline-none hover:border-black/15 focus:border-[#E3350D] focus:bg-white'
const missingInput = 'border-[#E3350D]/40 bg-[#E3350D]/5'
const th = 'border border-black/10 px-1.5 py-1 font-semibold'
const td = 'border border-black/10 p-0.5 align-top'
const button =
  'rounded-full border-2 border-[#1a1a1a] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-black/5 disabled:opacity-40'

// AS/NZS 3000 colours for a fresh core allocation, based on the cable's core arrangement.
function standardCores(cores: string): CoreAllocation[] {
  const earth = { core: 'E', colour: 'Green/yellow', from: '', to: '', function: 'Protective earth' }
  const core = (n: string, colour: string, fn: string) => ({ core: n, colour, from: '', to: '', function: fn })
  switch (cores) {
    case '2C+E':
    case 'Twin':
      return [core('1', 'Red', 'Active'), core('2', 'Black', 'Neutral'), earth]
    case '3C+E':
      return [core('1', 'Red', 'Active L1'), core('2', 'White', 'Active L2'), core('3', 'Blue', 'Active L3'), earth]
    case '4C+E':
      return [
        core('1', 'Red', 'Active L1'),
        core('2', 'White', 'Active L2'),
        core('3', 'Blue', 'Active L3'),
        core('4', 'Black', 'Neutral'),
        earth,
      ]
    default: {
      const count = Number.parseInt(cores, 10) || 2
      return Array.from({ length: count }, (_, i) => core(String(i + 1), '', ''))
    }
  }
}

function missingFields(row: CableRow): Set<keyof CableRow> {
  const missing = new Set<keyof CableRow>()
  if (!row.cableNo.trim()) missing.add('cableNo')
  if (!row.from.trim()) missing.add('from')
  if (!row.to.trim()) missing.add('to')
  if (row.sizeMm2 === null) missing.add('sizeMm2')
  if (row.lengthM === null) missing.add('lengthM')
  if (!row.installMethod) missing.add('installMethod')
  if (row.voltage !== 'ELV' && row.protectionA === null) missing.add('protectionA')
  return missing
}

function TextCell(props: {
  value: string
  onChange: (value: string) => void
  missing?: boolean
  list?: string
  placeholder?: string
  label: string
}) {
  return (
    <input
      aria-label={props.label}
      className={`${cellInput} ${props.missing ? missingInput : ''}`}
      value={props.value}
      list={props.list}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  )
}

function NumberCell(props: {
  value: number | null
  onChange: (value: number | null) => void
  missing?: boolean
  step?: number
  label: string
}) {
  return (
    <input
      aria-label={props.label}
      type="number"
      min={0}
      step={props.step ?? 'any'}
      className={`${cellInput} text-right ${props.missing ? missingInput : ''}`}
      value={props.value ?? ''}
      onChange={(e) => {
        const n = Number.parseFloat(e.target.value)
        props.onChange(Number.isFinite(n) && n >= 0 ? n : null)
      }}
    />
  )
}

function SelectCell<T extends string>(props: {
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  missing?: boolean
  label: string
  render?: (value: T) => ReactNode
}) {
  return (
    <select
      aria-label={props.label}
      className={`${cellInput} ${props.missing ? missingInput : ''}`}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value as T)}
    >
      {props.options.map((o) => (
        <option key={o} value={o}>
          {props.render ? props.render(o) : o}
        </option>
      ))}
    </select>
  )
}

function CableScheduleEditor({ projectId, rows, setRows, loaded, loadError, saveStatus, saveError }: CableScheduleEditorProps) {
  const [openCores, setOpenCores] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const update = (id: string, patch: Partial<CableRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const updateCore = (id: string, index: number, patch: Partial<CoreAllocation>) =>
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? { ...r, coreAllocation: r.coreAllocation.map((c, i) => (i === index ? { ...c, ...patch } : c)) }
          : r,
      ),
    )

  function addCable(group: string) {
    const row = newCableRow(group)
    setRows((rs) => {
      // Insert after the last cable in the same section so sections stay together.
      const last = rs.map((r) => r.group).lastIndexOf(group)
      return last === -1 ? [...rs, row] : [...rs.slice(0, last + 1), row, ...rs.slice(last + 1)]
    })
  }

  function addSection() {
    const name = window.prompt('Section name (e.g. "DB1 - Level 2" or "Belt conveyor 1"):')?.trim()
    if (name) addCable(name)
  }

  function renameSection(from: string, to: string) {
    setRows((rs) => rs.map((r) => (r.group === from ? { ...r, group: to } : r)))
  }

  function removeCable(row: CableRow) {
    if (window.confirm(`Delete cable ${row.cableNo || '(unnamed)'} from the schedule?`)) {
      setRows((rs) => rs.filter((r) => r.id !== row.id))
    }
  }

  function toggleCores(row: CableRow) {
    setOpenCores((open) => {
      const next = new Set(open)
      if (next.has(row.id)) next.delete(row.id)
      else next.add(row.id)
      return next
    })
    if (row.coreAllocation.length === 0) update(row.id, { coreAllocation: standardCores(row.cores) })
  }

  async function importFromDocuments() {
    setImporting(true)
    setMessage(null)
    try {
      const entries = await fetchDocumentCableEntries(projectId)
      const existing = new Set(rows.map((r) => r.cableNo.trim().toLowerCase()).filter(Boolean))
      const fresh = entries.filter((e) => !existing.has(e.ref.trim().toLowerCase()))
      if (fresh.length > 0) setRows((rs) => [...rs, ...fresh.map(rowFromEntry)])
      setMessage(
        entries.length === 0
          ? 'No cables or circuits found in the uploaded documents.'
          : `Imported ${fresh.length} cable${fresh.length === 1 ? '' : 's'}` +
              (entries.length > fresh.length ? `, skipped ${entries.length - fresh.length} already in the schedule.` : '.') +
              ' Check each imported row against the source document.',
      )
    } catch (err) {
      setMessage(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImporting(false)
    }
  }

  const incomplete = rows.filter((r) => missingFields(r).size > 0).length
  const totalLength = rows.reduce((sum, r) => sum + (r.lengthM ?? 0), 0)
  const saveLabel: Record<SaveStatus, string> = { idle: '', saving: 'Saving…', saved: 'All changes saved', error: 'Not saved' }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-black/10 bg-black/[0.03] p-6 font-[DM_Sans]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1a1a1a]">Cable schedule</h2>
          <p className="text-xs text-black/50">
            {rows.length} cable{rows.length === 1 ? '' : 's'} · {Math.round(totalLength * 10) / 10} m total
            {incomplete > 0 && <span className="text-[#E3350D]"> · {incomplete} incomplete</span>}
            {saveStatus !== 'idle' && (
              <span className={saveStatus === 'error' ? 'text-[#E3350D]' : ''}> · {saveLabel[saveStatus]}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={!loaded || !!loadError || importing} onClick={() => void importFromDocuments()}>
            {importing ? 'Importing…' : 'Import from documents'}
          </button>
          <button type="button" className={button} disabled={!loaded || !!loadError} onClick={addSection}>
            Add section
          </button>
          <button
            type="button"
            className="rounded-full bg-[#FFCC00] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-[#E3350D] hover:text-white disabled:opacity-40"
            disabled={!loaded || !!loadError}
            onClick={() => addCable(rows.at(-1)?.group ?? '')}
          >
            Add cable
          </button>
        </div>
      </div>

      {loadError && (
        <p className="rounded-lg border border-[#E3350D]/30 bg-[#E3350D]/5 p-3 text-sm text-[#E3350D]">
          Couldn't load the cable schedule: {loadError}
        </p>
      )}
      {saveError && saveStatus === 'error' && <p className="text-xs text-[#E3350D]">Save failed: {saveError}</p>}
      {message && <p className="text-xs text-black/60">{message}</p>}

      {!loaded ? (
        <p className="text-sm text-black/50">Loading cable schedule…</p>
      ) : rows.length === 0 && !loadError ? (
        <p className="text-sm text-black/50">
          No cables yet. Add one, or import what the uploaded documents list and edit from there.
        </p>
      ) : (
        rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] border-collapse text-xs text-[#1a1a1a]">
              <thead className="bg-[#1a7a3d]/10 text-[10px] uppercase tracking-wide text-black/70">
                <tr>
                  <th className={th} rowSpan={2}>
                    No.
                  </th>
                  <th className={th} rowSpan={2}>
                    Cable no.
                  </th>
                  <th className={th} colSpan={2}>
                    Equipment designation
                  </th>
                  <th className={th} colSpan={5}>
                    Cable
                  </th>
                  <th className={th} rowSpan={2}>
                    Route
                  </th>
                  <th className={th} rowSpan={2}>
                    Length (m)
                  </th>
                  <th className={th} colSpan={4}>
                    Supply &amp; protection
                  </th>
                  <th className={th} rowSpan={2}>
                    Application
                  </th>
                  <th className={th} rowSpan={2}>
                    Cores
                  </th>
                  <th className={th} rowSpan={2}>
                    <span className="sr-only">Delete</span>
                  </th>
                </tr>
                <tr>
                  <th className={th}>From</th>
                  <th className={th}>To</th>
                  <th className={th}>Type</th>
                  <th className={th}>Cores</th>
                  <th className={th}>Size (mm²)</th>
                  <th className={th}>Earth (mm²)</th>
                  <th className={th}>Installation method</th>
                  <th className={th}>Voltage</th>
                  <th className={th}>Rating (A)</th>
                  <th className={th}>Device</th>
                  <th className={th}>RCD 30 mA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const missing = missingFields(row)
                  const newSection = i === 0 || rows[i - 1]!.group !== row.group
                  const coresOpen = openCores.has(row.id)
                  return (
                    <Fragment key={row.id}>
                      {newSection && (
                        <tr className="bg-[#FFCC00]">
                          <td colSpan={18} className="border border-black/10 px-2 py-1">
                            <div className="flex items-center gap-2">
                              <input
                                aria-label="Section name"
                                className="flex-1 bg-transparent text-xs font-semibold uppercase tracking-wide text-[#1a1a1a] outline-none"
                                placeholder="Unnamed section"
                                value={row.group}
                                onChange={(e) => renameSection(row.group, e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => addCable(row.group)}
                                className="text-[10px] font-semibold uppercase tracking-wide text-[#1a1a1a] hover:underline"
                              >
                                + Cable in section
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr className="bg-white">
                        <td className={`${td} px-1.5 py-1 text-center text-black/50`}>{i + 1}</td>
                        <td className={`${td} min-w-28`}>
                          <TextCell label="Cable no." value={row.cableNo} missing={missing.has('cableNo')} placeholder="e.g. C1" onChange={(v) => update(row.id, { cableNo: v })} />
                        </td>
                        <td className={`${td} min-w-32`}>
                          <TextCell label="From" value={row.from} missing={missing.has('from')} placeholder="e.g. DB1" onChange={(v) => update(row.id, { from: v })} />
                        </td>
                        <td className={`${td} min-w-32`}>
                          <TextCell label="To" value={row.to} missing={missing.has('to')} onChange={(v) => update(row.id, { to: v })} />
                        </td>
                        <td className={`${td} min-w-28`}>
                          <TextCell label="Cable type" value={row.cableType} list="cable-type-options" onChange={(v) => update(row.id, { cableType: v })} />
                        </td>
                        <td className={`${td} w-20`}>
                          <TextCell label="Cores" value={row.cores} list="core-options" onChange={(v) => update(row.id, { cores: v })} />
                        </td>
                        <td className={`${td} w-20`}>
                          <NumberCell label="Size (mm²)" value={row.sizeMm2} missing={missing.has('sizeMm2')} onChange={(v) => update(row.id, { sizeMm2: v })} />
                        </td>
                        <td className={`${td} w-20`}>
                          <NumberCell label="Earth (mm²)" value={row.earthMm2} onChange={(v) => update(row.id, { earthMm2: v })} />
                        </td>
                        <td className={`${td} min-w-40`}>
                          <SelectCell
                            label="Installation method"
                            value={row.installMethod}
                            options={['', ...INSTALL_METHOD_OPTIONS]}
                            render={(o) => o || 'Select…'}
                            missing={missing.has('installMethod')}
                            onChange={(v) => update(row.id, { installMethod: v })}
                          />
                        </td>
                        <td className={`${td} min-w-28`}>
                          <TextCell label="Route" value={row.route} placeholder="e.g. Tray T1" onChange={(v) => update(row.id, { route: v })} />
                        </td>
                        <td className={`${td} w-20`}>
                          <NumberCell label="Length (m)" value={row.lengthM} missing={missing.has('lengthM')} onChange={(v) => update(row.id, { lengthM: v })} />
                        </td>
                        <td className={`${td} w-20`}>
                          <SelectCell<CableVoltage> label="Voltage" value={row.voltage} options={['230 V', '400 V', 'ELV']} onChange={(v) => update(row.id, { voltage: v })} />
                        </td>
                        <td className={`${td} w-20`}>
                          <NumberCell label="Protection rating (A)" value={row.protectionA} missing={missing.has('protectionA')} step={1} onChange={(v) => update(row.id, { protectionA: v })} />
                        </td>
                        <td className={`${td} w-20`}>
                          <SelectCell<ProtectiveDevice>
                            label="Protective device"
                            value={row.device}
                            options={['', 'MCB', 'RCBO', 'Fuse']}
                            render={(o) => o || '—'}
                            onChange={(v) => update(row.id, { device: v })}
                          />
                        </td>
                        <td className={`${td} text-center`}>
                          <input
                            aria-label="RCD protected (30 mA)"
                            type="checkbox"
                            className="mt-1.5 accent-[#E3350D]"
                            checked={row.rcd || row.device === 'RCBO'}
                            disabled={row.device === 'RCBO'}
                            title={row.device === 'RCBO' ? 'An RCBO includes RCD protection' : undefined}
                            onChange={(e) => update(row.id, { rcd: e.target.checked })}
                          />
                        </td>
                        <td className={`${td} min-w-48`}>
                          <TextCell label="Application" value={row.application} placeholder="e.g. Kitchen power" onChange={(v) => update(row.id, { application: v })} />
                        </td>
                        <td className={`${td} text-center`}>
                          <button
                            type="button"
                            onClick={() => toggleCores(row)}
                            aria-expanded={coresOpen}
                            className="px-1.5 py-1 text-[11px] font-semibold text-black/60 hover:text-black"
                          >
                            {coresOpen ? '▾' : '▸'} {row.coreAllocation.length || ''}
                          </button>
                        </td>
                        <td className={`${td} text-center`}>
                          <button
                            type="button"
                            aria-label={`Delete cable ${row.cableNo}`}
                            onClick={() => removeCable(row)}
                            className="px-1.5 py-1 text-black/40 hover:text-[#E3350D]"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                      {coresOpen && (
                        <tr>
                          <td className="border border-black/10" />
                          <td colSpan={17} className="border border-black/10 bg-black/[0.02] p-2">
                            <table className="border-collapse text-xs">
                              <thead className="text-[10px] uppercase tracking-wide text-black/60">
                                <tr>
                                  <th className={th}>Core</th>
                                  <th className={th}>Colour</th>
                                  <th className={th}>From terminal</th>
                                  <th className={th}>To terminal</th>
                                  <th className={th}>Function</th>
                                  <th className={th}>
                                    <span className="sr-only">Remove</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.coreAllocation.map((core, ci) => (
                                  <tr key={ci} className="bg-white">
                                    <td className={`${td} w-16`}>
                                      <TextCell label="Core" value={core.core} onChange={(v) => updateCore(row.id, ci, { core: v })} />
                                    </td>
                                    <td className={`${td} w-32`}>
                                      <TextCell label="Colour" value={core.colour} list="core-colour-options" onChange={(v) => updateCore(row.id, ci, { colour: v })} />
                                    </td>
                                    <td className={`${td} w-32`}>
                                      <TextCell label="From terminal" value={core.from} onChange={(v) => updateCore(row.id, ci, { from: v })} />
                                    </td>
                                    <td className={`${td} w-32`}>
                                      <TextCell label="To terminal" value={core.to} onChange={(v) => updateCore(row.id, ci, { to: v })} />
                                    </td>
                                    <td className={`${td} w-64`}>
                                      <TextCell label="Function" value={core.function} onChange={(v) => updateCore(row.id, ci, { function: v })} />
                                    </td>
                                    <td className={`${td} text-center`}>
                                      <button
                                        type="button"
                                        aria-label={`Remove core ${core.core}`}
                                        onClick={() =>
                                          update(row.id, { coreAllocation: row.coreAllocation.filter((_, j) => j !== ci) })
                                        }
                                        className="px-1.5 py-1 text-black/40 hover:text-[#E3350D]"
                                      >
                                        ×
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="mt-2 flex gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  update(row.id, {
                                    coreAllocation: [
                                      ...row.coreAllocation,
                                      { core: String(row.coreAllocation.length + 1), colour: '', from: '', to: '', function: '' },
                                    ],
                                  })
                                }
                                className="text-[11px] font-semibold text-black/60 hover:text-black hover:underline"
                              >
                                + Add core
                              </button>
                              <button
                                type="button"
                                onClick={() => update(row.id, { coreAllocation: standardCores(row.cores) })}
                                className="text-[11px] font-semibold text-black/60 hover:text-black hover:underline"
                              >
                                Reset to standard colours for {row.cores || 'this cable'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      <datalist id="cable-type-options">
        {CABLE_TYPE_OPTIONS.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <datalist id="core-options">
        {CORE_OPTIONS.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <datalist id="core-colour-options">
        {CORE_COLOUR_OPTIONS.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      <p className="text-[10px] text-black/40">
        Red cells are required for a complete schedule. Core colours follow AS/NZS 3000 (active red or brown, neutral
        black or light blue, earth green/yellow). The compliance section checks mains cables here against AS/NZS 3000
        and AS/NZS 3008.1.2 using indicative values; the electrical designer must confirm sizing and sign off.
      </p>
    </section>
  )
}

export default CableScheduleEditor
