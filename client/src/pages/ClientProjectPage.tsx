import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  formatCurrency,
  getChangesForProject,
  getPlansForProject,
  type ChangeRequest,
  type ChangeStatus,
} from '../data/changes'
import { getProjectById } from '../data/projects'
import { notifyChangeDecision, notifyDecisionUndone } from '../lib/notifications'

const labelClass = 'font-[DM_Sans] text-xs uppercase tracking-wide text-black/50'
const panelClass = 'rounded-lg border border-black/10 bg-black/[0.03] p-5'

const STATUS_STYLES: Record<ChangeStatus, string> = {
  pending: 'bg-[#FFCC00]/30 text-[#1a1a1a]',
  approved: 'bg-green-600/15 text-green-800',
  rejected: 'bg-[#E3350D]/15 text-[#E3350D]',
}

function StatusBadge({ status }: { status: ChangeStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 font-[DM_Sans] text-xs font-semibold uppercase ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}

function ClientProjectPage() {
  const { id } = useParams<{ id: string }>()
  const project = id ? getProjectById(id) : undefined
  const [changes, setChanges] = useState<ChangeRequest[]>(() =>
    id ? getChangesForProject(id) : [],
  )
  const [comments, setComments] = useState<Record<string, string>>({})

  if (!project) {
    return (
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 px-8 pt-28 pb-10">
        <Link to="/projects" className={`self-start hover:text-black ${labelClass}`}>
          ← My Projects
        </Link>
        <p className="font-[DM_Sans] text-[#1a1a1a]">Project not found.</p>
      </div>
    )
  }

  const plans = getPlansForProject(project.id)
  const pending = changes.filter((change) => change.status === 'pending')
  const decided = changes.filter((change) => change.status !== 'pending')
  const sumCost = (list: ChangeRequest[]) => list.reduce((total, change) => total + change.cost, 0)

  function decide(changeId: string, status: Exclude<ChangeStatus, 'pending'>) {
    const today = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const comment = comments[changeId]?.trim()
    const updated = changes.map((change) =>
      change.id === changeId
        ? { ...change, status, decidedBy: 'Client', decidedAt: today, clientComment: comment || undefined }
        : change,
    )
    setChanges(updated)
    const decidedChange = updated.find((change) => change.id === changeId)
    if (decidedChange) notifyChangeDecision(decidedChange)
  }

  // Moves a decided change back to pending, keeping the client's comment in the box so it can be edited.
  function undoDecision(changeId: string) {
    const target = changes.find((change) => change.id === changeId)
    if (!target) return
    setChanges(
      changes.map((change) =>
        change.id === changeId
          ? { ...change, status: 'pending', decidedBy: undefined, decidedAt: undefined, clientComment: undefined }
          : change,
      ),
    )
    setComments((current) => ({ ...current, [changeId]: target.clientComment ?? '' }))
    notifyDecisionUndone(target)
  }

  const summary = [
    { label: 'Awaiting your approval', value: formatCurrency(sumCost(pending)) },
    {
      label: 'Approved variations',
      value: formatCurrency(sumCost(changes.filter((change) => change.status === 'approved'))),
    },
    { label: 'Plans on file', value: String(plans.length) },
  ]

  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-8 px-8 pt-28 pb-10">
      <Link to={`/projects/${project.id}`} className={`self-start hover:text-black ${labelClass}`}>
        ← Project overview
      </Link>

      <header className="flex flex-col gap-1">
        <span className={labelClass}>Client view</span>
        <h1 className="font-[DM_Sans] text-2xl font-semibold text-[#1a1a1a]">{project.name}</h1>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {summary.map((tile) => (
          <div key={tile.label} className={`flex flex-col gap-2 ${panelClass}`}>
            <span className={labelClass}>{tile.label}</span>
            <span className="font-[DM_Sans] text-lg font-semibold text-[#1a1a1a]">{tile.value}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-[DM_Sans] text-lg font-semibold uppercase tracking-wide text-[#E3350D]">
          Plans
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <a
              key={plan.id}
              href={plan.fileUrl}
              className={`flex flex-col gap-2 transition-colors hover:bg-black/[0.05] ${panelClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-[DM_Sans] font-semibold text-[#1a1a1a]">{plan.title}</span>
                <span className={labelClass}>v{plan.version}</span>
              </div>
              <p className="font-[DM_Sans] text-sm text-[#1a1a1a]/80">{plan.notes}</p>
              <span className={labelClass}>
                {plan.uploadedBy} · {plan.uploadedAt}
              </span>
            </a>
          ))}
          {plans.length === 0 && (
            <p className="font-[DM_Sans] text-sm text-black/50">No plans uploaded yet.</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-[DM_Sans] text-lg font-semibold uppercase tracking-wide text-[#E3350D]">
          Changes awaiting approval
        </h2>
        {pending.length === 0 && (
          <p className="font-[DM_Sans] text-sm text-black/50">Nothing waiting on you.</p>
        )}
        {pending.map((change) => (
          <div key={change.id} className={`flex flex-col gap-3 ${panelClass}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="font-[DM_Sans] font-semibold text-[#1a1a1a]">{change.title}</span>
              <span className="font-[DM_Sans] text-lg font-semibold text-[#1a1a1a]">
                {formatCurrency(change.cost)}
              </span>
            </div>
            <p className="font-[DM_Sans] text-sm text-[#1a1a1a]/80">{change.description}</p>
            <span className={labelClass}>
              Requested by {change.requestedBy} · {change.requestedAt}
              {change.planId && ` · ${plans.find((plan) => plan.id === change.planId)?.title}`}
            </span>
            <textarea
              value={comments[change.id] ?? ''}
              onChange={(event) =>
                setComments((current) => ({ ...current, [change.id]: event.target.value }))
              }
              placeholder="Optional comment for your electrician"
              rows={2}
              className="w-full resize-none rounded-md border border-black/15 bg-white p-2 font-[DM_Sans] text-sm"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => decide(change.id, 'approved')}
                className="rounded-full bg-[#FFCC00] px-4 py-1.5 font-[DM_Sans] text-xs font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-[#E3350D] hover:text-white"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => decide(change.id, 'rejected')}
                className="rounded-full border-2 border-[#1a1a1a] px-4 py-1 font-[DM_Sans] text-xs font-semibold tracking-wide text-[#1a1a1a] uppercase transition-colors hover:bg-[#1a1a1a] hover:text-white"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-[DM_Sans] text-lg font-semibold uppercase tracking-wide text-[#E3350D]">
          History
        </h2>
        <div className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10">
          {decided.map((change) => (
            <div key={change.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-col gap-1">
                <span className="font-[DM_Sans] text-sm font-semibold text-[#1a1a1a]">
                  {change.title}
                </span>
                <span className={labelClass}>
                  {change.decidedBy} · {change.decidedAt}
                  {change.clientComment && ` · "${change.clientComment}"`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-[DM_Sans] text-sm text-[#1a1a1a]">
                  {formatCurrency(change.cost)}
                </span>
                <StatusBadge status={change.status} />
                <button
                  type="button"
                  onClick={() => undoDecision(change.id)}
                  className="font-[DM_Sans] text-xs font-semibold uppercase tracking-wide text-black/50 underline-offset-2 hover:text-[#E3350D] hover:underline"
                >
                  Undo
                </button>
              </div>
            </div>
          ))}
          {decided.length === 0 && (
            <p className="p-4 font-[DM_Sans] text-sm text-black/50">No decisions yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export default ClientProjectPage
