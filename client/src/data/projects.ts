export type ProjectType = 'Residential' | 'Commercial'

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
  type: ProjectType
  address: string
}

export const MY_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Kitchen Renovation – 12 Rimu St',
    status: 'In Progress',
    owner: 'Maya Chen',
    priority: 'High',
    startDate: 'Sep 12, 2026',
    dueDate: 'Oct 30, 2026',
    progress: '62%',
    description:
      'Full kitchen rewire for a 1970s weatherboard house. New circuits for the oven and induction hob, extra double outlets along the bench, and LED downlights to replace the old fluoro.',
    type: 'Commercial',
    address: '120 Market St, San Francisco, CA 94105',
  },
  {
    id: 'p2',
    name: 'Office Fit-out – Level 3',
    status: 'On Track',
    owner: 'Sam Rivera',
    priority: 'Medium',
    startDate: 'Aug 1, 2026',
    dueDate: 'Nov 15, 2026',
    progress: '38%',
    description:
      'Commercial fit-out for an open-plan office. New sub-board, floor boxes for the desk pods, meeting-room lighting on two-way switching, and data cabling coordination with the IT contractor.',
    type: 'Residential',
    address: '48 Elm Grove, Austin, TX 78704',
  },
  {
    id: 'p3',
    name: 'Garage Workshop Sub-board',
    status: 'At Risk',
    owner: 'Priya Nair',
    priority: 'High',
    startDate: 'Jul 20, 2026',
    dueDate: 'Sep 28, 2026',
    progress: '81%',
    description:
      'Detached garage conversion into a workshop. New sub-board fed from the house, 3-phase outlet for a welder, and bench power along two walls.',
    type: 'Commercial',
    address: '900 W Madison St, Chicago, IL 60607',
  },
]

export const SHARED_PROJECTS: Project[] = [
  {
    id: 's1',
    name: 'Townhouse Block – Units 1–4',
    status: 'In Progress',
    owner: 'Jordan Lee',
    priority: 'Low',
    startDate: 'Sep 1, 2026',
    dueDate: 'Dec 5, 2026',
    progress: '20%',
    description:
      'Shared with the main contractor. Four-unit townhouse development, engineer-designed lighting and power layout, waiting on revised drawings for Unit 3.',
    type: 'Residential',
    address: '15 Harbor View Rd, Seattle, WA 98121',
  },
]

export function getProjectById(id: string): Project | undefined {
  return [...MY_PROJECTS, ...SHARED_PROJECTS].find((project) => project.id === id)
}

// In-memory only until there's a backend: new projects are lost on reload.
export function addProject(project: Omit<Project, 'id'>): Project {
  const created: Project = { ...project, id: `p${Date.now()}` }
  MY_PROJECTS.push(created)
  return created
}
