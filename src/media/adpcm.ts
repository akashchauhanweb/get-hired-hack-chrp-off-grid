/*
  IMA ADPCM voice codec (pure, dependency-free, unit-testable).

  This is our honest "Codec2-rate" voice path: we are NOT running Codec2 (too
  heavy for a clean build) and this is NOT a size-model — it is a real adaptive
  codec operating on real PCM. We decimate speech to a low sample rate and encode
  at 4 bits/sample, then REPORT the true resulting bitrate so the per-byte
  accounting is honest. At 4 kHz that is ~16 kbps; drop the target rate toward
  the Codec2 band (0.7–3.2 kbps) and it degrades gracefully, exactly dramatizing
  the LoRa bandwidth budget.
*/

const STEP_TABLE = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73,
  80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494,
  544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499,
  2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487,
  12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
]
const INDEX_TABLE = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8]

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** Average-decimate a Float32 signal from srcRate to dstRate (dstRate < srcRate). */
export function downsample(input: Float32Array, srcRate: number, dstRate: number): Float32Array {
  if (dstRate >= srcRate) return input.slice()
  const ratio = srcRate / dstRate
  const outLen = Math.floor(input.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = end > start ? sum / (end - start) : 0
  }
  return out
}

/** Encode Float32 [-1,1] PCM to IMA ADPCM bytes with a small header. */
export function encodeAdpcm(samples: Float32Array, sampleRate: number): Uint8Array {
  const n = samples.length
  const nibbles = new Uint8Array(Math.ceil(n / 2))

  let predictor = Math.round(clamp(samples[0] ?? 0, -1, 1) * 32767)
  let index = 0
  const initPredictor = predictor

  let bufByte = 0
  let bufHasHigh = false
  let outPos = 0

  for (let i = 0; i < n; i++) {
    const sample = clamp(Math.round(samples[i] * 32767), -32768, 32767)
    let step = STEP_TABLE[index]
    let diff = sample - predictor
    let code = 0
    if (diff < 0) {
      code = 8
      diff = -diff
    }
    let tmpStep = step
    if (diff >= tmpStep) {
      code |= 4
      diff -= tmpStep
    }
    tmpStep >>= 1
    if (diff >= tmpStep) {
      code |= 2
      diff -= tmpStep
    }
    tmpStep >>= 1
    if (diff >= tmpStep) code |= 1

    // mirror the decoder to keep predictor in sync
    let diffq = step >> 3
    if (code & 4) diffq += step
    if (code & 2) diffq += step >> 1
    if (code & 1) diffq += step >> 2
    predictor += code & 8 ? -diffq : diffq
    predictor = clamp(predictor, -32768, 32767)
    index = clamp(index + INDEX_TABLE[code], 0, STEP_TABLE.length - 1)

    if (!bufHasHigh) {
      bufByte = code & 0x0f
      bufHasHigh = true
    } else {
      nibbles[outPos++] = bufByte | ((code & 0x0f) << 4)
      bufHasHigh = false
    }
  }
  if (bufHasHigh) nibbles[outPos++] = bufByte

  const out = new Uint8Array(8 + nibbles.length)
  const dv = new DataView(out.buffer)
  dv.setUint16(0, sampleRate)
  dv.setUint32(2, n)
  dv.setInt16(6, initPredictor)
  out.set(nibbles, 8)
  return out
}

export interface DecodedPcm {
  samples: Float32Array
  sampleRate: number
}

export function decodeAdpcm(bytes: Uint8Array): DecodedPcm {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const sampleRate = dv.getUint16(0)
  const n = dv.getUint32(2)
  let predictor = dv.getInt16(6)
  let index = 0

  const out = new Float32Array(n)
  const nibbles = bytes.subarray(8)
  for (let i = 0; i < n; i++) {
    const byte = nibbles[i >> 1]
    const code = i & 1 ? (byte >> 4) & 0x0f : byte & 0x0f
    const step = STEP_TABLE[index]
    let diffq = step >> 3
    if (code & 4) diffq += step
    if (code & 2) diffq += step >> 1
    if (code & 1) diffq += step >> 2
    predictor += code & 8 ? -diffq : diffq
    predictor = clamp(predictor, -32768, 32767)
    index = clamp(index + INDEX_TABLE[code], 0, STEP_TABLE.length - 1)
    out[i] = predictor / 32767
  }
  return { samples: out, sampleRate }
}

/** True bitrate (kbps) of an ADPCM byte stream given its sample count + rate. */
export function adpcmKbps(bytes: Uint8Array): number {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const sampleRate = dv.getUint16(0)
  const n = dv.getUint32(2)
  const durationSec = n / sampleRate
  return durationSec > 0 ? (bytes.length * 8) / durationSec / 1000 : 0
}
