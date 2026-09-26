import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Project } from '../lib/projects'

const labelClass = 'font-[DM_Sans] text-xs uppercase tracking-wide text-black/50'
const inputClass =
  'w-full rounded-md border border-black/15 bg-white px-3 py-2 font-[DM_Sans] text-sm text-[#1a1a1a] focus:border-[#1a1a1a] focus:outline-none'
const primaryButton =
  'rounded-full bg-[#FFCC00] px-5 py-2 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-[#E3350D] hover:text-white disabled:opacity-50'
const secondaryButton =
  'rounded-full px-4 py-2 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-black/60 hover:text-black disabled:opacity-50'

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex w-full max-w-md flex-col gap-5 rounded-2xl border-2 border-[#1a1a1a] bg-white p-6 shadow-[0_6px_0_0_rgba(26,26,26,0.15)]"
      >
        <h2 className="font-[DM_Sans] text-xl font-bold text-[#1a1a1a]">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md bg-[#E3350D]/10 px-3 py-2 font-[DM_Sans] text-sm text-[#E3350D]">
      {message}
    </p>
  )
}

interface EditProjectDialogProps {
  project: Project
  onCancel: () => void
  onSave: (details: { name: string; description: string }) => Promise<void>
}

export function EditProjectDialog({ project, onCancel, onSave }: EditProjectDialogProps) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return setError('Give the project a name.')
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: trimmedName, description: description.trim() })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
      setSaving(false)
    }
  }

  return (
    <Dialog title="Edit project" onClose={saving ? () => {} : onCancel}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Name</span>
          <input
            autoFocus
            value={name}
            maxLength={120}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Description</span>
          <textarea
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={`resize-none ${inputClass}`}
          />
        </label>
        <ErrorText message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

interface DeleteProjectDialogProps {
  project: Project
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export function DeleteProjectDialog({ project, onCancel, onConfirm }: DeleteProjectDialogProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await onConfirm()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError))
      setDeleting(false)
    }
  }

  return (
    <Dialog title="Delete project?" onClose={deleting ? () => {} : onCancel}>
      <p className="font-[DM_Sans] text-sm leading-relaxed text-[#1a1a1a]/80">
        <span className="font-semibold text-[#1a1a1a]">{project.name}</span> and all of its
        documents and wiring plans will be permanently deleted. This can’t be undone.
      </p>
      <ErrorText message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={deleting} className={secondaryButton}>
          Cancel
        </button>
        <button
          type="button"
          autoFocus
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-full bg-[#E3350D] px-5 py-2 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#1a1a1a] disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete project'}
        </button>
      </div>
    </Dialog>
  )
}
