export type ChangeStatus = 'pending' | 'approved' | 'rejected'

export interface Plan {
  id: string
  projectId: string
  title: string
  version: number
  uploadedBy: string
  uploadedAt: string
  fileUrl: string
  notes: string
}

// A variation to the agreed scope. Once approved it becomes billable work.
export interface ChangeRequest {
  id: string
  projectId: string
  planId?: string
  title: string
  description: string
  requestedBy: string
  requestedAt: string
  cost: number
  status: ChangeStatus
  decidedBy?: string
  decidedAt?: string
  clientComment?: string
}

export const PLANS: Plan[] = [
  {
    id: 'pl1',
    projectId: 'p1',
    title: 'Ground floor electrical layout',
    version: 2,
    uploadedBy: 'Maya Chen',
    uploadedAt: 'Sep 14, 2026',
    fileUrl: '#',
    notes: 'Updated kitchen circuit and added dedicated oven line.',
  },
  {
    id: 'pl2',
    projectId: 'p1',
    title: 'Switchboard upgrade schematic',
    version: 1,
    uploadedBy: 'Maya Chen',
    uploadedAt: 'Sep 12, 2026',
    fileUrl: '#',
    notes: 'Replacing ceramic fuses with RCBOs, 3-phase ready.',
  },
]

export const CHANGE_REQUESTS: ChangeRequest[] = [
  {
    id: 'cr1',
    projectId: 'p1',
    planId: 'pl1',
    title: 'Add 4 double power points to kitchen island',
    description:
      'Client asked for extra outlets on the island during walkthrough. Requires a new 20A circuit run from the board.',
    requestedBy: 'Maya Chen',
    requestedAt: 'Sep 20, 2026',
    cost: 680,
    status: 'pending',
  },
  {
    id: 'cr2',
    projectId: 'p1',
    planId: 'pl2',
    title: 'Surge protection at switchboard',
    description: 'Whole-house surge protection device fitted during the board upgrade.',
    requestedBy: 'Maya Chen',
    requestedAt: 'Sep 21, 2026',
    cost: 420,
    status: 'pending',
  },
  {
    id: 'cr3',
    projectId: 'p1',
    planId: 'pl1',
    title: 'Relocate laundry light switch',
    description: 'Move switch to the other side of the door after the door swing changed.',
    requestedBy: 'Maya Chen',
    requestedAt: 'Sep 16, 2026',
    cost: 150,
    status: 'approved',
    decidedBy: 'Client',
    decidedAt: 'Sep 17, 2026',
  },
  {
    id: 'cr4',
    projectId: 'p1',
    title: 'Downlights in garage',
    description: 'Swap batten fittings for 6 LED downlights.',
    requestedBy: 'Maya Chen',
    requestedAt: 'Sep 15, 2026',
    cost: 540,
    status: 'rejected',
    decidedBy: 'Client',
    decidedAt: 'Sep 16, 2026',
    clientComment: 'Happy with the battens for now.',
  },
]

export function getPlansForProject(projectId: string): Plan[] {
  return PLANS.filter((plan) => plan.projectId === projectId)
}

export function getChangesForProject(projectId: string): ChangeRequest[] {
  return CHANGE_REQUESTS.filter((change) => change.projectId === projectId)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
}
