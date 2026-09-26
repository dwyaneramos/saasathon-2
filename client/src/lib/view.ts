import type { Point } from '../types/drawing'

export interface View {
  x: number
  y: number
  w: number
  h: number
}

export function fitView(width: number, height: number): View {
  const pad = Math.max(width, height) * 0.03
  return { x: -pad, y: -pad, w: width + pad * 2, h: height + pad * 2 }
}

export function zoomView(view: View, factor: number, center: Point, imageWidth: number): View {
  const w = Math.min(Math.max(view.w * factor, imageWidth / 25), imageWidth * 4)
  const actual = w / view.w
  return {
    x: center.x - (center.x - view.x) * actual,
    y: center.y - (center.y - view.y) * actual,
    w,
    h: view.h * actual,
  }
}
