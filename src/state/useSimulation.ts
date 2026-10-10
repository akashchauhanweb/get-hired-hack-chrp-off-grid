/*
  useSimulation — bidirectional channel controller.

  Both endpoints A and E can send text / image / voice; every message crosses the
  SAME simulated mesh (A→E or E→A) through the real pipeline. Only ONE transfer is
  on the air at a time — a global channel lock refuses a send from either end
  while anything is in flight. A conversation log records every message; both ends
  render it (mirrored: what they sent vs. what they received).

  All on-screen numbers derive from what has actually been revealed, so the status
  is honest at every frame.
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  runSimulation,
  type MediaInput,
  type MediaType,
  type RunResult,
  type MediaResult,
  type RecoveryMode,
} from '../engine/simulation'
import { deriveKeys, type Keys } from '../crypto/encrypt'
import { DEFAULT_LINKS, linkKey, type MeshLink, type NodeId } from '../sim/topology'
import { DEFAULT_PRESET, PRESETS, airtimeSeconds, type PresetId } from '../sim/presets'
import { PACKET_BYTES } from '../packet/fragment'
import { sha256Hex } from '../media/hash'
import type { TxEvent } from '../sim/flood'
import { heroImage } from '../media/image'
import { sampleVoice } from '../media/voice'

export type RunPhase = 'idle' | 'running' | 'done'
export type EndpointId = 'A' | 'E'

export interface ChatMessage {
  id: string
  from: EndpointId
  to: EndpointId
  type: MediaType
  label: string
  text?: string
  payload: Uint8Array
  originalRgba?: Uint8Array // image: sender-side original for preview
  waveform?: number[] // voice: sender-side waveform
  result: MediaResult | null // set when the transfer completes
}

export interface MessageView extends ChatMessage {
  k: number
  fragmentsEmitted: number
  fragmentsDelivered: number
  blocksGot: number
  complete: boolean
  delivered: boolean
  sending: boolean
  reconstructed: Uint8Array | null
}

export interface SendDraft {
  from: EndpointId
  type: MediaType
  label: string
  text?: string
  payload: Uint8Array
  originalRgba?: Uint8Array
  waveform?: number[]
}

export interface LinkStat {
  key: string
  attempts: number
  lost: number
  lossRate: number
  rssi: number
  snr: number
}

export interface LedgerRow {
  seq: string
  frag: string
  path: string
  state: 'DELIVERED' | 'LOST' | 'RECOVERED'
  tHop: number
}

const PSK = 'farcast-demo-channel-0x2b'

export function useSimulation() {
  // ---- config
  const [mode, setMode] = useState<RecoveryMode>('fountain')
  const [preset, setPreset] = useState<PresetId>(DEFAULT_PRESET)
  const [links, setLinks] = useState<MeshLink[]>(() => {
    const base = DEFAULT_LINKS.map((l) => ({ ...l }))
    const p = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('loss') : null
    if (p !== null) {
      const v = Math.min(95, Math.max(0, Number(p))) / 100
      return base.map((l) => ({ ...l, loss: v }))
    }
    return base
  })
  const [dead, setDead] = useState<Set<NodeId>>(new Set())
  const [speed, setSpeed] = useState(10)

  // ---- channel / conversation
  const keysRef = useRef<Keys | null>(null)
  const [phase, setPhase] = useState<RunPhase>('idle')
  const [result, setResult] = useState<RunResult | null>(null)
  const [rev, setRev] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busyMessage, setBusyMessage] = useState<string | null>(null)

  // ---- benchmark
  const [comparison, setComparison] = useState<{ fountain: RunResult; arq: RunResult } | null>(null)
  const [comparing, setComparing] = useState(false)

  useEffect(() => {
    ;(async () => {
      keysRef.current = await deriveKeys(PSK)
      setKeysReady(true)
    })()
  }, [])
  const [keysReady, setKeysReady] = useState(false)

  const setLinkLoss = useCallback((key: string, loss: number) => {
    setLinks((prev) => prev.map((l) => (linkKey(l.a, l.b) === key ? { ...l, loss } : l)))
  }, [])

  const toggleDead = useCallback((node: NodeId) => {
    setDead((prev) => {
      const next = new Set(prev)
      next.has(node) ? next.delete(node) : next.add(node)
      return next
    })
  }, [])

  // ---- send ONE message; refuses while the channel is busy
  const send = useCallback(
    async (draft: SendDraft) => {
      if (phase === 'running') {
        setBusyMessage('Channel busy — one transfer at a time. Wait until it completes.')
        window.setTimeout(() => setBusyMessage(null), 3200)
        return
      }
      if (!keysRef.current || draft.payload.length === 0) return
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const to: EndpointId = draft.from === 'A' ? 'E' : 'A'
      const msg: ChatMessage = { ...draft, id, to, result: null }
      setMessages((prev) => [...prev, msg])
      setBusyMessage(null)
      setActiveId(id)
      setPhase('running')
      setRev(0)
      setResult(null)
      setComparison(null)
      const input: MediaInput = {
        id: draft.type,
        label: draft.label,
        payload: draft.payload,
        originalHash: await sha256Hex(draft.payload),
      }
      const r = await runSimulation([input], keysRef.current, {
        mode,
        preset,
        links,
        dead,
        seed: 2026,
        from: draft.from,
        to,
      })
      setResult(r)
    },
    [phase, mode, preset, links, dead],
  )

  const reset = useCallback(() => {
    setPhase('idle')
    setResult(null)
    setRev(0)
    setMessages([])
    setActiveId(null)
    setComparison(null)
    setBusyMessage(null)
  }, [])

  // store the completed transfer back onto its message
  useEffect(() => {
    if (phase === 'done' && result && activeId) {
      setMessages((prev) => prev.map((m) => (m.id === activeId ? { ...m, result: result.media[0] } : m)))
    }
  }, [phase, result, activeId])

  // ---- benchmark: both strategies, identical config, on a representative payload
  const runBenchmark = useCallback(async () => {
    if (!keysRef.current) return
    setComparing(true)
    const [img, vox] = await Promise.all([heroImage(), sampleVoice(2)])
    const ins: MediaInput[] = [img.input, vox.input]
    const base = { preset, links, dead, seed: 2026, from: 'A' as NodeId, to: 'E' as NodeId }
    const fountain = await runSimulation(ins, keysRef.current, { ...base, mode: 'fountain' })
    const arq = await runSimulation(ins, keysRef.current, { ...base, mode: 'arq' })
    setComparison({ fountain, arq })
    setComparing(false)
  }, [preset, links, dead])

  // ---- animation
  const totalRounds = useMemo(() => (result ? result.media.reduce((a, m) => a + m.rounds.length, 0) : 0), [result])
  const rafRef = useRef(0)
  useEffect(() => {
    if (!result || totalRounds === 0) return
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('instant') === '1') {
      setRev(totalRounds)
      setPhase('done')
      return
    }
    const perRoundMs = Math.max(8, (airtimeSeconds(PRESETS[preset], PACKET_BYTES) * 1000) / speed)
    const startT = performance.now()
    const tick = (now: number) => {
      const revealed = Math.min(totalRounds, Math.floor((now - startT) / perRoundMs))
      setRev(revealed)
      if (revealed >= totalRounds) {
        setPhase('done')
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [result, totalRounds, preset, speed])

  // ---- per-message views (live for the active one, final for the rest)
  const activeMedia = result?.media[0] ?? null
  const messageViews = useMemo<MessageView[]>(() => {
    return messages.map((msg) => {
      const isActive = msg.id === activeId && !!activeMedia
      const m = isActive ? activeMedia! : msg.result
      if (!m) {
        return { ...msg, k: 0, fragmentsEmitted: 0, fragmentsDelivered: 0, blocksGot: 0, complete: false, delivered: false, sending: false, reconstructed: null }
      }
      const revealed = isActive ? Math.min(m.rounds.length, rev) : m.rounds.length
      const slice = m.rounds.slice(0, revealed)
      const complete = revealed >= m.rounds.length
      const delivered = complete && m.delivered
      const fragmentsDelivered = slice.filter((r) => r.delivered).length
      return {
        ...msg,
        k: m.k,
        fragmentsEmitted: slice.length,
        fragmentsDelivered,
        blocksGot: complete ? m.solvedBlocks : Math.min(fragmentsDelivered, m.k),
        complete,
        delivered,
        sending: isActive && !complete,
        reconstructed: delivered ? m.reconstructed : null,
      }
    })
  }, [messages, activeId, activeMedia, rev])

  // ---- metrics / monitoring / ledger from the active (current) transfer
  const derived = useMemo(() => {
    let usefulBytes = 0
    let bytesOnAir = 0
    let fragEmitted = 0
    let fragDelivered = 0
    let fragLost = 0
    let retransmits = 0
    let airtimeSec = 0
    let blocksSolved = 0
    let blocksTotal = 0
    const linkAgg = new Map<string, { attempts: number; lost: number }>()
    const ledger: LedgerRow[] = []
    let currentEvents: TxEvent[] = []
    const airPerPacket = airtimeSeconds(PRESETS[preset], PACKET_BYTES)

    const m = result?.media[0]
    if (m) {
      const revealed = Math.min(m.rounds.length, rev)
      const slice = m.rounds.slice(0, revealed)
      const complete = revealed >= m.rounds.length
      for (const r of slice) {
        bytesOnAir += r.airLinks * PACKET_BYTES
        if (r.delivered) fragDelivered++
        else fragLost++
        if (r.attempt > 0) retransmits++
        for (const e of r.events) {
          const k = linkKey(e.from, e.to)
          const agg = linkAgg.get(k) ?? { attempts: 0, lost: 0 }
          agg.attempts++
          if (!e.delivered) agg.lost++
          linkAgg.set(k, agg)
        }
      }
      fragEmitted = slice.length
      airtimeSec = slice.length * airPerPacket
      blocksTotal = m.k
      blocksSolved = complete ? m.solvedBlocks : Math.min(fragDelivered, m.k)
      usefulBytes = complete && m.delivered ? m.payloadBytes : complete ? Math.round((m.solvedBlocks / Math.max(1, m.k)) * m.payloadBytes) : 0

      const cur = slice[slice.length - 1]
      if (cur) currentEvents = cur.events
      const recent = slice.slice(Math.max(0, revealed - 7))
      for (const r of recent) {
        ledger.push({
          seq: '0x' + (0x40 + (r.index % 160)).toString(16).toUpperCase(),
          frag: r.blockIndex !== null ? `blk ${r.blockIndex}` : `sym ${r.seed - 0x9000}`,
          path: pathLabel(r.events),
          state: r.delivered ? (r.attempt > 0 ? 'RECOVERED' : 'DELIVERED') : 'LOST',
          tHop: r.hops,
        })
      }
    }

    const linkStats: LinkStat[] = links.map((l) => {
      const k = linkKey(l.a, l.b)
      const agg = linkAgg.get(k) ?? { attempts: 0, lost: 0 }
      const lossRate = agg.attempts ? agg.lost / agg.attempts : l.loss
      return { key: k, attempts: agg.attempts, lost: agg.lost, lossRate, rssi: Math.round(-55 - l.loss * 70), snr: Math.round((1 - l.loss) * 12 - 4) }
    })

    const goodput = bytesOnAir > 0 ? usefulBytes / bytesOnAir : 0
    const allComplete = !!result && rev >= totalRounds
    const allDelivered = allComplete && !!result && result.media.every((x) => x.delivered)

    return {
      usefulBytes,
      bytesOnAir,
      goodput,
      fragEmitted,
      fragDelivered,
      fragLost,
      retransmits,
      airtimeSec,
      blocksSolved,
      blocksTotal,
      linkStats,
      ledger: ledger.slice(-8).reverse(),
      currentEvents,
      allComplete,
      allDelivered,
    }
  }, [result, rev, links, preset, totalRounds])

  const avgLoss = useMemo(() => Math.round((links.reduce((a, l) => a + l.loss, 0) / links.length) * 100), [links])

  return {
    mode,
    setMode,
    preset,
    setPreset,
    links,
    setLinkLoss,
    dead,
    toggleDead,
    speed,
    setSpeed,
    avgLoss,
    keysReady,
    // channel
    phase,
    busyMessage,
    messages,
    messageViews,
    activeId,
    send,
    reset,
    progress: totalRounds ? rev / totalRounds : 0,
    // benchmark
    comparison,
    comparing,
    runBenchmark,
    // derived metrics
    ...derived,
  }
}

function pathLabel(events: TxEvent[]): string {
  const delivered = events.filter((e) => e.delivered)
  if (delivered.length === 0) return '—'
  const chain = [delivered[0].from, ...delivered.map((e) => e.to)]
  const seen = new Set<string>()
  return chain.filter((n) => (seen.has(n) ? false : (seen.add(n), true))).join('→')
}
