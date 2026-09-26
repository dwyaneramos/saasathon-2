export type ComponentKind =
  | 'socket'
  | 'double-socket'
  | 'switch'
  | 'two-way-switch'
  | 'light'
  | 'downlight'
  | 'switchboard'
  | 'junction-box'

export type CableType = 'TPS 2C+E' | 'TPS 3C+E' | 'Flex 3C'

export type CableSize = 1 | 1.5 | 2.5 | 4 | 6 | 10

export type Voltage = 230 | 400

export interface Point {
  x: number
  y: number
}

export interface PlacedComponent {
  id: string
  kind: ComponentKind
  x: number
  y: number
  rotation: number
  label: string
  circuit?: string
}

export interface Wire {
  id: string
  fromId?: string
  toId?: string
  points: Point[]
  cableType: CableType
  sizeMm2: CableSize
  voltage: Voltage
  /** Rating of the protective device (breaker) for this cable, in amps. */
  protectionA?: number
  lengthOverrideM?: number
  circuit?: string
}

export interface DrawingBackground {
  dataUrl: string
  width: number
  height: number
  fileName: string
}

export interface Drawing {
  projectId: string
  background?: DrawingBackground
  metresPerPx?: number
  components: PlacedComponent[]
  wires: Wire[]
  updatedAt: number
}

export type Selection = { type: 'component'; id: string } | { type: 'wire'; id: string } | null

export type Tool =
  | { type: 'select' }
  | { type: 'pan' }
  | { type: 'place'; kind: ComponentKind }
  | { type: 'wire' }
  | { type: 'calibrate' }
