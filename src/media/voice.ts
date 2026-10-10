/*
  Voice (browser layer). Honest "Codec2-rate" path: capture real PCM from the
  mic, decimate to a low speech rate, encode with real IMA ADPCM, transmit those
  bytes, and play back the reconstruction. We do NOT run actual Codec2 and this is
  NOT a size-model — we report the TRUE resulting bitrate. If the mic is denied,
  a synthesized sample keeps the demo alive (surfaced honestly in the UI).
*/
import { downsample, encodeAdpcm, decodeAdpcm, adpcmKbps } from './adpcm'
import { sha256Hex } from './hash'
import type { MediaInput } from '../engine/simulation'

export const VOICE_RATE = 4000 // Hz — speech band; 4-bit ADPCM ≈ 16 kbps, reported honestly

export interface VoiceAsset {
  input: MediaInput
  durationSec: number
  kbps: number
  sampleRate: number
  waveform: number[] // 0..1 bar heights for the UI
  source: 'mic' | 'sample'
}

function waveformOf(samples: Float32Array, bars = 40): number[] {
  const out: number[] = []
  const bucket = Math.max(1, Math.floor(samples.length / bars))
  for (let b = 0; b < bars; b++) {
    let peak = 0
    for (let i = b * bucket; i < (b + 1) * bucket && i < samples.length; i++) {
      peak = Math.max(peak, Math.abs(samples[i]))
    }
    out.push(Math.min(1, peak))
  }
  return out
}

async function assetFrom(low: Float32Array, source: 'mic' | 'sample'): Promise<VoiceAsset> {
  const bytes = encodeAdpcm(low, VOICE_RATE)
  const input: MediaInput = {
    id: 'voice',
    label: 'voice-note',
    payload: bytes,
    originalHash: await sha256Hex(bytes),
  }
  return {
    input,
    durationSec: low.length / VOICE_RATE,
    kbps: adpcmKbps(bytes),
    sampleRate: VOICE_RATE,
    waveform: waveformOf(low),
    source,
  }
}

/** Record `seconds` from the mic → decimate → ADPCM. Throws if denied. */
export async function recordVoice(seconds = 3): Promise<VoiceAsset> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  try {
    const ctx = new AudioContext()
    const chunks: BlobPart[] = []
    const mr = new MediaRecorder(stream)
    const done = new Promise<void>((resolve) => (mr.onstop = () => resolve()))
    mr.ondataavailable = (e) => chunks.push(e.data)
    mr.start()
    await new Promise((r) => setTimeout(r, seconds * 1000))
    mr.stop()
    await done
    const buf = await ctx.decodeAudioData(await new Blob(chunks).arrayBuffer())
    const mono = buf.getChannelData(0)
    const low = downsample(mono, buf.sampleRate, VOICE_RATE)
    await ctx.close()
    return assetFrom(low, 'mic')
  } finally {
    stream.getTracks().forEach((t) => t.stop())
  }
}

/** Synthesized speech-like fallback (formants + syllable envelope). */
export async function sampleVoice(seconds = 2): Promise<VoiceAsset> {
  const n = Math.floor(VOICE_RATE * seconds)
  const s = new Float32Array(n)
  const formants = [320, 800, 2600]
  for (let i = 0; i < n; i++) {
    const t = i / VOICE_RATE
    const pitch = 120 + 12 * Math.sin(2 * Math.PI * 5 * t) // vibrato
    // syllabic amplitude envelope with gaps
    const syl = Math.max(0, Math.sin(2 * Math.PI * 2.5 * t))
    const env = syl * syl * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.7 * t))
    let v = 0
    v += 0.6 * Math.sin(2 * Math.PI * pitch * t)
    for (const f of formants) v += 0.2 * Math.sin(2 * Math.PI * f * t)
    s[i] = Math.max(-1, Math.min(1, v * env * 0.5))
  }
  return assetFrom(s, 'sample')
}

/** Decode payload ADPCM bytes and play them. Returns the duration played. */
export async function playPayload(payload: Uint8Array): Promise<number> {
  const { samples, sampleRate } = decodeAdpcm(payload)
  const ctx = new AudioContext()
  const buffer = ctx.createBuffer(1, samples.length, sampleRate)
  buffer.getChannelData(0).set(samples)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(ctx.destination)
  src.start()
  const dur = samples.length / sampleRate
  src.onended = () => ctx.close()
  return dur
}

export function payloadWaveform(payload: Uint8Array, bars = 40): number[] {
  const { samples } = decodeAdpcm(payload)
  return waveformOf(samples, bars)
}
