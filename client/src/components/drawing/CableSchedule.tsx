import { useCableSchedule, type CableScheduleEntry } from '../../lib/cableSchedule'

const dash = <span className="text-[#E3350D]">—</span>

function status(e: CableScheduleEntry) {
  if (e.missing.length > 0) return { label: 'Needs info', style: 'bg-[#E3350D] text-white' }
  if (e.verify.length > 0) return { label: 'Verify', style: 'bg-[#FFCC00] text-[#1a1a1a]' }
  return { label: 'As documented', style: 'bg-[#1a7a3d] text-white' }
}

function CableSchedule({ projectId }: { projectId: string }) {
  const { entries, documentCount, loading, error, refresh } = useCableSchedule(projectId)

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-black/50">Cable schedule</span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="text-[11px] font-semibold text-black/50 underline-offset-2 hover:text-black hover:underline disabled:opacity-40"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-[#E3350D]">{error}</p>}

      {!loading && !error && entries.length === 0 && (
        <p className="mt-2 text-sm text-black/50">
          {documentCount === 0
            ? 'Upload a cable schedule, switchboard schedule or wiring plan in the Analyse tab to build this.'
            : 'No cables or circuits were found in the uploaded documents.'}
        </p>
      )}

      {entries.length > 0 && (
        <table className="mt-2 w-full text-xs text-[#1a1a1a]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-black/50">
              <th className="pb-1 font-normal">Ref</th>
              <th className="pb-1 font-normal">From → To</th>
              <th className="pb-1 font-normal">Cable</th>
              <th className="pb-1 text-right font-normal">Length</th>
              <th className="pb-1 text-right font-normal">Prot.</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const s = status(e)
              return (
                <tr key={`${e.sourceFile}-${e.ref}-${i}`} className="border-t border-black/10 align-top">
                  <td className="py-1.5 pr-1.5 font-semibold whitespace-nowrap">{e.ref}</td>
                  <td className="py-1.5 pr-1.5">
                    {e.from ?? dash} → {e.to ?? dash}
                    <div className="mt-0.5 text-[10px] text-black/50">
                      {[e.description, e.phase ? (e.phase === '1' ? '1-phase' : `${e.phase}-phase`) : null, e.sourceFile]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    <div className="mt-1">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${s.style}`}>
                        {s.label}
                      </span>
                      {e.missing.length > 0 && (
                        <span className="ml-1 text-[10px] text-[#E3350D]">missing {e.missing.join(', ')}</span>
                      )}
                      {e.verify.map((v) => (
                        <div key={v} className="mt-0.5 text-[10px] text-black/60">
                          {v}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-1.5 pr-1.5">{e.cableType ?? dash}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    {e.lengthM !== null ? `${e.lengthEstimated ? '~' : ''}${e.lengthM} m` : dash}
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">{e.protectionA !== null ? `${e.protectionA} A` : dash}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <p className="mt-2 text-[10px] text-black/40">
        Copied from the uploaded documents only: nothing is sized or calculated. ~ marks a length scaled from a
        drawing. Compliance with AS/NZS 3000 and AS/NZS 3008.1.2 must be confirmed and signed off by the electrical
        designer.
      </p>
    </div>
  )
}

export default CableSchedule
