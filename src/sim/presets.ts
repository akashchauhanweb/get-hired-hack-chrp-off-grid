/*
  Radio presets — real Meshtastic LoRa data rates (theoretical max, headers
  ignored), from meshtastic.org radio-settings docs. Airtime is computed from
  the chosen preset so the bandwidth budget is visceral: at Long Fast ≈1.07 kbps,
  one 200-byte fragment ≈ 1.5 s on air.
*/

export type PresetId = 'SHORT_TURBO' | 'SHORT_FAST' | 'LONG_FAST' | 'LONG_MODERATE'

export interface RadioPreset {
  id: PresetId
  label: string
  bitrateKbps: number
}

export const PRESETS: Record<PresetId, RadioPreset> = {
  SHORT_TURBO: { id: 'SHORT_TURBO', label: 'Short Turbo', bitrateKbps: 21.88 },
  SHORT_FAST: { id: 'SHORT_FAST', label: 'Short Fast', bitrateKbps: 10.94 },
  LONG_FAST: { id: 'LONG_FAST', label: 'Long Fast', bitrateKbps: 1.07 },
  LONG_MODERATE: { id: 'LONG_MODERATE', label: 'Long Moderate', bitrateKbps: 0.34 },
}

export const DEFAULT_PRESET: PresetId = 'LONG_FAST'

/** Seconds a packet of `bytes` takes on air at the preset's data rate. */
export function airtimeSeconds(preset: RadioPreset, bytes: number): number {
  const bits = bytes * 8
  return bits / (preset.bitrateKbps * 1000)
}
