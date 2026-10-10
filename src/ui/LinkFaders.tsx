/* Per-link packet-loss faders the presenter adjusts live (§5). */
import { linkKey, type MeshLink } from '../sim/topology'

export function LinkFaders({
  links,
  setLinkLoss,
}: {
  links: MeshLink[]
  setLinkLoss: (key: string, loss: number) => void
}) {
  const setAll = (loss: number) => links.forEach((l) => setLinkLoss(linkKey(l.a, l.b), loss))

  return (
    <section className="panel h-full p-4">
      <div className="flex items-baseline justify-between">
        <span className="label">Per-link loss</span>
        <div className="flex gap-2">
          {[0.05, 0.4, 0.9].map((v) => (
            <button key={v} className="label !text-ink-3 hover:!text-ink" onClick={() => setAll(v)}>
              ALL {Math.round(v * 100)}%
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">
        {links.map((l) => {
          const k = linkKey(l.a, l.b)
          const high = l.loss > 0.3
          return (
            <div key={k}>
              <div className="flex items-baseline justify-between">
                <span className="mono text-[11px] text-ink">{l.a}→{l.b}</span>
                <span
                  className="mono text-[11px]"
                  style={{ color: high ? 'var(--color-accent)' : 'var(--color-ink-2)' }}
                >
                  {Math.round(l.loss * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={95}
                value={Math.round(l.loss * 100)}
                onChange={(e) => setLinkLoss(k, Number(e.target.value) / 100)}
                className="mt-1 w-full"
                style={{ accentColor: high ? 'var(--color-accent)' : 'var(--color-ink)' }}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
