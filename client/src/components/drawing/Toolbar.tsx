import { useRef, type ReactNode } from 'react'
import { COMPONENTS, COMPONENT_KINDS } from '../../data/catalogue'
import { ACCEPTED_FILE_TYPES } from '../../lib/loadDrawingFile'
import type { Tool } from '../../types/drawing'
import { SymbolIcon } from './Symbols'

interface ToolbarProps {
  tool: Tool
  setTool: (tool: Tool) => void
  canUndo: boolean
  canRedo: boolean
  canDelete: boolean
  scaleSet: boolean
  onUndo: () => void
  onRedo: () => void
  onDelete: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onReplaceFile: (file: File) => void
}

interface ToolButtonProps {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function ToolButton({ label, active, disabled, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-10 min-w-10 flex-col items-center justify-center rounded-lg px-1.5 text-[#1a1a1a] transition-colors disabled:opacity-30 ${
        active ? 'bg-[#FFCC00]' : 'hover:bg-black/[0.06]'
      }`}
    >
      {children}
    </button>
  )
}

function TextIcon({ children }: { children: ReactNode }) {
  return <span className="font-[DM_Sans] text-lg leading-none">{children}</span>
}

const Divider = () => <div className="mx-1 h-7 w-px shrink-0 bg-black/15" />

function Toolbar(props: ToolbarProps) {
  const { tool, setTool } = props
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-wrap items-center justify-center gap-0.5 rounded-2xl border-2 border-[#1a1a1a] bg-white px-2 py-1.5 shadow-[0_4px_0_0_rgba(26,26,26,0.15)]">
      <ToolButton label="Select / move (Esc)" active={tool.type === 'select'} onClick={() => setTool({ type: 'select' })}>
        <TextIcon>↖</TextIcon>
      </ToolButton>
      <ToolButton label="Pan (hold Space)" active={tool.type === 'pan'} onClick={() => setTool({ type: 'pan' })}>
        <TextIcon>✋</TextIcon>
      </ToolButton>

      <Divider />

      {COMPONENT_KINDS.map((kind) => (
        <ToolButton
          key={kind}
          label={`Place ${COMPONENTS[kind].name.toLowerCase()}`}
          active={tool.type === 'place' && tool.kind === kind}
          onClick={() => setTool({ type: 'place', kind })}
        >
          <SymbolIcon kind={kind} />
        </ToolButton>
      ))}

      <Divider />

      <ToolButton
        label="Draw cable: click a component or point, click to add bends, click a component or double-click to finish"
        active={tool.type === 'wire'}
        onClick={() => setTool({ type: 'wire' })}
      >
        <svg width={22} height={22} viewBox="0 0 22 22" aria-hidden="true">
          <polyline points="3,18 9,8 14,14 19,4" fill="none" stroke="#1f5fbf" strokeWidth={2} strokeLinejoin="round" />
        </svg>
      </ToolButton>
      <ToolButton
        label={props.scaleSet ? 'Recalibrate scale' : 'Set scale: click two points of a known length'}
        active={tool.type === 'calibrate'}
        onClick={() => setTool({ type: 'calibrate' })}
      >
        <span className={`font-[DM_Sans] text-[10px] font-bold ${props.scaleSet ? '' : 'text-[#E3350D]'}`}>
          SCALE
        </span>
      </ToolButton>

      <Divider />

      <ToolButton label="Delete selected (Del)" disabled={!props.canDelete} onClick={props.onDelete}>
        <TextIcon>🗑</TextIcon>
      </ToolButton>
      <ToolButton label="Undo (Ctrl+Z)" disabled={!props.canUndo} onClick={props.onUndo}>
        <TextIcon>↶</TextIcon>
      </ToolButton>
      <ToolButton label="Redo (Ctrl+Y)" disabled={!props.canRedo} onClick={props.onRedo}>
        <TextIcon>↷</TextIcon>
      </ToolButton>

      <Divider />

      <ToolButton label="Zoom out" onClick={props.onZoomOut}>
        <TextIcon>−</TextIcon>
      </ToolButton>
      <ToolButton label="Fit to view" onClick={props.onFit}>
        <TextIcon>⤢</TextIcon>
      </ToolButton>
      <ToolButton label="Zoom in" onClick={props.onZoomIn}>
        <TextIcon>+</TextIcon>
      </ToolButton>

      <Divider />

      <ToolButton label="Replace drawing" onClick={() => fileRef.current?.click()}>
        <TextIcon>⇪</TextIcon>
      </ToolButton>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) props.onReplaceFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default Toolbar
