import type { DrawingBackground } from '../types/drawing'

// Longest edge of a rendered PDF page, in pixels.
const PDF_RENDER_SIZE = 2400

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not read image'))
    img.src = dataUrl
  })
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
  const viewport = page.getViewport({ scale: PDF_RENDER_SIZE / Math.max(base.width, base.height) })

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
  return { dataUrl, ...(await imageSize(dataUrl)), fileName: file.name }
}

export const ACCEPTED_FILE_TYPES = 'image/png,image/jpeg,image/webp,application/pdf'

export const BLANK_SHEET: DrawingBackground = { dataUrl: '', width: 1600, height: 1000, fileName: 'Blank sheet' }
