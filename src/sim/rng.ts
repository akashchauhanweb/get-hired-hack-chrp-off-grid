/*
  Deterministic PRNG (mulberry32). Seedable so a whole simulation run is
  reproducible — essential for honest, repeatable demos and for the fountain
  codec, where sender and receiver must derive the SAME neighbour sets from a
  shared symbol seed without transmitting the neighbour list.
*/

export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Bernoulli trial: returns true with probability p. */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p
}

/** Integer in [min, max]. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** FNV-1a hash of a string → 32-bit int, handy for deriving stable seeds. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
