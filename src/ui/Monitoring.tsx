/* §12 Monitoring & observability — per-link RSSI/SNR/loss, airtime, duty cycle. */
import type { useSimulation } from '../state/useSimulation'

type Sim = ReturnType<typeof useSimulation>

export function Monitoring({ sim }: { sim: Sim }) {
  const dutyWindowS = 60
  const dutyPct = Math.min(100, (sim.airtimeSec / dutyWindowS) * 100)
  const avgSnr = sim.linkStats.length
    ? Math.round(sim.linkStats.reduce((a, s) => a + s.snr, 0) / sim.linkStats.length)
    : 0

  return (
    <section className="panel h-full p-4">
      <div className="flex items-baseline justify-between">
        <span className="label">Monitoring · link telemetry</span>
        <span className="label !text-ink-3">RSSI · SNR · LOSS</span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line-2 text-left">
              {['LINK', 'RSSI', 'SNR', 'OBS LOSS', 'TX/LOST'].map((h) => (
                <th key={h} className="label py-1 pr-3 font-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="mono text-[11px]">
            {sim.linkStats.map((s) => {
              const high = s.lossRate > 0.3
              return (
                <tr key={s.key} className="border-b border-line-soft">
                  <td className="py-1 pr-3 text-ink">{s.key}</td>
                  <td className="py-1 pr-3 text-ink-2">{s.rssi} dBm</td>
                  <td className="py-1 pr-3 text-ink-2">{s.snr} dB</td>
                  <td className="py-1 pr-3" style={{ color: high ? 'var(--color-accent)' : 'var(--color-ink)' }}>
                    {Math.round(s.lossRate * 100)}%
                  </td>
                  <td className="py-1 pr-3 text-ink-3">
                    {s.attempts}/{s.lost}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
        <Mini k="AIRTIME" v={sim.airtimeSec >= 1 ? `${sim.airtimeSec.toFixed(1)}s` : `${Math.round(sim.airtimeSec * 1000)}ms`} />
        <Mini k="DUTY (EU868)" v={`${dutyPct.toFixed(1)}%`} tone={dutyPct > 10 ? 'accent' : 'ink'} />
        <Mini k="AVG SNR" v={`${avgSnr} dB`} />
      </div>
      <div className="label mt-2 !text-[9px] !text-ink-3">
        EU868 caps duty at 10% · NA915 looser · RSSI/SNR modelled from configured link loss
      </div>
    </section>
  )
}

function Mini({ k, v, tone = 'ink' }: { k: string; v: string; tone?: 'ink' | 'accent' }) {
  return (
    <div>
      <div className="label !text-[9px]">{k}</div>
      <div
        className="mono mt-1 text-[15px] tabular-nums"
        style={{ color: tone === 'accent' ? 'var(--color-accent)' : 'var(--color-ink)' }}
      >
        {v}
      </div>
    </div>
  )
}
