import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import './ElectricTitle.css'

const MIN_STRIKE_DELAY = 2200
const MAX_STRIKE_DELAY = 4400
const FLICKER_MS = 380
const REST_BRIGHTNESS = 0.6

type Point = [number, number]

interface Bolt {
  main: Point[]
  branches: Point[][]
}

/** Recursive midpoint displacement — the standard fractal-lightning technique: rough up a straight segment every call, like a real arc never striking the same way twice. */
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

/** A bottom-left-to-top-right trunk, fractally roughed up, with a couple of forking branches. */
function generateBolt(width: number, height: number): Bolt {
  const anchors: Point[] = [
    [0, height * 0.92],
    [width * 0.5, height * 0.55],
    [width, height * 0.08],
  ]
  let main: Point[] = []
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const [x0, y0] = anchors[i]
    const [x1, y1] = anchors[i + 1]
    const seg = midpointDisplace(x0, y0, x1, y1, height * 0.22, 0.62, 16)
    main = main.length ? [...main.slice(0, -1), ...seg] : seg
  }

  const branchCount = 2 + Math.round(Math.random())
  const branches: Point[][] = []
  for (let b = 0; b < branchCount; b += 1) {
    const originIndex = Math.floor(main.length * (0.2 + Math.random() * 0.6))
    const [ox, oy] = main[originIndex]
    const dir = Math.random() > 0.5 ? 1 : -1
    const branchLen = width * (0.08 + Math.random() * 0.1)
    const endX = Math.min(width, ox + branchLen)
    const endY = Math.max(0, Math.min(height, oy + dir * height * (0.2 + Math.random() * 0.2)))
    branches.push(midpointDisplace(ox, oy, endX, endY, height * 0.12, 0.6, 12))
  }

  return { main, branches }
}

/** Rapid double-flicker then settle to a steady glow — a real strike's brightness curve, not a smooth fade. */
function strikeBrightness(elapsed: number): number {
  if (elapsed >= FLICKER_MS) return REST_BRIGHTNESS
  const beats: [number, number][] = [
    [0, 1],
    [40, 0.15],
    [70, 1],
    [115, 0.1],
    [150, 0.95],
    [210, 1],
    [260, 0.45],
    [FLICKER_MS, REST_BRIGHTNESS],
  ]
  for (let i = 0; i < beats.length - 1; i += 1) {
    const [t0, b0] = beats[i]
    const [t1, b1] = beats[i + 1]
    if (elapsed >= t0 && elapsed <= t1) {
      const t = (elapsed - t0) / (t1 - t0)
      return b0 + (b1 - b0) * t
    }
  }
  return REST_BRIGHTNESS
}

/** Fast per-frame writhe (endpoints pinned): quick sine sway plus true per-frame jitter, so the bolt is visibly restless every frame instead of gently drifting. */
function wigglePoints(points: Point[], time: number, seed: number): Point[] {
  return points.map(([x, y], i) => {
    if (i === 0 || i === points.length - 1) return [x, y]
    const phase = i * 1.7 + seed
    const dx = Math.sin(time * 9 + phase) * 2 + (Math.random() - 0.5) * 2.6
    const dy =
      Math.sin(time * 11 + phase * 1.3) * 2.6 +
      Math.sin(time * 4 + phase * 0.6) * 1.4 +
      (Math.random() - 0.5) * 3
    return [x + dx, y + dy]
  })
}

function buildPath(pointLists: Point[][]): Path2D {
  const path = new Path2D()
  pointLists.forEach((points) => {
    if (points.length < 2) return
    points.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)))
  })
  return path
}

interface ElectricTitleProps {
  children: ReactNode
  className?: string
}

export default function ElectricTitle({ children, className }: ElectricTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zapping, setZapping] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cssWidth = 0
    let cssHeight = 0
    let bolt: Bolt | null = null
    let strikeStart = performance.now() - FLICKER_MS
    let raf = 0
    let cancelled = false
    const timers: number[] = []

    const resize = () => {
      cssWidth = window.innerWidth
      const rect = container.getBoundingClientRect()
      cssHeight = Math.max(rect.height * 2.2, 200)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = cssWidth * dpr
      canvas.height = cssHeight * dpr
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      bolt = generateBolt(cssWidth, cssHeight)
    }

    const restrike = () => {
      if (cancelled) return
      bolt = generateBolt(cssWidth, cssHeight)
      strikeStart = performance.now()
      setZapping(true)
      timers.push(window.setTimeout(() => !cancelled && setZapping(false), 240))
      const delay = MIN_STRIKE_DELAY + Math.random() * (MAX_STRIKE_DELAY - MIN_STRIKE_DELAY)
      timers.push(window.setTimeout(restrike, delay))
    }

    const draw = () => {
      if (cancelled) return
      if (bolt) {
        const now = performance.now()
        const brightness = strikeBrightness(now - strikeStart)
        const time = now / 1000
        const mainPts = wigglePoints(bolt.main, time, 0)
        const branchPts = bolt.branches.map((branch, i) => wigglePoints(branch, time, (i + 1) * 11))
        const mainPath = buildPath([mainPts])
        const branchPath = buildPath(branchPts)
        const allPath = buildPath([mainPts, ...branchPts])

        ctx.clearRect(0, 0, cssWidth, cssHeight)
        ctx.save()

        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.globalCompositeOperation = 'lighter'

        ctx.shadowColor = `rgba(255, 190, 0, ${0.9 * brightness})`
        ctx.shadowBlur = 22
        ctx.strokeStyle = `rgba(255, 160, 0, ${0.5 * brightness})`
        ctx.lineWidth = 6
        ctx.stroke(allPath)

        ctx.shadowBlur = 6
        ctx.strokeStyle = `rgba(255, 221, 130, ${0.85 * brightness})`
        ctx.lineWidth = 1
        ctx.stroke(branchPath)

        ctx.shadowBlur = 10
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * brightness})`
        ctx.lineWidth = 1.6
        ctx.stroke(mainPath)

        ctx.restore()
      }
      raf = requestAnimationFrame(draw)
    }

    resize()
    timers.push(window.setTimeout(restrike, 1200))
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(draw)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', resize)
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  return (
    <div ref={containerRef} className="relative inline-block">
      <canvas ref={canvasRef} className="electric-lightning-canvas" aria-hidden="true" />
      <h1
        className={`electric-title${zapping ? ' is-zapping' : ''}${className ? ` ${className}` : ''}`}
      >
        {children}
      </h1>
    </div>
  )
}
