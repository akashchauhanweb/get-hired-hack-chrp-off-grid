/* Audit log / packet capture — the honesty ledger (§7, §12). Relays only ever
   see ciphertext, so the capture shows ciphertext stubs, never plaintext. */
import type { LedgerRow } from '../state/useSimulation'

const STATE_COLOR: Record<LedgerRow['state'], string> = {
  DELIVERED: 'var(--color-ink)',
  RECOVERED: 'var(--color-ink)',
  LOST: 'var(--color-accent)',
}

export function AuditLog({ rows, t }: { rows: LedgerRow[]; t: number }) {
  return (
    <section className="panel p-4">
      <div className="flex items-baseline justify-between">
        <span className="label">Audit log · packet capture</span>
        <span className="label !text-ink-3">truthful per-fragment state · ciphertext only</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line-2 text-left">
              {['T+', 'SEQ', 'FRAGMENT', 'PATH', 'HOPS', 'STATE', 'CIPHERTEXT'].map((h) => (
                <th key={h} className="label py-1.5 pr-4 font-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="mono text-[11px]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-3 text-ink-3">
                  — idle · press Transmit media —
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={`${r.seq}-${i}`} className="border-b border-line-soft">
                <td className="py-1.5 pr-4 text-ink-3">{(t - i * 1.5).toFixed(1)}s</td>
                <td className="py-1.5 pr-4 text-ink-2">{r.seq}</td>
                <td className="py-1.5 pr-4 text-ink">{r.frag}</td>
                <td className="py-1.5 pr-4 text-ink-2">{r.path}</td>
                <td className="py-1.5 pr-4 text-ink-3">{r.tHop || '—'}</td>
                <td className="py-1.5 pr-4">
                  <span className="inline-flex items-center gap-1.5" style={{ color: STATE_COLOR[r.state] }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATE_COLOR[r.state] }} />
                    {r.state}
                  </span>
                </td>
                <td className="py-1.5 pr-4 text-ink-3">a3f1·{(0x4e + i).toString(16)}c…9b2</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
