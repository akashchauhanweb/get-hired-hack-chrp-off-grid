/*
  Image (browser layer). Produces the real bytes the pipeline transmits and
  renders reconstructed bytes back to a canvas. The hero image is drawn
  procedurally (self-contained, no asset), downscaled to 64×64, and compressed
  with the palette codec; judges can also drop in their own photo.
*/
import { compress, decompress } from './imageCodec'
import { sha256Hex } from './hash'
import type { MediaInput } from '../engine/simulation'

export const IMG_SIZE = 64

export interface ImageAsset {
  input: MediaInput
  width: number
  height: number
  originalRgba: Uint8Array // pre-compression, for the sender preview
}

function canvasRgba(draw: (ctx: CanvasRenderingContext2D) => void): Uint8Array {
  const c = document.createElement('canvas')
  c.width = IMG_SIZE
  c.height = IMG_SIZE
  const ctx = c.getContext('2d')!
  draw(ctx)
  return new Uint8Array(ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE).data.buffer.slice(0))
}

async function assetFromRgba(rgba: Uint8Array, label = 'image.png'): Promise<ImageAsset> {
  const payload = compress(rgba, IMG_SIZE, IMG_SIZE)
  const input: MediaInput = {
    id: 'image',
    label,
    payload,
    originalHash: await sha256Hex(payload),
  }
  return { input, width: IMG_SIZE, height: IMG_SIZE, originalRgba: rgba }
}

/** A small procedurally-drawn "photo": dusk sky, sun, hills, horizon. */
export async function heroImage(): Promise<ImageAsset> {
  const rgba = canvasRgba((ctx) => {
    const S = IMG_SIZE
    const sky = ctx.createLinearGradient(0, 0, 0, S)
    sky.addColorStop(0, '#2a3a6b')
    sky.addColorStop(0.5, '#c75b4a')
    sky.addColorStop(1, '#e0a33e')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, S, S)
    // sun
    ctx.fillStyle = '#f3d27a'
    ctx.beginPath()
    ctx.arc(S * 0.68, S * 0.5, S * 0.12, 0, Math.PI * 2)
    ctx.fill()
    // far hill
    ctx.fillStyle = '#7a3f3a'
    ctx.beginPath()
    ctx.moveTo(0, S * 0.62)
    ctx.quadraticCurveTo(S * 0.3, S * 0.5, S * 0.6, S * 0.63)
    ctx.quadraticCurveTo(S * 0.8, S * 0.7, S, S * 0.6)
    ctx.lineTo(S, S)
    ctx.lineTo(0, S)
    ctx.fill()
    // near hill
    ctx.fillStyle = '#2f2420'
    ctx.beginPath()
    ctx.moveTo(0, S * 0.78)
    ctx.quadraticCurveTo(S * 0.4, S * 0.68, S, S * 0.8)
    ctx.lineTo(S, S)
    ctx.lineTo(0, S)
    ctx.fill()
  })
  return assetFromRgba(rgba, 'sunset-sample.png')
}

/** Downscale a user-supplied image file to 64×64 and compress it. */
export async function imageFromFile(file: File): Promise<ImageAsset> {
  const bitmap = await createImageBitmap(file)
  const rgba = canvasRgba((ctx) => {
    ctx.imageSmoothingEnabled = true
    // cover-fit the source into the square frame
    const s = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - s) / 2
    const sy = (bitmap.height - s) / 2
    ctx.drawImage(bitmap, sx, sy, s, s, 0, 0, IMG_SIZE, IMG_SIZE)
  })
  return assetFromRgba(rgba, file.name)
}

/** Draw raw RGBA (64×64) into a target canvas, crisp-scaled. */
export function drawRgba(rgba: Uint8Array, canvas: HTMLCanvasElement): void {
  const off = document.createElement('canvas')
  off.width = IMG_SIZE
  off.height = IMG_SIZE
  const octx = off.getContext('2d')!
  octx.putImageData(new ImageData(new Uint8ClampedArray(rgba), IMG_SIZE, IMG_SIZE), 0, 0)

  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(off, 0, 0, IMG_SIZE, IMG_SIZE, 0, 0, canvas.width, canvas.height)
}

/** Decompress transmitted/reconstructed payload bytes and draw them. */
export function renderPayload(payload: Uint8Array, canvas: HTMLCanvasElement): void {
  const { rgba } = decompress(payload)
  drawRgba(rgba, canvas)
}
