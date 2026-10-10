/*
  LT fountain (erasure) code — hand-rolled, no dependency. This is the hero:
  a rateless code that rebuilds the original from ANY sufficient subset of
  received symbols, so a lost fragment never needs a targeted retransmit.

  Each encoded symbol carries only a 32-bit SEED plus its payload. Both encoder
  and decoder derive the symbol's source-block neighbour set from that seed via
  the same PRNG + Robust Soliton degree distribution, so the neighbour list is
  never transmitted. Decoding is belief-propagation "peeling".

  References: Luby (2002), Robust Soliton distribution.
*/
import { mulberry32 } from '../sim/rng'
import { xorInto, toBlocks, fromBlocks } from './bytes'

export interface EncodedSymbol {
  seed: number
  data: Uint8Array
}

export interface Encoder {
  k: number // number of source blocks
  symbolSize: number
  dataLength: number
  /** Deterministically produce the symbol for a given seed. */
  symbol: (seed: number) => EncodedSymbol
}

/** Robust Soliton cumulative distribution over degrees 1..K. */
function robustSolitonCdf(k: number, c = 0.08, delta = 0.5): number[] {
  const rho = new Array(k + 1).fill(0)
  rho[1] = 1 / k
  for (let d = 2; d <= k; d++) rho[d] = 1 / (d * (d - 1))

  const R = c * Math.log(k / delta) * Math.sqrt(k)
  const tau = new Array(k + 1).fill(0)
  const kr = Math.floor(k / R)
  for (let d = 1; d <= k; d++) {
    if (d < kr) tau[d] = R / (d * k)
    else if (d === kr) tau[d] = (R * Math.log(R / delta)) / k
    else tau[d] = 0
  }

  const mu = new Array(k + 1).fill(0)
  let z = 0
  for (let d = 1; d <= k; d++) z += rho[d] + tau[d]
  for (let d = 1; d <= k; d++) mu[d] = (rho[d] + tau[d]) / z

  const cdf = new Array(k + 1).fill(0)
  let acc = 0
  for (let d = 1; d <= k; d++) {
    acc += mu[d]
    cdf[d] = acc
  }
  cdf[k] = 1 // guard against float drift
  return cdf
}

function sampleDegree(u: number, cdf: number[]): number {
  for (let d = 1; d < cdf.length; d++) if (u <= cdf[d]) return d
  return cdf.length - 1
}

/** Derive the set of source-block indices a symbol covers, from its seed. */
function neighbours(seed: number, k: number, cdf: number[]): number[] {
  const rng = mulberry32(seed >>> 0)
  const degree = Math.min(k, sampleDegree(rng(), cdf))
  const set = new Set<number>()
  // guard the loop: with degree<=k this always terminates
  let guard = 0
  while (set.size < degree && guard++ < degree * 20) {
    set.add(Math.floor(rng() * k))
  }
  return [...set]
}

export function makeEncoder(data: Uint8Array, symbolSize: number): Encoder {
  const blocks = toBlocks(data, symbolSize)
  const k = blocks.length
  const cdf = robustSolitonCdf(k)
  return {
    k,
    symbolSize,
    dataLength: data.length,
    symbol(seed: number): EncodedSymbol {
      const idxs = neighbours(seed, k, cdf)
      const out = new Uint8Array(symbolSize)
      for (const i of idxs) xorInto(out, blocks[i])
      return { seed, data: out }
    },
  }
}

export interface DecodeResult {
  recovered: Uint8Array | null
  solvedBlocks: number
  k: number
}

/**
 * Peeling decoder. Returns the reconstructed bytes once every source block is
 * solved, else null (honest "not enough yet"). `symbols` may arrive in any
 * order and be any subset — that is the whole point.
 */
export function decode(
  symbols: EncodedSymbol[],
  k: number,
  _symbolSize: number,
  dataLength: number,
): DecodeResult {
  const cdf = robustSolitonCdf(k)
  const solved: Array<Uint8Array | null> = new Array(k).fill(null)
  let solvedCount = 0

  // working copies of each symbol's value + its still-unknown neighbour set
  const work = symbols.map((s) => ({
    value: s.data.slice(),
    unknown: new Set(neighbours(s.seed, k, cdf)),
  }))

  // peel: repeatedly resolve degree-1 symbols
  let progress = true
  while (progress && solvedCount < k) {
    progress = false
    for (const w of work) {
      if (w.unknown.size !== 1) continue
      const idx = w.unknown.values().next().value as number
      if (solved[idx]) {
        w.unknown.clear()
        continue
      }
      // this symbol now equals source block `idx`
      solved[idx] = w.value.slice()
      solvedCount++
      progress = true
      w.unknown.clear()
      // substitute the newly solved block out of every other symbol that uses it
      for (const other of work) {
        if (other.unknown.has(idx)) {
          xorInto(other.value, solved[idx]!)
          other.unknown.delete(idx)
        }
      }
    }
  }

  if (solvedCount < k) return { recovered: null, solvedBlocks: solvedCount, k }
  return {
    recovered: fromBlocks(solved as Uint8Array[], dataLength),
    solvedBlocks: solvedCount,
    k,
  }
}
