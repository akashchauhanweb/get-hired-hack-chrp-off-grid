/* §13 Security & trust model — encrypt-before-fragment, relays see ciphertext. */

const ROWS = [
  { k: 'CIPHER', v: 'AES-256-GCM' },
  { k: 'ORDER', v: 'encrypt → fragment' },
  { k: 'PER-FRAG', v: 'HMAC-SHA256 tag' },
  { k: 'RELAYS', v: 'ciphertext only' },
]

export function SecurityPanel({ encrypted }: { encrypted: boolean }) {
  return (
    <section className="panel h-full p-4">
      <div className="flex items-baseline justify-between">
        <span className="label">Security · trust model</span>
        <span className="label !text-ink-3">§13</span>
      </div>

      <div className="mt-3 space-y-2">
        {ROWS.map((r) => (
          <div key={r.k} className="flex items-center justify-between border-b border-line-soft pb-1.5">
            <span className="label !text-[9px]">{r.k}</span>
            <span className="mono text-[11px] text-ink">{r.v}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-snug text-ink-2">
        Relays are <span className="font-600 text-ink">untrusted</span> — they forward sealed bytes
        and never see content, mirroring Meshtastic's channel PSK. {encrypted && 'Payload sealed. '}
      </p>
      <p className="label mt-2 !text-[9px] !text-ink-3">
        caveat: demo PSK ships in-page · production provisions keys out of band
      </p>
    </section>
  )
}
