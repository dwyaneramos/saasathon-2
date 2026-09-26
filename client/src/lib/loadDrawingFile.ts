import type { DrawingBackground } from '../types/drawing'

// Longest edge a stored plan is allowed to be, in pixels - keeps IndexedDB storage,
// upload size, and auto-detect request/processing time bounded regardless of how
// large the source photo/scan/PDF page was.
const MAX_IMAGE_EDGE = 2400

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = dataUrl
  })
}

// Downscales via canvas only when the image actually exceeds the cap - untouched
// otherwise, so ordinary-sized uploads keep their original quality.
async function capImageSize(dataUrl: string, width: number, height: number) {
  const longest = Math.max(width, height)
  if (longest <= MAX_IMAGE_EDGE) return { dataUrl, width, height }

  const scale = MAX_IMAGE_EDGE / longest
  const targetWidth = Math.round(width * scale)
  const targetHeight = Math.round(height * scale)
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  canvas.getContext('2d')!.drawImage(img, 0, 0, targetWidth, targetHeight)
  return { dataUrl: canvas.toDataURL('image/png'), width: targetWidth, height: targetHeight }
}

async function renderPdfFirstPage(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() })
  const pdf = await loadingTask.promise
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: MAX_IMAGE_EDGE / Math.max(base.width, base.height) })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  await page.render({ canvas, viewport }).promise
  await loadingTask.destroy()

  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
}

export async function loadDrawingFile(file: File): Promise<DrawingBackground> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return { ...(await renderPdfFirstPage(file)), fileName: file.name }
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Upload an image (PNG, JPG) or a PDF.')
  }
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)
  const capped = await capImageSize(dataUrl, img.naturalWidth, img.naturalHeight)
  return { ...capped, fileName: file.name }
}

export const ACCEPTED_FILE_TYPES = 'image/png,image/jpeg,image/webp,application/pdf'

export const BLANK_SHEET: DrawingBackground = { dataUrl: '', width: 1600, height: 1000, fileName: 'Blank sheet' }
