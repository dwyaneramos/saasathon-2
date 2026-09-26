import type { Project } from '../../lib/projects'
import type { MaterialsSummary } from '../../lib/materials'

interface ProjectSummaryProps {
  project: Project
  materials: MaterialsSummary
  /** Cables on the editable schedule further down the page. */
  cableCount: number
}

const nzd = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' })

function ProjectSummary({ project, materials, cableCount }: ProjectSummaryProps) {
  const stats = [
    { label: 'Status', value: project.status },
    { label: 'Due', value: project.dueDate },
    { label: 'Components', value: String(materials.componentCount) },
    { label: 'Cable', value: `${materials.cableMetres} m` },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 rounded-lg border border-black/10 bg-black/[0.03] p-5 font-[DM_Sans]">
      <div>
        <span className="text-xs uppercase tracking-wide text-black/50">Project overview · {project.type}</span>
        <p className="mt-1 text-sm text-[#1a1a1a]">{project.address}</p>
      </div>

      <div>
        <span className="text-xs uppercase tracking-wide text-black/50">Estimated materials cost</span>
        <p className="text-3xl font-semibold text-[#1a1a1a]">{nzd.format(materials.total)}</p>
        <p className="text-[11px] text-black/45">Excl. GST and labour. Cable includes 10% allowance.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border border-black/10 bg-white px-3 py-2">
            <span className="text-[10px] uppercase tracking-wide text-black/50">{s.label}</span>
            <p className="text-sm font-semibold text-[#1a1a1a]">{s.value}</p>
          </div>
        ))}
      </div>

      {materials.unmeasuredWires > 0 && (
        <p className="rounded-md bg-[#FFCC00]/25 px-3 py-2 text-xs text-[#1a1a1a]">
          {materials.unmeasuredWires} cable{materials.unmeasuredWires === 1 ? '' : 's'} not costed yet: set the
          drawing scale or enter lengths manually.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <span className="text-xs uppercase tracking-wide text-black/50">Materials</span>
        {materials.lines.length === 0 ? (
          <p className="mt-2 text-sm text-black/50">Nothing on the drawing yet.</p>
        ) : (
          <table className="mt-2 w-full text-sm text-[#1a1a1a]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-black/50">
                <th className="pb-1 font-normal">Item</th>
                <th className="pb-1 text-right font-normal">Qty</th>
                <th className="pb-1 text-right font-normal">Unit</th>
                <th className="pb-1 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {materials.lines.map((line) => (
                <tr key={line.key} className="border-t border-black/10">
                  <td className="py-1.5 pr-2">{line.name}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    {line.qty}
                    {line.unit === 'm' ? ' m' : ''}
                  </td>
                  <td className="py-1.5 text-right text-black/60">{nzd.format(line.unitPrice)}</td>
                  <td className="py-1.5 text-right font-semibold">{nzd.format(line.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="mt-4 text-xs text-black/60">
          Cable schedule: {cableCount} cable{cableCount === 1 ? '' : 's'} ·{' '}
          <a href="#cable-schedule" className="font-semibold text-[#1a1a1a] underline-offset-2 hover:underline">
            View and edit ↓
          </a>
        </p>
      </div>

      <p className="text-[10px] text-black/40">Prices are indicative demo figures, not supplier quotes.</p>
    </div>
  )
}

export default ProjectSummary
