import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { ARButton } from 'three/addons/webxr/ARButton.js'
import { COMPONENTS } from '../../data/catalogue'
import { wirePath } from '../../lib/materials'
import type { ComponentKind, Drawing, PlacedComponent, Wire } from '../../types/drawing'

const RETICLE_COLOUR = 0xffcc00
const WIRE_THICKNESS_M = 0.03
const WIRE_RIBBON_DEPTH_M = 0.01
const ROTATE_STEP_RAD = THREE.MathUtils.degToRad(15)

// One colour per kind so components read apart at a glance - the 2D editor only
// differentiates these by icon shape (everything is drawn in a single ink colour),
// so this scheme is new for AR, not a mapping pulled from an existing convention.
const KIND_COLOURS: Record<ComponentKind, number> = {
  socket: 0x2e8b57, // sea green - power outlets
  'double-socket': 0x2e8b57,
  switch: 0xff9800, // amber - switches
  'two-way-switch': 0xff9800,
  light: 0xffe066, // pale yellow - lighting
  downlight: 0xffe066,
  switchboard: 0xe3350d, // brand red - the board
  'junction-box': 0x6b6b6b, // grey - junctions
}

// Typical NZ residential mounting heights, purely so the AR overlay places each fixture
// somewhere realistic - the plan is a 2D schematic with no height information of its own,
// so this is a reasonable default per fixture type, not something read off the drawing.
const KIND_HEIGHT_M: Record<ComponentKind, number> = {
  socket: 0.3, // 300mm AFFL - standard NZ GPO height
  'double-socket': 0.3,
  switch: 1.2, // standard light-switch height
  'two-way-switch': 1.2,
  light: 2.4, // ceiling-mounted
  downlight: 2.4,
  switchboard: 1.5,
  'junction-box': 2.3, // usually up near the ceiling void
}
const FALLBACK_WIRE_HEIGHT_M = 1.5 // a wire end not tied to any nearby component
// Above the highest fixture height (light/downlight at 2.4m), so a wire always rises to
// this on its way out, regardless of which two kinds it's connecting.
const ROUTING_HEIGHT_M = 2.5
// A wire end within this real-world distance of a component is treated as connecting to
// it (for height purposes) even without a formal fromId/toId link - auto-detected wires
// are just traced pixel paths with no such link, so without this they'd render flat at
// FALLBACK_WIRE_HEIGHT_M and never actually reach the marker they're meant to connect to.
const PROXIMITY_THRESHOLD_M = 0.5

// A thin horizontal rectangle between two points - plain Mesh + MeshBasicMaterial,
// the same primitive type as the component markers, so it renders on every device
// the markers already render on (unlike the fat-line addons, which need instanced-
// attribute support that isn't guaranteed across GPUs/WebXR contexts).
function addWireSegment(
  group: THREE.Group,
  a: THREE.Vector3,
  b: THREE.Vector3,
  material: THREE.Material,
  userData: object,
) {
  const length = a.distanceTo(b)
  if (length < 0.001) return
  const segment = new THREE.Mesh(
    new THREE.BoxGeometry(length, WIRE_RIBBON_DEPTH_M, WIRE_THICKNESS_M),
    material,
  )
  segment.position.addVectors(a, b).multiplyScalar(0.5)
  segment.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize())
  segment.userData = userData
  group.add(segment)
}

function nearestComponentKind(
  point: { x: number; y: number },
  components: readonly PlacedComponent[],
  pixelThreshold: number,
): ComponentKind | undefined {
  let bestKind: ComponentKind | undefined
  let bestDistSq = pixelThreshold * pixelThreshold
  for (const c of components) {
    const distSq = (c.x - point.x) ** 2 + (c.y - point.y) ** 2
    if (distSq <= bestDistSq) {
      bestDistSq = distSq
      bestKind = c.kind
    }
  }
  return bestKind
}

// Builds the plan as a flat "hologram" in metres, centred on its own bounding box -
// the caller positions the returned group at wherever the user taps the floor.
function buildPlanGroup(drawing: Drawing): THREE.Group {
  const group = new THREE.Group()
  const scale = drawing.metresPerPx
  if (!scale) return group

  const background = drawing.background
  const centerX = background ? background.width / 2 : 0
  const centerY = background ? background.height / 2 : 0

  const toLocal = (p: { x: number; y: number }, height: number) =>
    new THREE.Vector3((p.x - centerX) * scale, height, (p.y - centerY) * scale)

  const componentById = new Map(drawing.components.map((c) => [c.id, c]))
  const pixelThreshold = PROXIMITY_THRESHOLD_M / scale
  const heightForEnd = (id: string | undefined, point: { x: number; y: number }) => {
    const linkedKind = id ? componentById.get(id)?.kind : undefined
    const kind = linkedKind ?? nearestComponentKind(point, drawing.components, pixelThreshold)
    return kind ? KIND_HEIGHT_M[kind] : FALLBACK_WIRE_HEIGHT_M
  }

  // Routed like real conduit - straight up to ceiling-void height, across (keeping the
  // path's original shape, which already tends to follow corridors since that's how the
  // circuit was drawn), then straight down into the fixture - rather than one long
  // diagonal line climbing steadily the whole way, which reads as random and looks like
  // it's cutting through rooms at head height.
  const wireMaterial = new THREE.MeshBasicMaterial({ color: 0x1f5fbf })
  for (const wire of drawing.wires) {
    const path = wirePath(wire, drawing.components)
    if (path.length < 2) continue
    const fromHeight = heightForEnd(wire.fromId, path[0]!)
    const toHeight = heightForEnd(wire.toId, path[path.length - 1]!)
    const first = path[0]!
    const last = path[path.length - 1]!
    const points = [
      toLocal(first, fromHeight),
      toLocal(first, ROUTING_HEIGHT_M),
      ...path.slice(1, -1).map((p) => toLocal(p, ROUTING_HEIGHT_M)),
      toLocal(last, ROUTING_HEIGHT_M),
      toLocal(last, toHeight),
    ]
    for (let i = 1; i < points.length; i++) {
      addWireSegment(group, points[i - 1]!, points[i]!, wireMaterial, { kind: 'wire', wire })
    }
  }

  // Small floating markers at each fixture's real mounting height - previously everything
  // sat at floor level regardless of kind, so downlights appeared to be in the ground.
  const markerMaterials = new Map<ComponentKind, THREE.MeshBasicMaterial>()
  const markerMaterialFor = (kind: ComponentKind) => {
    let material = markerMaterials.get(kind)
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color: KIND_COLOURS[kind] })
      markerMaterials.set(kind, material)
    }
    return material
  }
  for (const component of drawing.components) {
    const radius = component.kind === 'switchboard' ? 0.08 : 0.05
    const marker = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), markerMaterialFor(component.kind))
    marker.position.copy(toLocal(component, KIND_HEIGHT_M[component.kind]))
    marker.userData = { kind: 'component', component }
    group.add(marker)
  }

  return group
}

type TapInfo = { kind: 'component'; component: PlacedComponent } | { kind: 'wire'; wire: Wire }

function describeTapInfo(info: TapInfo): string {
  if (info.kind === 'component') {
    return `${info.component.label} - ${COMPONENTS[info.component.kind].name}`
  }
  const circuit = info.wire.circuit ? ` - ${info.wire.circuit}` : ''
  return `${info.wire.cableType} ${info.wire.sizeMm2}mm² wire${circuit}`
}

interface ARViewProps {
  drawing: Drawing
}

// Imperative Three.js/WebXR setup - React only owns the mount point.
function ARView({ drawing }: ARViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.xr.enabled = true
    container.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2))

    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: RETICLE_COLOUR }),
    )
    reticle.matrixAutoUpdate = false
    reticle.visible = false
    scene.add(reticle)

    // Hidden until the user taps a detected surface; then it snaps to that pose. Hit-test
    // orientation is arbitrary (there's no reliable way to detect true compass alignment),
    // so a nested group carries a separate manual rotation the rotate buttons adjust,
    // independent of - and preserved across - re-taps that reposition the outer anchor.
    const placementAnchor = new THREE.Group()
    placementAnchor.visible = false
    const rotationAnchor = new THREE.Group()
    rotationAnchor.add(buildPlanGroup(drawing))
    placementAnchor.add(rotationAnchor)
    scene.add(placementAnchor)

    let hitTestSource: XRHitTestSource | null = null
    let hitTestSourceRequested = false

    // Tapping a placed marker/wire shows what it is instead of moving the whole plan -
    // only an empty tap (nothing under the ray) falls through to placement/reposition.
    const raycaster = new THREE.Raycaster()
    const controller = renderer.xr.getController(0)
    controller.addEventListener('select', () => {
      if (placementAnchor.visible) {
        raycaster.setFromXRController(controller)
        const hit = raycaster.intersectObjects(rotationAnchor.children, true).find((h) => h.object.userData.kind)
        if (hit) {
          showInfo(describeTapInfo(hit.object.userData as TapInfo))
          return
        }
      }
      if (!reticle.visible) return
      placementAnchor.position.setFromMatrixPosition(reticle.matrix)
      placementAnchor.quaternion.setFromRotationMatrix(reticle.matrix)
      placementAnchor.visible = true
    })
    scene.add(controller)

    // WebXR only shows page DOM during an immersive session if it's registered as the
    // dom-overlay's root - a plain element outside this (like a normal React node) never
    // renders once the session starts, so status text needs to live here instead.
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;inset:0;display:none;pointer-events:none;font-family:"DM Sans",sans-serif'
    const status = document.createElement('p')
    status.style.cssText =
      'position:absolute;top:96px;left:50%;transform:translateX(-50%);max-width:80vw;text-align:center;' +
      'background:rgba(0,0,0,0.65);color:#fff;padding:8px 16px;border-radius:999px;font-size:13px;margin:0'
    overlay.appendChild(status)

    const infoToast = document.createElement('p')
    infoToast.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);max-width:80vw;text-align:center;' +
      'background:rgba(0,0,0,0.8);color:#ffcc00;padding:10px 18px;border-radius:12px;font-size:15px;' +
      'font-weight:600;margin:0;opacity:0;transition:opacity 0.3s'
    overlay.appendChild(infoToast)
    let infoHideTimer: number | undefined
    function showInfo(text: string) {
      infoToast.textContent = text
      infoToast.style.opacity = '1'
      window.clearTimeout(infoHideTimer)
      infoHideTimer = window.setTimeout(() => {
        infoToast.style.opacity = '0'
      }, 4000)
    }

    function roundButton(label: string, cssText: string): HTMLButtonElement {
      const button = document.createElement('button')
      button.textContent = label
      button.style.cssText =
        'pointer-events:auto;border-radius:999px;border:1px solid #fff;background:rgba(0,0,0,0.65);color:#fff;' +
        cssText
      return button
    }

    // Only useful once something is placed, so tucked next to Exit rather than shown up front.
    const rotateRow = document.createElement('div')
    rotateRow.style.cssText =
      'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:12px;align-items:center'
    const rotateLeft = roundButton('⟲', 'width:44px;height:44px;font-size:18px')
    const exitButton = roundButton('Exit AR', 'padding:10px 20px;font-size:13px')
    const rotateRight = roundButton('⟳', 'width:44px;height:44px;font-size:18px')
    rotateLeft.onclick = () => {
      rotationAnchor.rotation.y -= ROTATE_STEP_RAD
    }
    rotateRight.onclick = () => {
      rotationAnchor.rotation.y += ROTATE_STEP_RAD
    }
    exitButton.onclick = () => void renderer.xr.getSession()?.end()
    rotateRow.append(rotateLeft, exitButton, rotateRight)
    overlay.appendChild(rotateRow)
    document.body.appendChild(overlay)

    let lastStatus = ''
    function setStatus(text: string) {
      if (text === lastStatus) return
      lastStatus = text
      status.textContent = text
    }

    function onSessionEnd() {
      hitTestSource = null
      hitTestSourceRequested = false
    }
    renderer.xr.addEventListener('sessionend', onSessionEnd)

    function render(_time: number, frame?: XRFrame) {
      if (frame) {
        const session = renderer.xr.getSession()
        const referenceSpace = renderer.xr.getReferenceSpace()

        if (!hitTestSourceRequested && session) {
          hitTestSourceRequested = true
          session.requestReferenceSpace('viewer').then((viewerSpace) => {
            session.requestHitTestSource?.({ space: viewerSpace })?.then((source) => {
              hitTestSource = source ?? null
            })
          })
        }

        if (hitTestSource && referenceSpace) {
          const hits = frame.getHitTestResults(hitTestSource)
          const pose = hits[0]?.getPose(referenceSpace)
          if (pose) {
            reticle.visible = true
            reticle.matrix.fromArray(pose.transform.matrix)
          } else {
            reticle.visible = false
          }
        }

        if (placementAnchor.visible)
          setStatus('Placed - look around. Tap the floor again to move it, or use ⟲/⟳ to rotate it.')
        else if (reticle.visible) setStatus('Tap the floor to place the plan.')
        else setStatus('Move your phone slowly to find the floor…')
      }

      renderer.render(scene, camera)
    }
    renderer.setAnimationLoop(render)

    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: overlay },
    })
    document.body.appendChild(arButton)

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.clearTimeout(infoHideTimer)
      window.removeEventListener('resize', onResize)
      renderer.xr.removeEventListener('sessionend', onSessionEnd)
      renderer.setAnimationLoop(null)
      renderer.dispose()
      arButton.remove()
      overlay.remove()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [drawing])

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black">
      <p className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-center font-[DM_Sans] text-xs text-white">
        Tap "Start AR" to begin.
      </p>
    </div>
  )
}

export default ARView
