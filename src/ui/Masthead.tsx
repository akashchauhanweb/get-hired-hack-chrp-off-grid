import { Stat } from './primitives'

export function Masthead({
  bytesOnAir,
  goodput,
  avgLoss,
  tab,
  setTab,
}: {
  bytesOnAir: number
  goodput: number
  avgLoss: number
  tab: 'live' | 'business'
  setTab: (t: 'live' | 'business') => void
}) {
  return (
    <header className="border-b-2 border-ink pb-4">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <div className="label !tracking-[0.18em]">
            FARCAST · LORA MESH MEDIA LINK · 5 NODES · HOP LIMIT 3
          </div>
          <h1 className="display mt-2 text-[clamp(26px,6vw,68px)] text-ink [overflow-wrap:break-word]">
            Five nodes, <span className="font-400 italic text-ink-2">one honest byte.</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-end gap-x-7 gap-y-2 pb-1">
          <Stat value={bytesOnAir.toLocaleString()} label="BYTES ON AIR" />
          <Stat value={goodput > 0 ? goodput.toFixed(2) : '—'} label="GOODPUT ÷ BYTE" />
          <Stat value={`${avgLoss}%`} label="LINK LOSS" tone="accent" />
        </div>
      </div>

      <nav className="mt-4 flex gap-6">
        {(['live', 'business'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="label !text-[12px] pb-1"
            style={{
              color: tab === t ? 'var(--color-ink)' : 'var(--color-ink-3)',
              borderBottom: tab === t ? '2px solid var(--color-ink)' : '2px solid transparent',
            }}
          >
            {t === 'live' ? 'LIVE SIMULATION' : 'PRODUCT & BUSINESS CASE'}
          </button>
        ))}
      </nav>
    </header>
  )
}
