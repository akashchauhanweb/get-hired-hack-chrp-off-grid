import { describe, it, expect } from 'vitest'
import { makeEncoder, decode } from '../fountain'
import { bytesEqual } from '../bytes'
import { mulberry32 } from '../../sim/rng'

function randomData(len: number, seed: number): Uint8Array {
  const rng = mulberry32(seed)
  const d = new Uint8Array(len)
  for (let i = 0; i < len; i++) d[i] = Math.floor(rng() * 256)
  return d
}

describe('LT fountain code', () => {
  it('reconstructs exactly from a sufficient subset of symbols', () => {
    const data = randomData(2000, 123) // ~10 blocks at 200B
    const enc = makeEncoder(data, 200)

    // generate a generous stream of symbols with distinct seeds
    const symbols = Array.from({ length: enc.k * 3 }, (_, i) => enc.symbol(1000 + i))

    // deliver ~1.5x K of them (simulating overhead needed by LT)
    const received = symbols.slice(0, Math.ceil(enc.k * 1.6))
    const res = decode(received, enc.k, enc.symbolSize, enc.dataLength)

    expect(res.recovered).not.toBeNull()
    expect(bytesEqual(res.recovered!, data)).toBe(true)
  })

  it('honestly fails (null) when too few symbols arrive', () => {
    const data = randomData(2000, 7)
    const enc = makeEncoder(data, 200)
    const symbols = Array.from({ length: enc.k * 3 }, (_, i) => enc.symbol(500 + i))
    const tooFew = symbols.slice(0, Math.floor(enc.k * 0.5))
    const res = decode(tooFew, enc.k, enc.symbolSize, enc.dataLength)
    expect(res.recovered).toBeNull()
    expect(res.solvedBlocks).toBeLessThan(enc.k)
  })

  it('recovers from an arbitrary (shuffled, gap-ridden) subset — order independent', () => {
    const data = randomData(3000, 99)
    const enc = makeEncoder(data, 200)
    const all = Array.from({ length: enc.k * 4 }, (_, i) => enc.symbol(i * 7 + 3))
    // drop ~40% at random, then shuffle what's left
    const rng = mulberry32(42)
    const kept = all.filter(() => rng() > 0.4)
    for (let i = kept.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[kept[i], kept[j]] = [kept[j], kept[i]]
    }
    const res = decode(kept, enc.k, enc.symbolSize, enc.dataLength)
    expect(res.recovered).not.toBeNull()
    expect(bytesEqual(res.recovered!, data)).toBe(true)
  })

  it('measures realistic decode overhead (< 2.0x K on average)', () => {
    let totalNeeded = 0
    const trials = 20
    for (let t = 0; t < trials; t++) {
      const data = randomData(2000, t + 1)
      const enc = makeEncoder(data, 200)
      let needed = 0
      const got: ReturnType<typeof enc.symbol>[] = []
      for (let i = 0; i < enc.k * 5; i++) {
        got.push(enc.symbol(t * 1000 + i))
        needed++
        if (decode(got, enc.k, enc.symbolSize, enc.dataLength).recovered) break
      }
      totalNeeded += needed / enc.k
    }
    const avgOverhead = totalNeeded / trials
    expect(avgOverhead).toBeLessThan(2.0)
  })
})
