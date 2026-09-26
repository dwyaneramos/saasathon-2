import { useRef, useState } from 'react'
import { ACCEPTED_FILE_TYPES, BLANK_SHEET, loadDrawingFile } from '../../lib/loadDrawingFile'
import type { DrawingBackground } from '../../types/drawing'

interface UploadDropzoneProps {
  onLoaded: (background: DrawingBackground) => void
}

function UploadDropzone({ onLoaded }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onLoaded(await loadDrawingFile(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        void handleFile(e.dataTransfer.files[0])
      }}
      className={`flex h-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 text-center font-[DM_Sans] transition-colors ${
        dragging ? 'border-[#E3350D] bg-[#FFCC00]/15' : 'border-black/20'
      }`}
    >
      <p className="text-lg font-semibold text-[#1a1a1a]">Upload an electrical drawing</p>
      <p className="max-w-sm text-sm text-black/60">
        Drop a floor plan, design or site sketch here (PNG, JPG or PDF), then mark up sockets, switches,
        lights and cable runs on top of it.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-full bg-[#FFCC00] px-5 py-2 text-xs font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-[#E3350D] hover:text-white disabled:opacity-50"
        >
          {busy ? 'Loading…' : 'Choose file'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onLoaded(BLANK_SHEET)}
          className="rounded-full border-2 border-[#1a1a1a] px-5 py-2 text-xs font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-black/5 disabled:opacity-50"
        >
          Blank sheet
        </button>
      </div>
      {error && <p className="text-sm text-[#E3350D]">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default UploadDropzone
