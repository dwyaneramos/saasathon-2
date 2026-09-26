import { useState } from 'react'
import {
  buildChecklist,
  formatBytes,
  formatSheetDate,
  SHEET_TYPES,
  SHEET_TYPE_LABEL,
  type SheetType,
} from '../../data/sheets'
import { useSheetSet, type SheetSet } from '../../lib/sheets'

const labelClass = 'font-[DM_Sans] text-xs uppercase tracking-wide text-black/50'
const inputClass =
  'rounded-lg border border-black/10 bg-black/[0.03] px-3 py-2 font-[DM_Sans] text-sm text-[#1a1a1a] outline-none transition-colors focus:border-[#E3350D] focus:bg-white'

interface SheetUploaderProps {
  onAdd: (file: File, sheetType: SheetType) => Promise<boolean>
  busy: boolean
  defaultType?: SheetType
}

/** One sheet per submit. The set is assembled piece by piece so nothing is half-tagged. */
function SheetUploader({ onAdd, busy, defaultType }: SheetUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [sheetType, setSheetType] = useState<SheetType>(defaultType ?? 'power_plan')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!file) return
    // Clear before awaiting: a sheet can be revisited and replaced, and a filename left in
    // the input reads as "already added" when it may not have been.
    const submitted = file
    setFile(null)
    // Restore it if the upload failed, so a retry doesn't mean re-picking the file.
    if (!(await onAdd(submitted, sheetType))) setFile(submitted)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-48 flex-col gap-1.5">
        <label className={labelClass} htmlFor="sheet-file">
          Sheet file
        </label>
        <input
          id="sheet-file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="font-[DM_Sans] text-xs"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="sheet-type">
          Sheet type
        </label>
        <select
          id="sheet-type"
          value={sheetType}
          onChange={(e) => setSheetType(e.target.value as SheetType)}
          className={inputClass}
        >
          {SHEET_TYPES.map((type) => (
            <option key={type} value={type}>
              {SHEET_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={!file || busy}
        className="rounded-full bg-[#FFCC00] px-5 py-2 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-[#E3350D] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Saving…' : 'Add sheet'}
      </button>
    </form>
  )
}

interface SetupPanelProps {
  projectId: string
  /** Off when the panel is embedded as step 2 of job creation, where the CTA lives on the page. */
  showProcessAction?: boolean
  /**
   * Passed in by the workspace so the gate and this panel read the same copy - a second
   * `useSheetSet` here would leave the gate stale until a reload.
   */
  sheetSet?: SheetSet
}

function SetupPanel({ projectId, showProcessAction = true, sheetSet }: SetupPanelProps) {
  const ownSheetSet = useSheetSet(projectId)
  const { sheets, loaded, busy, error, addSheet, removeSheet, processSet } = sheetSet ?? ownSheetSet
  const checklist = buildChecklist(sheets)
  const [focused, setFocused] = useState<SheetType | null>(null)

  // Default the picker to the first outstanding required type, so the common case is
  // pick-file-submit with no dropdown interaction at all.
  const suggested = focused ?? checklist.missing[0] ?? 'lighting_rcp_plan'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-[DM_Sans] text-lg font-semibold text-[#1a1a1a]">Drawing set</h2>
        <p className="max-w-2xl font-[DM_Sans] text-sm text-black/60">
          A job is built from its drawing set, not a form. Add one sheet at a time and tag what it
          is - each is saved as you go and can be replaced later. Cross-referencing stays locked
          until the set is complete.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-[#E3350D]/30 bg-[#E3350D]/5 p-4 font-[DM_Sans] text-sm text-[#E3350D]">
          {error}
        </p>
      )}

      <SheetUploader key={suggested} onAdd={addSheet} busy={busy} defaultType={suggested} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={labelClass}>
            {checklist.complete
              ? 'Set complete'
              : `Missing ${checklist.missing.length} required sheet${
                  checklist.missing.length === 1 ? '' : 's'
                }`}
          </span>
          {checklist.unprocessed > 0 && (
            <span className="font-[DM_Sans] text-xs text-black/50">
              {checklist.unprocessed} not yet processed
            </span>
          )}
        </div>

        <ul className="flex flex-col gap-2">
          {checklist.items.map((item) => {
            const satisfied = item.sheets.length > 0
            return (
              <li
                key={item.sheetType}
                className={`flex flex-col gap-2 rounded-lg border p-4 ${
                  item.required && !satisfied
                    ? 'border-[#E3350D]/40 bg-[#E3350D]/5'
                    : 'border-black/10 bg-black/[0.03]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-[DM_Sans] text-sm font-semibold text-[#1a1a1a]">
                      {item.label}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-[DM_Sans] text-[10px] font-semibold uppercase tracking-wide ${
                        item.required ? 'bg-[#FFCC00]/40 text-[#1a1a1a]' : 'bg-black/10 text-black/50'
                      }`}
                    >
                      {item.required ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  {item.required && !satisfied && (
                    <button
                      type="button"
                      onClick={() => setFocused(item.sheetType)}
                      className="font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-[#E3350D] underline-offset-2 hover:underline"
                    >
                      Add this
                    </button>
                  )}
                </div>

                <p className="font-[DM_Sans] text-xs text-black/60">{item.hint}</p>

                {item.sheets.map((sheet) => (
                  <div
                    key={sheet.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-black/10 bg-white px-3 py-2"
                  >
                    <span className="font-[DM_Sans] text-xs text-[#1a1a1a]">{sheet.source_file}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-[DM_Sans] text-[10px] text-black/50">
                        {formatBytes(sheet.size_bytes)} · {formatSheetDate(sheet.created_at)}
                        {sheet.status === 'intake' ? ' · not processed' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeSheet(sheet.id)}
                        disabled={busy}
                        className="font-[DM_Sans] text-[10px] font-semibold uppercase tracking-wide text-black/50 underline-offset-2 hover:text-[#E3350D] hover:underline disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                ))}
              </li>
            )
          })}
        </ul>
      </div>

      {showProcessAction && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void processSet()}
            disabled={!checklist.complete || busy || checklist.unprocessed === 0}
            className="self-start rounded-full bg-[#FFCC00] px-5 py-2 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-[#E3350D] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Processing…' : 'Process drawing set'}
          </button>
          {!checklist.complete ? (
            <p className="font-[DM_Sans] text-xs text-black/50">
              Locked until the set is complete - still needs{' '}
              {checklist.missing.map((t) => SHEET_TYPE_LABEL[t]).join(', ')}.
            </p>
          ) : checklist.unprocessed === 0 ? (
            <p className="font-[DM_Sans] text-xs text-black/50">
              Every sheet in this set has been processed. Add another sheet to re-run it.
            </p>
          ) : null}
        </div>
      )}

      {!loaded && <p className="font-[DM_Sans] text-sm text-black/50">Loading drawing set…</p>}
    </div>
  )
}

export default SetupPanel
export { SheetUploader }
