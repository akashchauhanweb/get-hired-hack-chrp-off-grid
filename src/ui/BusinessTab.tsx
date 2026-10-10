/* §14 Real product & business case — the three axes as value props, the form
   factors, and six credible buyer segments. */

const VALUE_PROPS = [
  {
    n: '01',
    axis: 'Media through / byte',
    prop: 'More signal per joule, per dollar, per second of air.',
    body: 'Aggressive source compression plus FEC tuned to measured loss means every scarce byte carries useful payload — the economics of off-grid comms.',
  },
  {
    n: '02',
    axis: 'Recovers from loss',
    prop: 'Delivery that survives a collapsing network.',
    body: 'Rateless fountain coding rebuilds from any sufficient subset — no retransmit storms, no feedback round-trips, graceful degradation as links fail.',
  },
  {
    n: '03',
    axis: 'Honest status',
    prop: 'Status you can stake a life on.',
    body: 'DELIVERED only on hash-verified reconstruction; a truthful FAILED otherwise. In safety-critical comms, a false green is worse than a red.',
  },
]

const FORM_FACTORS = [
  { k: 'SDK', v: 'Embeddable pipeline — compress · FEC · encrypt · status — for any LoRa/mesh stack.' },
  { k: 'MONITORING SAAS', v: 'Fleet dashboards: link health, airtime/duty, delivery telemetry, honest alerting.' },
  { k: 'HARDWARE BUNDLES', v: 'Pre-provisioned nodes + gateway, keys managed, tuned presets per region.' },
]

const SEGMENTS = [
  { k: 'Disaster response', why: 'Cell + power gone; imagery and voice must cross improvised relays with honest delivery receipts.' },
  { k: 'Defense / TAK', why: 'Contested RF, untrusted relays; ciphertext-only forwarding and loss resilience are table stakes.' },
  { k: 'Search & rescue', why: 'Teams spread beyond coverage; a photo of terrain or a voice note can redirect a search.' },
  { k: 'Remote industrial', why: 'Pipelines, mines, offshore: telemetry + inspection snapshots over kilometres without cellular.' },
  { k: 'Agriculture / conservation', why: 'Sparse sensors and ranger nets over huge areas; tiny media on a shoestring power budget.' },
  { k: 'Large events', why: 'Saturated spectrum, dropped cells; crew coordination with media when the public network folds.' },
]

export function BusinessTab() {
  return (
    <div className="space-y-6 py-2">
      <div className="max-w-3xl">
        <h2 className="display text-[clamp(26px,3.6vw,44px)] text-ink">
          A pipe this narrow <span className="font-400 italic text-ink-2">is a market.</span>
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          The same three properties the judges score are the three reasons a buyer signs: useful
          media per byte, recovery when the network fails, and delivery status honest enough to act
          on. Below: how each becomes a product, in what form factor, for whom.
        </p>
      </div>

      {/* value props = the three axes */}
      <div className="grid gap-4 lg:grid-cols-3">
        {VALUE_PROPS.map((v) => (
          <section key={v.n} className="panel p-4">
            <div className="flex items-baseline justify-between">
              <span className="label">{v.axis}</span>
              <span className="mono text-[10px] text-ink-3">{v.n}</span>
            </div>
            <h3 className="font-display mt-2 text-[20px] font-600 leading-tight text-ink">{v.prop}</h3>
            <p className="mt-2 text-[13px] leading-snug text-ink-2">{v.body}</p>
          </section>
        ))}
      </div>

      {/* form factors */}
      <section className="panel hard-shadow p-5">
        <span className="label">Form factors</span>
        <div className="mt-3 grid gap-5 md:grid-cols-3">
          {FORM_FACTORS.map((f) => (
            <div key={f.k} className="border-l-2 border-ink pl-3">
              <div className="font-display text-[17px] font-600 text-ink">{f.k}</div>
              <p className="mt-1 text-[12px] leading-snug text-ink-2">{f.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* buyer segments */}
      <div>
        <span className="label">Buyer segments</span>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SEGMENTS.map((s, i) => (
            <section key={s.k} className="panel p-4">
              <div className="flex items-baseline gap-2">
                <span className="mono text-[11px] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                <h4 className="font-display text-[17px] font-600 text-ink">{s.k}</h4>
              </div>
              <p className="mt-2 text-[12px] leading-snug text-ink-2">{s.why}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
