import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import './ElectricTitle.css'

const LINE_GAP_PX = 28

const LEFT_SPARKS = [
  { left: '5%', delay: '0s', duration: '4.2s' },
  { left: '13%', delay: '1.4s', duration: '3.6s' },
  { left: '22%', delay: '2.7s', duration: '4.8s' },
]

const RIGHT_SPARKS = [
  { left: '95%', delay: '0.8s', duration: '4.4s' },
  { left: '87%', delay: '2.1s', duration: '3.8s' },
  { left: '78%', delay: '3.4s', duration: '4.6s' },
]

type Point = [number, number]

interface BoltSegment {
  d: string
  length: number
}

interface BoltData {
  id: number
  width: number
  height: number
  main: BoltSegment
  branches: BoltSegment[]
}

/** Recursive midpoint displacement — generates a fresh jagged path every call, like a real arc. */
function midpointDisplace(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  displace: number,
  roughness: number,
  minSeg: number,
): Point[] {
  if (x1 - x0 < minSeg) return [[x0, y0], [x1, y1]]
  const midX = (x0 + x1) / 2
  const midY = (y0 + y1) / 2 + (Math.random() * 2 - 1) * displace
  const left = midpointDisplace(x0, y0, midX, midY, displace * roughness, roughness, minSeg)
  const right = midpointDisplace(midX, midY, x1, y1, displace * roughness, roughness, minSeg)
  return [...left.slice(0, -1), ...right]
}

function toSegment(points: Point[]): BoltSegment {
  let d = ''
  let length = 0
  points.forEach(([x, y], i) => {
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `
    if (i > 0) {
      const [px, py] = points[i - 1]
      length += Math.hypot(x - px, y - py)
    }
  })
  return { d: d.trim(), length }
}

function generateBolt(width: number, height: number): Omit<BoltData, 'id'> {
  const baseline = height / 2
  const mainPoints = midpointDisplace(0, baseline, width, baseline, height * 0.4, 0.6, 7)
  const main = toSegment(mainPoints)

  const branchCount = 1 + Math.round(Math.random())
  const branches: BoltSegment[] = []
  for (let b = 0; b < branchCount; b += 1) {
    const originIndex = Math.floor(mainPoints.length * (0.3 + Math.random() * 0.4))
    const [ox, oy] = mainPoints[originIndex]
    const dir = Math.random() > 0.5 ? 1 : -1
    const branchLen = width * (0.1 + Math.random() * 0.12)
    const endX = Math.min(width, ox + branchLen)
    const endY = oy + dir * height * (0.32 + Math.random() * 0.22)
    const branchPoints = midpointDisplace(ox, oy, endX, endY, height * 0.16, 0.6, 5)
    branches.push(toSegment(branchPoints))
  }

  return { width, height, main, branches }
}

interface ElectricTitleProps {
  children: ReactNode
  className?: string
}

let boltId = 0

export default function ElectricTitle({ children, className }: ElectricTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [bolt, setBolt] = useState<BoltData | null>(null)
  const [zapping, setZapping] = useState(false)
  const [halfGap, setHalfGap] = useState(LINE_GAP_PX)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateGap = () => setHalfGap(el.getBoundingClientRect().width / 2 + LINE_GAP_PX)
    updateGap()
    const observer = new ResizeObserver(updateGap)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    const timers: number[] = []

    const scheduleNext = () => {
      const delay = 2200 + Math.random() * 3600
      timers.push(window.setTimeout(fire, delay))
    }

    const fire = () => {
      if (cancelled) return
      const el = containerRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        const width = rect.width
        const height = Math.max(rect.height, 60)
        boltId += 1
        setBolt({ id: boltId, ...generateBolt(width, height) })
        setZapping(true)
        timers.push(
          window.setTimeout(() => {
            if (cancelled) return
            setZapping(false)
            timers.push(
              window.setTimeout(() => {
                if (!cancelled) setBolt(null)
              }, 220),
            )
          }, 260),
        )
      }
      scheduleNext()
    }

    timers.push(window.setTimeout(fire, 1200))

    return () => {
      cancelled = true
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  const lineStyle = { '--half-gap': `${halfGap}px` } as CSSProperties

  return (
    <div ref={containerRef} className="relative inline-block">
      <h1
        className={`electric-title${zapping ? ' is-zapping' : ''}${className ? ` ${className}` : ''}`}
      >
        {children}
      </h1>
      <span
        className={`electric-title-line electric-title-line-left${zapping ? ' is-zapping' : ''}`}
        style={lineStyle}
        aria-hidden="true"
      >
        {LEFT_SPARKS.map((spark, i) => (
          <span
            key={i}
            className="electric-spark"
            style={{
              left: spark.left,
              animationDelay: spark.delay,
              animationDuration: spark.duration,
            }}
          />
        ))}
      </span>
      <span
        className={`electric-title-line electric-title-line-right${zapping ? ' is-zapping' : ''}`}
        style={lineStyle}
        aria-hidden="true"
      >
        {RIGHT_SPARKS.map((spark, i) => (
          <span
            key={i}
            className="electric-spark"
            style={{
              left: spark.left,
              animationDelay: spark.delay,
              animationDuration: spark.duration,
            }}
          />
        ))}
      </span>
      {bolt && (
        <svg
          key={bolt.id}
          className="electric-bolt-svg"
          viewBox={`0 0 ${bolt.width} ${bolt.height}`}
          preserveAspectRatio="none"
        >
          <path
            d={bolt.main.d}
            className="bolt-path bolt-main"
            style={{ strokeDasharray: bolt.main.length, strokeDashoffset: bolt.main.length }}
          />
          {bolt.branches.map((branch, i) => (
            <path
              key={i}
              d={branch.d}
              className="bolt-path bolt-branch"
              style={{ strokeDasharray: branch.length, strokeDashoffset: branch.length }}
            />
          ))}
        </svg>
      )}
    </div>
  )
}
