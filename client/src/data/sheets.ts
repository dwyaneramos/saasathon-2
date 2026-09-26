// Sheet types a consultant drawing set is made of. The first three are the spine of the
// cross-reference step - without a plan, a schedule and a single-line diagram there is
// nothing to merge - so a job's tools stay locked until all three are supplied.
// The rest contribute when the set happens to include them.
export const SHEET_TYPES = [
  'power_plan',
  'lighting_rcp_plan',
  'panel_schedule',
  'single_line_diagram',
  'lv_specialty',
  'site_plan',
] as const

export type SheetType = (typeof SHEET_TYPES)[number]

export const REQUIRED_SHEET_TYPES: SheetType[] = [
  'power_plan',
  'panel_schedule',
  'single_line_diagram',
]

export const SHEET_TYPE_LABEL: Record<SheetType, string> = {
  power_plan: 'Power plan',
  lighting_rcp_plan: 'Lighting / RCP plan',
  panel_schedule: 'Panel schedule',
  single_line_diagram: 'Single-line diagram',
  lv_specialty: 'LV / specialty plan',
  site_plan: 'Site plan',
}

export const SHEET_TYPE_HINT: Record<SheetType, string> = {
  power_plan: 'Power outlets, switches and fixed loads, with circuit tags written on the plan.',
  lighting_rcp_plan: 'Lighting layout and reflected ceiling plan.',
  panel_schedule: 'The board schedule: circuit number, breaker size, phase and load.',
  single_line_diagram: 'Board hierarchy and feeders - which board supplies which.',
  lv_specialty: 'Data, security or AV. A separate system; shared routing only, never merged into power.',
  site_plan: 'Site address, boundaries and utility supply point.',
}

export function isSheetType(value: unknown): value is SheetType {
  return typeof value === 'string' && (SHEET_TYPES as readonly string[]).includes(value)
}

export function isRequiredSheetType(sheetType: SheetType): boolean {
  return REQUIRED_SHEET_TYPES.includes(sheetType)
}

export interface JobSheet {
  id: string
  source_file: string
  sheet_type: SheetType
  size_bytes: number | null
  status: 'intake' | 'pending' | 'extracted' | 'skipped_noise' | 'error'
  created_at: string
}

export interface SheetSetResponse {
  sheets: JobSheet[]
  requiredSheetTypes: SheetType[]
  missingSheetTypes: SheetType[]
}

export interface ChecklistItem {
  sheetType: SheetType
  label: string
  hint: string
  required: boolean
  sheets: JobSheet[]
}

export interface Checklist {
  items: ChecklistItem[]
  missing: SheetType[]
  complete: boolean
  unprocessed: number
}

export function buildChecklist(sheets: JobSheet[]): Checklist {
  const items = SHEET_TYPES.map((sheetType) => ({
    sheetType,
    label: SHEET_TYPE_LABEL[sheetType],
    hint: SHEET_TYPE_HINT[sheetType],
    required: isRequiredSheetType(sheetType),
    sheets: sheets.filter((sheet) => sheet.sheet_type === sheetType),
  }))

  const supplied = new Set(sheets.map((sheet) => sheet.sheet_type))
  const missing = REQUIRED_SHEET_TYPES.filter((sheetType) => !supplied.has(sheetType))

  return {
    items,
    missing,
    complete: missing.length === 0,
    unprocessed: sheets.filter((sheet) => sheet.status === 'intake' || sheet.status === 'pending')
      .length,
  }
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatSheetDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
