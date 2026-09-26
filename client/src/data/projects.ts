export interface Project {
  id: string
  name: string
  status: string
  owner: string
  priority: string
  startDate: string
  dueDate: string
  progress: string
  description: string
}

export const MY_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Onboarding Redesign',
    status: 'In Progress',
    owner: 'Maya Chen',
    priority: 'High',
    startDate: 'Sep 12, 2026',
    dueDate: 'Oct 30, 2026',
    progress: '62%',
    description:
      'A redesign of the onboarding flow to reduce drop-off during signup. Covers new wireframes, updated copy, and an A/B test plan against the current flow.',
  },
  {
    id: 'p2',
    name: 'Auth Migration',
    status: 'On Track',
    owner: 'Sam Rivera',
    priority: 'Medium',
    startDate: 'Aug 1, 2026',
    dueDate: 'Nov 15, 2026',
    progress: '38%',
    description:
      'Migrating the authentication service to the new identity provider. Includes token refresh handling, session migration, and rollback plan.',
  },
  {
    id: 'p3',
    name: 'Analytics Vendor Renewal',
    status: 'At Risk',
    owner: 'Priya Nair',
    priority: 'High',
    startDate: 'Jul 20, 2026',
    dueDate: 'Sep 28, 2026',
    progress: '81%',
    description:
      'Vendor contract renewal for the analytics platform. Waiting on legal review before the final signature; budget already approved.',
  },
]

export const SHARED_PROJECTS: Project[] = [
  {
    id: 's1',
    name: 'Q4 Marketing Campaign',
    status: 'In Progress',
    owner: 'Jordan Lee',
    priority: 'Low',
    startDate: 'Sep 1, 2026',
    dueDate: 'Dec 5, 2026',
    progress: '20%',
    description:
      'Shared workspace for the Q4 marketing campaign. Includes asset requests, copy drafts, and a shared calendar of publish dates.',
  },
]

export const ALL_PROJECTS: Project[] = [...MY_PROJECTS, ...SHARED_PROJECTS]

export function getProjectById(id: string): Project | undefined {
  return ALL_PROJECTS.find((project) => project.id === id)
}
