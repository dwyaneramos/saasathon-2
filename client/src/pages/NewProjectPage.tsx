import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addProject, type ProjectType } from '../lib/projects'

const STATUSES = ['Not Started', 'In Progress', 'On Track', 'At Risk', 'Completed']
const PRIORITIES = ['Low', 'Medium', 'High']
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
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [type, setType] = useState<ProjectType>('Residential')
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState(STATUSES[0])
  const [owner, setOwner] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [progress, setProgress] = useState('0')
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
        status,
        owner: owner.trim(),
        priority,
        startDate,
        dueDate,
        progress: Number(progress),
        description: description.trim(),
      })
      navigate(`/projects/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-8 py-10">
      <Link
        to="/projects"
        className="self-start font-[DM_Sans] text-xs uppercase tracking-wide text-black/50 hover:text-black"
      >
        ← My Projects
      </Link>

      <h1 className="font-[DM_Sans] text-2xl font-semibold text-[#1a1a1a]">New Project</h1>

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

        <Field label="Owner" htmlFor="owner">
          <input
            id="owner"
            required
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Status" htmlFor="status">
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            {STATUSES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>

        <Field label="Priority" htmlFor="priority">
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={inputClass}
          >
            {PRIORITIES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </Field>

        <Field label="Progress (%)" htmlFor="progress">
          <input
            id="progress"
            type="number"
            required
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
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
            {submitting ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default NewProjectPage
