import { describe, it, expect } from 'vitest'
import { downsample, encodeAdpcm, decodeAdpcm, adpcmKbps } from '../adpcm'
import { compress, decompress } from '../imageCodec'

describe('ADPCM voice codec', () => {
  it('round-trips a tone with bounded error and preserves length + rate', () => {
    const srcRate = 8000
    const dstRate = 4000
    const seconds = 0.5
    const src = new Float32Array(srcRate * seconds)
    for (let i = 0; i < src.length; i++) src[i] = 0.6 * Math.sin((2 * Math.PI * 220 * i) / srcRate)

    const low = downsample(src, srcRate, dstRate)
    const bytes = encodeAdpcm(low, dstRate)
    const { samples, sampleRate } = decodeAdpcm(bytes)

    expect(sampleRate).toBe(dstRate)
    expect(samples.length).toBe(low.length)

    // mean absolute error should be small for a smooth signal
    let err = 0
    for (let i = 0; i < low.length; i++) err += Math.abs(low[i] - samples[i])
    expect(err / low.length).toBeLessThan(0.08)

    // real compression: 4 bits/sample ≈ half a byte each
    expect(bytes.length).toBeLessThan(low.length)
    expect(adpcmKbps(bytes)).toBeGreaterThan(0)
  })
})

describe('image codec (median-cut palette)', () => {
  it('compresses to well under raw and reconstructs dimensions + approx colour', () => {
    const w = 32
    const h = 32
    const rgba = new Uint8Array(w * h * 4)
    // smooth gradient — few dominant colours, good for a 16-colour palette
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        rgba[i] = (x / w) * 255
        rgba[i + 1] = (y / h) * 255
        rgba[i + 2] = 128
        rgba[i + 3] = 255
      }
    }

    const packed = compress(rgba, w, h)
    expect(packed.length).toBeLessThan(rgba.length / 3) // << raw RGBA

    const out = decompress(packed)
    expect(out.w).toBe(w)
    expect(out.h).toBe(h)
    expect(out.rgba.length).toBe(rgba.length)

    // average per-channel error should be modest for a smooth gradient
    let err = 0
    for (let i = 0; i < rgba.length; i++) err += Math.abs(rgba[i] - out.rgba[i])
    expect(err / rgba.length).toBeLessThan(28)
  })
})
