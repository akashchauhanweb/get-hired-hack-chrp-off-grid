import { describe, it, expect } from 'vitest'
import { runSimulation, type MediaInput, type RunConfig } from '../simulation'
import { deriveKeys } from '../../crypto/encrypt'
import { sha256Hex } from '../../media/hash'
import { DEFAULT_LINKS, type MeshLink, type NodeId } from '../../sim/topology'
import { mulberry32 } from '../../sim/rng'

function rnd(len: number, seed: number): Uint8Array {
  const r = mulberry32(seed)
  const d = new Uint8Array(len)
  for (let i = 0; i < len; i++) d[i] = Math.floor(r() * 256)
  return d
}

async function inputs(): Promise<MediaInput[]> {
  const img = rnd(2000, 1)
  const vox = rnd(1200, 2)
  return [
    { id: 'image', label: 'screenshot.png', payload: img, originalHash: await sha256Hex(img) },
    { id: 'voice', label: 'voice-note', payload: vox, originalHash: await sha256Hex(vox) },
  ]
}

const allLinks = (loss: number): MeshLink[] =>
  DEFAULT_LINKS.map((l) => ({ ...l, loss }))

const cfg = (over: Partial<RunConfig>): RunConfig => ({
  mode: 'fountain',
  preset: 'LONG_FAST',
  links: DEFAULT_LINKS,
  dead: new Set<NodeId>(),
  seed: 2026,
  ...over,
})

describe('simulation engine', () => {
  it('delivers both media (hash-verified) at low loss, with zero retransmits in fountain mode', async () => {
    const keys = await deriveKeys('psk')
    const res = await runSimulation(await inputs(), keys, cfg({ mode: 'fountain', links: allLinks(0.08) }))
    expect(res.allDelivered).toBe(true)
    expect(res.retransmits).toBe(0)
    expect(res.blocksSolved).toBe(res.blocksTotal)
  })

  it('fountain beats naive ARQ on goodput-per-byte on average under identical loss', async () => {
    const keys = await deriveKeys('psk')
    const links = allLinks(0.4)
    let fSum = 0
    let aSum = 0
    const seeds = [1, 2, 3, 4, 5, 2026]
    for (const seed of seeds) {
      const fountain = await runSimulation(await inputs(), keys, cfg({ mode: 'fountain', links, seed }))
      const arq = await runSimulation(await inputs(), keys, cfg({ mode: 'arq', links, seed }))
      expect(fountain.retransmits).toBe(0) // fountain NEVER does targeted retransmits
      fSum += fountain.goodputPerByte
      aSum += arq.goodputPerByte
    }
    // rateless FEC wins on average because ARQ pays lossy ACK round-trips
    expect(fSum / seeds.length).toBeGreaterThan(aSum / seeds.length)
  })

  it('fails HONESTLY at 95% link loss — no false DELIVERED', async () => {
    const keys = await deriveKeys('psk')
    const res = await runSimulation(await inputs(), keys, cfg({ mode: 'fountain', links: allLinks(0.95) }))
    expect(res.allDelivered).toBe(false)
    expect(res.blocksSolved).toBeLessThan(res.blocksTotal)
    // every media item reports a truthful shortfall
    for (const m of res.media) expect(m.delivered).toBe(false)
  })
})
