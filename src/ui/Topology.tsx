/* Live plan view of the mesh, driven by the engine's current-round flood. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { NODES, linkKey, type MeshLink, type NodeId } from '../sim/topology'
import type { TxEvent } from '../sim/flood'

const byId = (id: NodeId) => NODES.find((n) => n.id === id)!

export function Topology({
  links,
  dead,
  currentEvents,
  phase,
  onToggleDead,
}: {
  links: MeshLink[]
  dead: Set<NodeId>
  currentEvents: TxEvent[]
  phase: 'idle' | 'running' | 'done'
  onToggleDead: (n: NodeId) => void
}) {
  // classify this round's link activity
  const activity = useMemo(() => {
    const m = new Map<string, 'delivered' | 'lost'>()
    for (const e of currentEvents) {
      const k = linkKey(e.from, e.to)
      if (e.delivered) m.set(k, 'delivered')
      else if (!m.has(k)) m.set(k, 'lost')
    }
    return m
  }, [currentEvents])

  // delivered chain → path for the travelling packet
  const chain = useMemo(() => {
    const d = currentEvents.filter((e) => e.delivered)
    if (!d.length) return [] as NodeId[]
    const path: NodeId[] = [d[0].from]
    for (const e of d) if (path[path.length - 1] !== e.to) path.push(e.to)
    return path
  }, [currentEvents])

  const [t, setT] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (phase !== 'running' || chain.length < 2) {
      setT(0)
      return
    }
    const start = performance.now()
    const loop = (now: number) => {
      setT(((now - start) / 700) % 1)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [phase, chain])

  const packet = useMemo(() => {
    if (chain.length < 2) return null
    const steps = chain.length - 1
    const prog = Math.min(0.999, Math.max(0, t)) * steps
    const seg = Math.min(steps - 1, Math.floor(prog))
    const lt = prog - seg
    const a = byId(chain[seg])
    const b = byId(chain[seg + 1])
    return { x: a.x + (b.x - a.x) * lt, y: a.y + (b.y - a.y) * lt }
  }, [chain, t])

  return (
    <section className="panel flex h-full flex-col p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="label">Topology · partial mesh</span>
        <span className="label !text-ink-3">
          5 NODES · {links.length} LINKS · HOP LIMIT 3
        </span>
      </div>

      <div className="mt-3 flex-1 bg-paper-2" style={{ border: '1px solid var(--color-line-soft)' }}>
        <svg viewBox="0 0 720 400" className="block h-full w-full">
          {links.map((l) => {
            const a = byId(l.a)
            const b = byId(l.b)
            const k = linkKey(l.a, l.b)
            const isDead = dead.has(l.a) || dead.has(l.b)
            const act = activity.get(k)
            let stroke = l.loss > 0.3 ? 'var(--color-line-soft)' : 'var(--color-ink)'
            let width = 1.5
            let dash: string | undefined
            if (act === 'delivered') {
              stroke = 'var(--color-ink)'
              width = 2.75
            } else if (act === 'lost') {
              stroke = 'var(--color-accent)'
              dash = '6 6'
            }
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2
            return (
              <g key={k} opacity={isDead ? 0.18 : 1}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={width} strokeDasharray={dash} />
                {act === 'lost' ? (
                  <text x={mx} y={my - 7} textAnchor="middle" fontSize="11" fontFamily="var(--font-sans)" fontWeight="700" letterSpacing="0.1em" fill="var(--color-accent)">
                    LOST
                  </text>
                ) : (
                  <text
                    x={mx}
                    y={my - 7}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill={l.loss > 0.3 ? 'var(--color-accent)' : 'var(--color-ink-3)'}
                  >
                    {Math.round(l.loss * 100)}%
                  </text>
                )}
              </g>
            )
          })}

          {packet && <rect x={packet.x - 5} y={packet.y - 5} width="10" height="10" fill="var(--color-ink)" />}

          {NODES.map((n) => {
            const isDead = dead.has(n.id)
            const filled = (n.role === 'source' || n.role === 'dest') && !isDead
            return (
              <g key={n.id} opacity={isDead ? 0.3 : 1} onClick={() => n.role === 'relay' && onToggleDead(n.id)} style={{ cursor: n.role === 'relay' ? 'pointer' : 'default' }}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r="26"
                  fill={filled ? 'var(--color-ink)' : 'var(--color-paper)'}
                  stroke="var(--color-ink)"
                  strokeWidth="2"
                  strokeDasharray={isDead ? '4 4' : undefined}
                />
                <text x={n.x} y={n.y + 6} textAnchor="middle" fontSize="18" fontFamily="var(--font-display)" fontWeight="600" fill={filled ? 'var(--color-paper)' : 'var(--color-ink)'}>
                  {n.id}
                </text>
                {n.role !== 'relay' && (
                  <text x={n.x} y={n.y + 46} textAnchor="middle" fontSize="10" fontFamily="var(--font-sans)" fontWeight="600" letterSpacing="0.12em" fill="var(--color-ink-2)">
                    ENDPOINT
                  </text>
                )}
                {isDead && (
                  <text x={n.x} y={n.y + 46} textAnchor="middle" fontSize="9" fontFamily="var(--font-sans)" fontWeight="700" letterSpacing="0.1em" fill="var(--color-accent)">
                    DOWN
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-5">
        <Legend kind="active" text="ACTIVE ROUTE" />
        <Legend kind="loss" text="PACKET LOSS" />
        <Legend kind="idle" text="RELAY (click to kill)" />
      </div>
    </section>
  )
}

function Legend({ kind, text }: { kind: 'active' | 'loss' | 'idle'; text: string }) {
  return (
    <span className="flex items-center gap-2">
      {kind === 'active' && <span className="h-0.5 w-6 bg-ink" />}
      {kind === 'loss' && <span className="h-0 w-6 border-t-2 border-dashed" style={{ borderColor: 'var(--color-accent)' }} />}
      {kind === 'idle' && <span className="h-3 w-3 rounded-full border border-ink" />}
      <span className="label !text-ink-2">{text}</span>
    </span>
  )
}
