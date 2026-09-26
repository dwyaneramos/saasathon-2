import type { ReactNode } from 'react'
import { BREAKER_RATINGS_A, CABLE_SIZES, CABLE_TYPES, COMPONENTS, COMPONENT_KINDS, VOLTAGES } from '../../data/catalogue'
import type { DrawingStore } from '../../lib/drawingStore'
import { pathLengthPx, wirePath } from '../../lib/materials'
import type { CableSize, CableType, ComponentKind, Selection, Voltage } from '../../types/drawing'

interface InspectorProps {
  store: DrawingStore
  selection: Selection
}

const inputClass =
  'w-full rounded-md border border-black/15 bg-white px-2 py-1.5 font-[DM_Sans] text-sm text-[#1a1a1a] outline-none focus:border-[#E3350D]'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-[DM_Sans] text-[11px] uppercase tracking-wide text-black/50">{label}</span>
      {children}
    </label>
  )
}

function Inspector({ store, selection }: InspectorProps) {
  const { drawing } = store

  let body: ReactNode = (
    <p className="font-[DM_Sans] text-sm text-black/50">
      Select a component or cable to edit it, or pick a tool from the toolbar.
    </p>
  )

  if (selection?.type === 'component') {
    const c = drawing.components.find((x) => x.id === selection.id)
    if (c) {
      body = (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select
              className={inputClass}
              value={c.kind}
              onChange={(e) => store.updateComponent(c.id, { kind: e.target.value as ComponentKind })}
            >
              {COMPONENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {COMPONENTS[k].name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Label">
            <input
              className={inputClass}
              value={c.label}
              onChange={(e) => store.updateComponent(c.id, { label: e.target.value })}
            />
          </Field>
          <Field label="Circuit">
            <input
              className={inputClass}
              placeholder="e.g. C3"
              value={c.circuit ?? ''}
              onChange={(e) => store.updateComponent(c.id, { circuit: e.target.value || undefined })}
            />
          </Field>
          <Field label="Rotation">
            <select
              className={inputClass}
              value={c.rotation}
              onChange={(e) => store.updateComponent(c.id, { rotation: Number(e.target.value) })}
            >
              {[0, 90, 180, 270].map((r) => (
                <option key={r} value={r}>
                  {r}°
                </option>
              ))}
            </select>
          </Field>
        </div>
      )
    }
  }

  if (selection?.type === 'wire') {
    const w = drawing.wires.find((x) => x.id === selection.id)
    if (w) {
      const measured = drawing.metresPerPx
        ? pathLengthPx(wirePath(w, drawing.components)) * drawing.metresPerPx
        : undefined
      const from = drawing.components.find((c) => c.id === w.fromId)
      const to = drawing.components.find((c) => c.id === w.toId)
      body = (
        <div className="flex flex-col gap-3">
          <p className="font-[DM_Sans] text-xs text-black/60">
            {from?.label ?? 'Free end'} → {to?.label ?? 'Free end'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cable type">
              <select
                className={inputClass}
                value={w.cableType}
                onChange={(e) => store.updateWire(w.id, { cableType: e.target.value as CableType })}
              >
                {CABLE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Size">
              <select
                className={inputClass}
                value={w.sizeMm2}
                onChange={(e) => store.updateWire(w.id, { sizeMm2: Number(e.target.value) as CableSize })}
              >
                {CABLE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s} mm²
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Voltage">
              <select
                className={inputClass}
                value={w.voltage}
                onChange={(e) => store.updateWire(w.id, { voltage: Number(e.target.value) as Voltage })}
              >
                {VOLTAGES.map((v) => (
                  <option key={v} value={v}>
                    {v} V {v === 400 ? '(3-phase)' : '(single)'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Circuit">
              <input
                className={inputClass}
                placeholder="e.g. C3"
                value={w.circuit ?? ''}
                onChange={(e) => store.updateWire(w.id, { circuit: e.target.value || undefined })}
              />
            </Field>
            <Field label="Breaker">
              <select
                className={inputClass}
                value={w.protectionA ?? ''}
                onChange={(e) =>
                  store.updateWire(w.id, { protectionA: e.target.value ? Number(e.target.value) : undefined })
                }
              >
                <option value="">Not set</option>
                {BREAKER_RATINGS_A.map((a) => (
                  <option key={a} value={a}>
                    {a} A
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Length (m)">
            <input
              className={inputClass}
              type="number"
              min={0}
              step={0.1}
              placeholder={measured !== undefined ? `${measured.toFixed(1)} (measured)` : 'Set scale or enter length'}
              value={w.lengthOverrideM ?? ''}
              onChange={(e) => {
                const value = Number.parseFloat(e.target.value)
                store.updateWire(w.id, { lengthOverrideM: Number.isFinite(value) && value >= 0 ? value : undefined })
              }}
            />
          </Field>
          <p className="font-[DM_Sans] text-[11px] text-black/45">
            {w.lengthOverrideM !== undefined
              ? 'Using the length you entered. Clear it to use the measured length.'
              : measured !== undefined
                ? 'Measured from the drawing. Enter a value to override.'
                : 'Use the SCALE tool so lengths can be measured from the drawing.'}
          </p>
        </div>
      )
    }
  }

  const heading =
    selection?.type === 'component' ? 'Component' : selection?.type === 'wire' ? 'Cable' : 'Properties'

  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.03] p-5">
      <span className="font-[DM_Sans] text-xs uppercase tracking-wide text-black/50">{heading}</span>
      <div className="mt-3">{body}</div>
    </div>
  )
}

export default Inspector
