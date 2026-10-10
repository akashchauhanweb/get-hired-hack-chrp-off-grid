/*
  Simulation engine — ties the real byte pipeline to the simulated radio.

  For each media item: AES-GCM encrypt → (fountain | ARQ) fragment the CIPHERTEXT
  into ~200 B packets → flood each packet across the mesh with per-link loss and
  hop limit 3 → collect what reaches the destination → reconstruct → decrypt →
  SHA-256 verify. Deterministic given a run seed, so a run is reproducible and the
  honest status is recomputed live whenever the presenter moves a loss fader.

  DOM-free: it operates on bytes. The browser layer feeds it payloads and renders
  the reconstructed result.
*/
import { mulberry32, hashSeed } from '../sim/rng'
import { buildTopology, SOURCE, DEST, HOP_LIMIT, type MeshLink, type NodeId } from '../sim/topology'
import { floodPacket, type TxEvent } from '../sim/flood'
import { PRESETS, airtimeSeconds, type PresetId } from '../sim/presets'
import { makeEncoder, decode, type EncodedSymbol } from '../codec/fountain'
import { toBlocks, fromBlocks } from '../codec/bytes'
import { PACKET_BYTES, SYMBOL_BYTES } from '../packet/fragment'
import { encrypt, decrypt, type Keys } from '../crypto/encrypt'
import { sha256Hex } from '../media/hash'

export type RecoveryMode = 'fountain' | 'arq'
export type MediaType = 'image' | 'voice' | 'text'

export interface MediaInput {
  id: MediaType
  label: string
  payload: Uint8Array
  originalHash: string
}

export interface RunConfig {
  mode: RecoveryMode
  preset: PresetId
  links: MeshLink[]
  dead: Set<NodeId>
  seed: number
  /** transmission direction across the mesh; defaults to A → E */
  from?: NodeId
  to?: NodeId
}

/** One emitted packet and what happened to it on air. */
export interface Round {
  index: number
  seed: number // fountain seed, or block index for ARQ
  blockIndex: number | null // ARQ only
  attempt: number // ARQ retransmit attempt (0 = first try)
  delivered: boolean
  hops: number
  airLinks: number
  events: TxEvent[]
}

export interface MediaResult {
  input: MediaInput
  mode: RecoveryMode
  k: number
  solvedBlocks: number
  delivered: boolean // true only on hash-verified reconstruction
  hashMatch: boolean
  reconstructed: Uint8Array | null // decrypted plaintext
  rounds: Round[]
  // metrics
  payloadBytes: number
  cipherBytes: number
  fragmentsEmitted: number
  fragmentsDelivered: number
  fragmentsLost: number
  retransmits: number
  bytesOnAir: number
  airtimeSec: number
  usefulBytesDelivered: number
}

const MAX_FOUNTAIN_OVERHEAD = 8 // cap symbols at K*8 → honest FAILED beyond this
const MAX_ARQ_RETX = 8 // naive baseline gives up after this many retries per fragment

function rngFor(seed: number, id: string, phase: string) {
  return mulberry32(hashSeed(`${seed}:${id}:${phase}`))
}

export async function runMedia(input: MediaInput, keys: Keys, cfg: RunConfig): Promise<MediaResult> {
  const topo = buildTopology(cfg.links, cfg.dead)
  const preset = PRESETS[cfg.preset]
  const airtimePerPacket = airtimeSeconds(preset, PACKET_BYTES)
  const from = cfg.from ?? SOURCE
  const to = cfg.to ?? DEST

  const sealed = await encrypt(keys, input.payload)
  const cipher = sealed.ciphertext

  const rounds: Round[] = []
  let airLinksTotal = 0
  let fragmentsDelivered = 0

  let k = 0
  let solvedBlocks = 0
  let recoveredCipher: Uint8Array | null = null
  let retransmits = 0

  if (cfg.mode === 'fountain') {
    const enc = makeEncoder(cipher, SYMBOL_BYTES)
    k = enc.k
    const received: EncodedSymbol[] = []
    const budget = Math.max(k * MAX_FOUNTAIN_OVERHEAD, k + 4)
    for (let r = 0; r < budget; r++) {
      const seed = 0x9000 + r
      // rateless: no per-fragment feedback. Source just keeps emitting symbols.
      const flood = floodPacket(topo, from, to, HOP_LIMIT, rngFor(cfg.seed, input.id, `f:${r}`))
      airLinksTotal += flood.airLinks
      if (flood.delivered) {
        received.push(enc.symbol(seed))
        fragmentsDelivered++
      }
      rounds.push({
        index: r,
        seed,
        blockIndex: null,
        attempt: 0,
        delivered: flood.delivered,
        hops: flood.hops,
        airLinks: flood.airLinks,
        events: flood.events,
      })
      // try to decode once we have at least K symbols
      if (received.length >= k) {
        const res = decode(received, k, SYMBOL_BYTES, cipher.length)
        solvedBlocks = res.solvedBlocks
        if (res.recovered) {
          recoveredCipher = res.recovered
          break
        }
      }
    }
    // fountain never does targeted retransmits
    retransmits = 0
  } else {
    // Naive stop-and-wait ARQ baseline. Systematic blocks; each fragment must be
    // ACKed by the destination, and the ACK itself traverses the lossy mesh. When
    // the ACK is dropped the source retransmits a fragment the receiver ALREADY
    // has — the classic retransmit storm. This feedback cost is precisely what a
    // rateless fountain avoids, so the comparison is honest, not rigged.
    const blocks = toBlocks(cipher, SYMBOL_BYTES)
    k = blocks.length
    const got: Array<Uint8Array | null> = new Array(k).fill(null)
    let roundIdx = 0
    for (let i = 0; i < k; i++) {
      let acknowledged = false
      for (let attempt = 0; attempt <= MAX_ARQ_RETX && !acknowledged; attempt++) {
        const fwd = floodPacket(topo, from, to, HOP_LIMIT, rngFor(cfg.seed, input.id, `fwd:${i}:${attempt}`))
        airLinksTotal += fwd.airLinks
        if (attempt > 0) retransmits++
        if (fwd.delivered) {
          fragmentsDelivered++
          if (!got[i]) got[i] = blocks[i] // data is at the destination now
          // destination ACKs back across the same lossy air
          const ack = floodPacket(topo, to, from, HOP_LIMIT, rngFor(cfg.seed, input.id, `ack:${i}:${attempt}`))
          airLinksTotal += ack.airLinks
          if (ack.delivered) acknowledged = true
        }
        rounds.push({
          index: roundIdx++,
          seed: i,
          blockIndex: i,
          attempt,
          delivered: fwd.delivered,
          hops: fwd.hops,
          airLinks: fwd.airLinks,
          events: fwd.events,
        })
      }
    }
    solvedBlocks = got.filter(Boolean).length
    if (solvedBlocks === k) recoveredCipher = fromBlocks(got as Uint8Array[], cipher.length)
  }

  // decrypt + hash verify — DELIVERED only flips true here
  let reconstructed: Uint8Array | null = null
  let hashMatch = false
  if (recoveredCipher) {
    reconstructed = await decrypt(keys, { iv: sealed.iv, ciphertext: recoveredCipher })
    if (reconstructed) hashMatch = (await sha256Hex(reconstructed)) === input.originalHash
  }

  const fragmentsEmitted = rounds.length
  const fragmentsLost = fragmentsEmitted - fragmentsDelivered
  const bytesOnAir = airLinksTotal * PACKET_BYTES
  const airtimeSec = fragmentsEmitted * airtimePerPacket
  const usefulBytesDelivered = hashMatch
    ? input.payload.length
    : Math.round((solvedBlocks / Math.max(1, k)) * input.payload.length)

  return {
    input,
    mode: cfg.mode,
    k,
    solvedBlocks,
    delivered: hashMatch,
    hashMatch,
    reconstructed,
    rounds,
    payloadBytes: input.payload.length,
    cipherBytes: cipher.length,
    fragmentsEmitted,
    fragmentsDelivered,
    fragmentsLost,
    retransmits,
    bytesOnAir,
    airtimeSec,
    usefulBytesDelivered,
  }
}

export interface RunResult {
  mode: RecoveryMode
  media: MediaResult[]
  // headline metrics (the three judging axes), aggregated
  goodputPerByte: number
  usefulBytesDelivered: number
  bytesOnAir: number
  fragmentsEmitted: number
  fragmentsDelivered: number
  fragmentsLost: number
  retransmits: number
  airtimeSec: number
  allDelivered: boolean
  blocksSolved: number
  blocksTotal: number
}

export async function runSimulation(
  inputs: MediaInput[],
  keys: Keys,
  cfg: RunConfig,
): Promise<RunResult> {
  const media: MediaResult[] = []
  for (const input of inputs) media.push(await runMedia(input, keys, cfg))

  const sum = (f: (m: MediaResult) => number) => media.reduce((a, m) => a + f(m), 0)
  const usefulBytesDelivered = sum((m) => m.usefulBytesDelivered)
  const bytesOnAir = sum((m) => m.bytesOnAir)

  return {
    mode: cfg.mode,
    media,
    goodputPerByte: bytesOnAir > 0 ? usefulBytesDelivered / bytesOnAir : 0,
    usefulBytesDelivered,
    bytesOnAir,
    fragmentsEmitted: sum((m) => m.fragmentsEmitted),
    fragmentsDelivered: sum((m) => m.fragmentsDelivered),
    fragmentsLost: sum((m) => m.fragmentsLost),
    retransmits: sum((m) => m.retransmits),
    airtimeSec: sum((m) => m.airtimeSec),
    allDelivered: media.every((m) => m.delivered),
    blocksSolved: sum((m) => m.solvedBlocks),
    blocksTotal: sum((m) => m.k),
  }
}
