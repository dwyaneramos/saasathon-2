import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import SetupPanel from '../components/sheets/SetupPanel'
import { buildChecklist } from '../data/sheets'
import { addProject, type Project, type ProjectType } from '../lib/projects'
import { useSheetSet } from '../lib/sheets'

const PROJECT_TYPES: ProjectType[] = ['Residential', 'Commercial']

const labelClass = 'font-[DM_Sans] text-xs uppercase tracking-wide text-black/50'
const inputClass =
  'w-full rounded-lg border border-black/10 bg-black/[0.03] px-4 py-2.5 font-[DM_Sans] text-sm text-[#1a1a1a] outline-none transition-colors focus:border-[#E3350D] focus:bg-white'

interface FieldProps {
  label: string
  htmlFor?: string
  className?: string
  children: ReactNode
}

function Field({ label, htmlFor, className = '', children }: FieldProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  )
}

function NewProjectPage() {
  const [name, setName] = useState('')
  const [createdProject, setCreatedProject] = useState<Project | null>(null)
  const { sheets } = useSheetSet(createdProject?.id ?? '')
  const checklist = buildChecklist(sheets)
  const [type, setType] = useState<ProjectType>('Residential')
  const [address, setAddress] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (dueDate < startDate) {
      setError('Due date must be on or after the start date.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const project = await addProject({
        name: name.trim(),
        type,
        address: address.trim(),
        startDate,
        dueDate,
        description: description.trim(),
      })
      // Straight to the drawing set: the job isn't really created until the set is in,
      // and every sheet added from here is saved immediately, so leaving loses nothing.
      setCreatedProject(project)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  if (createdProject) {
    return (
      <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-8 py-10">
        <Link
          to={`/projects/${createdProject.id}`}
          className="self-start font-[DM_Sans] text-xs uppercase tracking-wide text-black/50 hover:text-black"
        >
          ← {createdProject.name}
        </Link>

        <div className="flex flex-col gap-1">
          <span className="font-[DM_Sans] text-xs uppercase tracking-wide text-black/50">
            Step 2 of 2
          </span>
          <h1 className="font-[DM_Sans] text-2xl font-semibold text-[#1a1a1a]">
            {createdProject.name}
          </h1>
          <p className="font-[DM_Sans] text-sm text-black/60">
            Created. Now add its drawing set — one sheet at a time.
          </p>
        </div>

        <SetupPanel projectId={createdProject.id} showProcessAction={false} />

        <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-6">
          <Link
            to={`/projects/${createdProject.id}`}
            className="rounded-full bg-[#FFCC00] px-5 py-2 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-[#E3350D] hover:text-white"
          >
            {checklist.complete ? 'Open job' : 'Finish later'}
          </Link>
          <span className="font-[DM_Sans] text-xs text-black/50">
            {checklist.complete
              ? 'Set is complete — cross-referencing is unlocked.'
              : `Still missing ${checklist.missing.length} required sheet${
                  checklist.missing.length === 1 ? '' : 's'
                }. Everything you add is saved, so you can come back to it.`}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-8 py-10">
      <Link
        to="/projects"
        className="self-start font-[DM_Sans] text-xs uppercase tracking-wide text-black/50 hover:text-black"
      >
        ← My Projects
      </Link>

      <div className="flex flex-col gap-1">
        <span className="font-[DM_Sans] text-xs uppercase tracking-wide text-black/50">
          Step 1 of 2
        </span>
        <h1 className="font-[DM_Sans] text-2xl font-semibold text-[#1a1a1a]">New Project</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Project Name" htmlFor="name" className="sm:col-span-2">
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>

        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className={`${labelClass} mb-2`}>Project Type</legend>
          <div className="flex gap-3">
            {PROJECT_TYPES.map((option) => (
              <label
                key={option}
                className={`flex-1 cursor-pointer rounded-lg border-2 px-4 py-3 text-center font-[DM_Sans] text-sm font-semibold transition-colors ${
                  type === option
                    ? 'border-[#1a1a1a] bg-[#FFCC00] text-[#1a1a1a]'
                    : 'border-black/10 bg-black/[0.03] text-black/60 hover:bg-black/[0.05]'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={option}
                  checked={type === option}
                  onChange={() => setType(option)}
                  className="sr-only"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Address" htmlFor="address" className="sm:col-span-2">
          <input
            id="address"
            required
            autoComplete="street-address"
            placeholder="Street, city, state, postcode"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Start Date" htmlFor="startDate">
          <input
            id="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Due Date" htmlFor="dueDate">
          <input
            id="dueDate"
            type="date"
            required
            min={startDate || undefined}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Description" htmlFor="description" className="sm:col-span-2">
          <textarea
            id="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </Field>

        {error && (
          <p className="font-[DM_Sans] text-sm text-[#E3350D] sm:col-span-2">{error}</p>
        )}

        <div className="flex justify-end gap-3 sm:col-span-2">
          <Link
            to="/projects"
            className="rounded-full px-5 py-2 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-black/60 hover:text-black"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-[#FFCC00] px-5 py-2 font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-[#1a1a1a] transition-colors hover:bg-[#E3350D] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Creating…' : 'Next: add drawing set'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default NewProjectPage
