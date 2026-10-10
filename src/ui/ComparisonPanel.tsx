/*
  Head-to-head benchmark: our fountain code vs the naive-ARQ baseline, run under
  the SAME loss config and seed. Also self-documents how each strategy works, so
  the comparison is legible and honest (ARQ's assumptions are stated, not hidden).
*/
import { Button } from './primitives'
import type { RunResult } from '../engine/simulation'

const MECHANISM = {
  fountain: {
    name: 'Fountain (LT FEC)',
    tag: 'our hero',
    how: 'Rateless erasure code. The source emits endless coded symbols (each an XOR of random source blocks); the receiver rebuilds the file from ANY sufficient subset. No ACKs, no targeted retransmits — loss just means "send a few more symbols."',
  },
  arq: {
    name: 'Naive ARQ',
    tag: 'baseline',
    how: 'Stop-and-wait retransmit. Each fragment must be ACKed by the receiver, and the ACK crosses the same lossy mesh. A dropped ACK makes the source resend a fragment the receiver already has — the classic retransmit storm.',
  },
}

export function ComparisonPanel({
  comparison,
  comparing,
  onRun,
}: {
  comparison: { fountain: RunResult; arq: RunResult } | null
  comparing: boolean
  onRun: () => void
}) {
  const f = comparison?.fountain
  const a = comparison?.arq

  const goodputRatio = f && a && a.goodputPerByte > 0 ? f.goodputPerByte / a.goodputPerByte : 0
  const airSaved = f && a && a.bytesOnAir > 0 ? 1 - f.bytesOnAir / a.bytesOnAir : 0

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="label">Benchmark · Fountain vs Naive ARQ · identical loss + seed</span>
        <Button onClick={onRun} disabled={comparing} variant="solid">
          {comparing ? 'Running both…' : 'Run benchmark'}
        </Button>
      </div>

      {/* verdict */}
      {f && a && (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-y border-line py-2.5">
          <Verdict big={goodputRatio >= 1 ? `${goodputRatio.toFixed(1)}×` : `${(1 / goodputRatio).toFixed(1)}× worse`} label="goodput / byte" good={goodputRatio >= 1} />
          <Verdict big={`${Math.round(airSaved * 100)}%`} label="less bytes on air" good={airSaved >= 0} />
          <Verdict big={`${f.retransmits} vs ${a.retransmits}`} label="retransmits" good={f.retransmits <= a.retransmits} />
          <Verdict big={`${a.fragmentsLost - f.fragmentsLost >= 0 ? '' : '+'}${f.fragmentsLost} vs ${a.fragmentsLost}`} label="fragments lost on air" good />
        </div>
      )}

      {/* two columns: mechanism + results */}
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Column kind="fountain" result={f} highlight />
        <Column kind="arq" result={a} />
      </div>

      {!comparison && !comparing && (
        <p className="label mt-3 !text-ink-3">
          press Run benchmark to transmit both strategies under the current link loss and compare
        </p>
      )}
    </section>
  )
}

function Verdict({ big, label, good }: { big: string; label: string; good: boolean }) {
  return (
    <span className="flex items-baseline gap-2">
      <span
        className="font-sans text-[22px] font-700 tabular-nums"
        style={{ color: good ? 'var(--color-ink)' : 'var(--color-accent)' }}
      >
        {big}
      </span>
      <span className="label !text-[9px]">{label}</span>
    </span>
  )
}

function Column({
  kind,
  result,
  highlight,
}: {
  kind: 'fountain' | 'arq'
  result?: RunResult
  highlight?: boolean
}) {
  const m = MECHANISM[kind]
  return (
    <div className={`border p-3.5 ${highlight ? 'border-ink' : 'border-line'}`} style={highlight ? { boxShadow: '4px 4px 0 var(--color-ink)' } : undefined}>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[18px] font-600 text-ink">{m.name}</span>
        <span className="label !text-[9px]">{m.tag}</span>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-ink-2">{m.how}</p>

      <div className="mt-3 space-y-1.5 border-t border-line-soft pt-3">
        <Row k="STATUS" v={result ? (result.allDelivered ? 'DELIVERED' : 'FAILED') : '—'} tone={result ? (result.allDelivered ? 'ink' : 'accent') : 'muted'} />
        <Row k="GOODPUT / BYTE" v={result ? result.goodputPerByte.toFixed(3) : '—'} />
        <Row k="BYTES ON AIR" v={result ? result.bytesOnAir.toLocaleString() : '—'} />
        <Row k="FRAGMENTS LOST" v={result ? String(result.fragmentsLost) : '—'} />
        <Row k="RETRANSMITS" v={result ? String(result.retransmits) : '—'} tone={result && result.retransmits > 0 ? 'accent' : 'ink'} />
        <Row k="AIRTIME" v={result ? `${result.airtimeSec.toFixed(1)}s` : '—'} />
      </div>
    </div>
  )
}

function Row({ k, v, tone = 'ink' }: { k: string; v: string; tone?: 'ink' | 'accent' | 'muted' }) {
  const color = tone === 'accent' ? 'var(--color-accent)' : tone === 'muted' ? 'var(--color-ink-3)' : 'var(--color-ink)'
  return (
    <div className="flex items-baseline justify-between">
      <span className="label !text-[9px]">{k}</span>
      <span className="mono text-[12px] tabular-nums" style={{ color }}>
        {v}
      </span>
    </div>
  )
}
