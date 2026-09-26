import type { ComponentKind } from '../../types/drawing'

// Floor-plan style symbols drawn in a 24×24 box centred on (0, 0).
// Stroke colour comes from `currentColor` so callers can tint them.

interface SymbolProps {
  kind: ComponentKind
}

export function ComponentSymbol({ kind }: SymbolProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (kind) {
    case 'socket':
      return (
        <g {...common}>
          <rect x={-9} y={-6} width={18} height={12} rx={2} fill="white" />
          <line x1={-3} y1={-2} x2={-3} y2={2} />
          <line x1={3} y1={-2} x2={3} y2={2} />
        </g>
      )
    case 'double-socket':
      return (
        <g {...common}>
          <rect x={-11} y={-6} width={22} height={12} rx={2} fill="white" />
          <line x1={-6} y1={-2} x2={-6} y2={2} />
          <line x1={-2.5} y1={-2} x2={-2.5} y2={2} />
          <line x1={2.5} y1={-2} x2={2.5} y2={2} />
          <line x1={6} y1={-2} x2={6} y2={2} />
        </g>
      )
    case 'switch':
      return (
        <g {...common}>
          <circle r={4} fill="white" />
          <line x1={2.8} y1={-2.8} x2={9} y2={-9} />
          <line x1={9} y1={-9} x2={11} y2={-6} />
        </g>
      )
    case 'two-way-switch':
      return (
        <g {...common}>
          <circle r={4} fill="white" />
          <line x1={2.8} y1={-2.8} x2={9} y2={-9} />
          <line x1={9} y1={-9} x2={11} y2={-6} />
          <line x1={-2.8} y1={2.8} x2={-9} y2={9} />
          <line x1={-9} y1={9} x2={-11} y2={6} />
        </g>
      )
    case 'light':
      return (
        <g {...common}>
          <circle r={8} fill="white" />
          <line x1={-5.6} y1={-5.6} x2={5.6} y2={5.6} />
          <line x1={-5.6} y1={5.6} x2={5.6} y2={-5.6} />
        </g>
      )
    case 'downlight':
      return (
        <g {...common}>
          <circle r={7} fill="white" />
          <circle r={3} fill="currentColor" />
        </g>
      )
    case 'switchboard':
      return (
        <g {...common}>
          <rect x={-11} y={-7} width={22} height={14} fill="white" />
          <path d="M -11 7 L 11 -7 L 11 7 Z" fill="currentColor" />
        </g>
      )
    case 'junction-box':
      return (
        <g {...common}>
          <circle r={5} fill="white" />
          <circle r={1.8} fill="currentColor" />
          <line x1={0} y1={-5} x2={0} y2={-8} />
          <line x1={0} y1={5} x2={0} y2={8} />
        </g>
      )
  }
}

export function SymbolIcon({ kind, size = 22 }: SymbolProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-13 -13 26 26" aria-hidden="true">
      <ComponentSymbol kind={kind} />
    </svg>
  )
}
