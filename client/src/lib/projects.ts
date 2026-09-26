import { supabase } from './supabase'

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

export interface NewProjectInput {
  name: string
  type: ProjectType
  address: string
  startDate: string // ISO yyyy-mm-dd
  dueDate: string // ISO yyyy-mm-dd
  description: string
}

interface ProjectRow {
  id: string
  name: string
  status: string
  owner: string
  priority: string
  start_date: string
  due_date: string
  progress: number
  description: string
  type: ProjectType
  address: string
}

// Matches the display format the UI has always used, e.g. "Sep 12, 2026".
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    owner: row.owner,
    priority: row.priority,
    startDate: formatDate(row.start_date),
    dueDate: formatDate(row.due_date),
    progress: `${row.progress}%`,
    description: row.description,
    type: row.type,
    address: row.address,
  }
}

export async function listMyProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as ProjectRow[]).map(toProject)
}

// No sharing model yet - every project belongs to the single demo user.
export async function listSharedProjects(): Promise<Project[]> {
  return []
}

export async function getProjectById(id: string): Promise<Project | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toProject(data as ProjectRow) : null
}

// owner/status/priority/progress aren't collected at creation time - the projects
// table defaults them ('', 'Not started', 'Medium', 0) until they're set later.
export async function addProject(input: NewProjectInput): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: input.name,
      type: input.type,
      address: input.address,
      start_date: input.startDate,
      due_date: input.dueDate,
      description: input.description,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return toProject(data as ProjectRow)
}
