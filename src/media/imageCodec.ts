/*
  Tiny image codec (pure, unit-testable): median-cut palette quantization to 16
  colours + 4-bit indices. A real, lossy compressor — the kind of discipline the
  LoRa budget forces. A 64×64 frame lands near ~2 KB, fragmenting into ~12
  packets that genuinely reassemble and render at the destination.

  Layout: [w][h][paletteCount] [palette RGB × count] [4-bit indices, 2 per byte]
*/

const MAX_COLORS = 16

interface Box {
  pixels: number[] // indices into the flat RGB list
}

export function compress(rgba: Uint8Array, w: number, h: number): Uint8Array {
  const count = w * h
  const rgb = new Uint8Array(count * 3)
  for (let i = 0; i < count; i++) {
    rgb[i * 3] = rgba[i * 4]
    rgb[i * 3 + 1] = rgba[i * 4 + 1]
    rgb[i * 3 + 2] = rgba[i * 4 + 2]
  }

  // median cut
  let boxes: Box[] = [{ pixels: Array.from({ length: count }, (_, i) => i) }]
  while (boxes.length < MAX_COLORS) {
    // pick the box with the greatest channel range to split
    let target = -1
    let targetRange = -1
    let targetChannel = 0
    for (let b = 0; b < boxes.length; b++) {
      if (boxes[b].pixels.length < 2) continue
      for (let c = 0; c < 3; c++) {
        let lo = 255
        let hi = 0
        for (const p of boxes[b].pixels) {
          const v = rgb[p * 3 + c]
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
        if (hi - lo > targetRange) {
          targetRange = hi - lo
          target = b
          targetChannel = c
        }
      }
    }
    if (target < 0 || targetRange <= 0) break
    const box = boxes[target]
    box.pixels.sort((p, q) => rgb[p * 3 + targetChannel] - rgb[q * 3 + targetChannel])
    const mid = box.pixels.length >> 1
    const a: Box = { pixels: box.pixels.slice(0, mid) }
    const b2: Box = { pixels: box.pixels.slice(mid) }
    boxes.splice(target, 1, a, b2)
  }

  // palette = average colour of each box
  const palette: Array<[number, number, number]> = boxes.map((box) => {
    let r = 0
    let g = 0
    let b = 0
    for (const p of box.pixels) {
      r += rgb[p * 3]
      g += rgb[p * 3 + 1]
      b += rgb[p * 3 + 2]
    }
    const n = Math.max(1, box.pixels.length)
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
  })

  // map each pixel to nearest palette entry
  const indices = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    const r = rgb[i * 3]
    const g = rgb[i * 3 + 1]
    const b = rgb[i * 3 + 2]
    let best = 0
    let bestD = Infinity
    for (let p = 0; p < palette.length; p++) {
      const dr = r - palette[p][0]
      const dg = g - palette[p][1]
      const db = b - palette[p][2]
      const d = dr * dr + dg * dg + db * db
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    indices[i] = best
  }

  const packed = new Uint8Array(Math.ceil(count / 2))
  for (let i = 0; i < count; i++) {
    if ((i & 1) === 0) packed[i >> 1] = indices[i] & 0x0f
    else packed[i >> 1] |= (indices[i] & 0x0f) << 4
  }

  const out = new Uint8Array(3 + palette.length * 3 + packed.length)
  out[0] = w
  out[1] = h
  out[2] = palette.length
  let o = 3
  for (const [r, g, b] of palette) {
    out[o++] = r
    out[o++] = g
    out[o++] = b
  }
  out.set(packed, o)
  return out
}

export interface DecodedImage {
  rgba: Uint8Array
  w: number
  h: number
}

export function decompress(bytes: Uint8Array): DecodedImage {
  const w = bytes[0]
  const h = bytes[1]
  const pcount = bytes[2]
  const palette: Array<[number, number, number]> = []
  let o = 3
  for (let p = 0; p < pcount; p++) {
    palette.push([bytes[o], bytes[o + 1], bytes[o + 2]])
    o += 3
  }
  const count = w * h
  const rgba = new Uint8Array(count * 4)
  const packed = bytes.subarray(o)
  for (let i = 0; i < count; i++) {
    const byte = packed[i >> 1]
    const idx = (i & 1) === 0 ? byte & 0x0f : (byte >> 4) & 0x0f
    const c = palette[Math.min(idx, palette.length - 1)] ?? [0, 0, 0]
    rgba[i * 4] = c[0]
    rgba[i * 4 + 1] = c[1]
    rgba[i * 4 + 2] = c[2]
    rgba[i * 4 + 3] = 255
  }
  return { rgba, w, h }
}
