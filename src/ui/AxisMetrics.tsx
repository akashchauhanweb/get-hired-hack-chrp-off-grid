/* The three judging axes, made explicit and live, plus the airtime budget. */
import type { useSimulation } from '../state/useSimulation'

type Sim = ReturnType<typeof useSimulation>

export function AxisMetrics({ sim }: { sim: Sim }) {
  const recoveredPct =
    sim.blocksTotal > 0 ? Math.round((sim.blocksSolved / sim.blocksTotal) * 100) : 0
  const status = sim.allComplete ? (sim.allDelivered ? 'DELIVERED' : 'FAILED') : sim.phase === 'running' ? 'RECEIVING' : 'IDLE'
  const statusTone = status === 'DELIVERED' ? 'ink' : status === 'FAILED' ? 'accent' : 'muted'

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Axis
        n="01"
        title="Media through / byte"
        value={sim.goodput > 0 ? sim.goodput.toFixed(2) : '—'}
        unit="useful ÷ on-air"
        sub={`${sim.usefulBytes.toLocaleString()} B useful · ${sim.bytesOnAir.toLocaleString()} B on air`}
      />
      <Axis
        n="02"
        title="Recovers from loss"
        value={`${recoveredPct}%`}
        unit="blocks recovered"
        sub={`${sim.fragLost} lost · ${sim.retransmits} retransmits${sim.mode === 'fountain' ? ' (rateless)' : ''}`}
      />
      <Axis
        n="03"
        title="Honest status"
        value={status}
        unit={sim.mode === 'fountain' ? 'fountain FEC' : 'naive ARQ'}
        sub={status === 'DELIVERED' ? 'SHA-256 verified · == original' : status === 'FAILED' ? 'truthful shortfall shown' : 'only flips on real decode'}
        tone={statusTone as 'ink' | 'accent' | 'muted'}
        isText
      />
      <Axis
        n="04"
        title="Airtime budget"
        value={sim.airtimeSec >= 1 ? `${sim.airtimeSec.toFixed(1)}s` : `${(sim.airtimeSec * 1000).toFixed(0)}ms`}
        unit={`@ ${sim.preset.replace('_', ' ').toLowerCase()}`}
        sub={`${sim.fragEmitted} packets · ~1.5s/frag @ Long Fast`}
      />
    </div>
  )
}

function Axis({
  n,
  title,
  value,
  unit,
  sub,
  tone = 'ink',
  isText = false,
}: {
  n: string
  title: string
  value: string
  unit: string
  sub: string
  tone?: 'ink' | 'accent' | 'muted'
  isText?: boolean
}) {
  const color = tone === 'accent' ? 'var(--color-accent)' : tone === 'muted' ? 'var(--color-ink-3)' : 'var(--color-ink)'
  return (
    <section className="panel p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="label">{title}</span>
        <span className="mono text-[10px] text-ink-3">AX·{n}</span>
      </div>
      <div
        className={`mt-2 font-sans ${isText ? 'text-[clamp(20px,2.2vw,28px)]' : 'text-[clamp(28px,3vw,40px)]'} font-700 tabular-nums tracking-tight`}
        style={{ color }}
      >
        {value}
      </div>
      <div className="label mt-1 !text-[9px]">{unit}</div>
      <div className="mono mt-2 text-[10px] text-ink-3">{sub}</div>
    </section>
  )
}
