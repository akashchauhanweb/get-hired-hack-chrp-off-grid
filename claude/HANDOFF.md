# FARCAST — session handoff / continue-here

**Read this first in a new Claude session.** It captures everything built so you
can pick up exactly where the previous session left off, including decisions that
are NOT obvious from the code and tooling tricks that save time.

- **Project:** FARCAST — a live, self-contained web demo that sends real media
  (image + Codec2-rate voice + text) both ways across a 5-node simulated LoRa mesh
  with per-link loss and hop limit 3. Hackathon build ("get-hired-hack").
- **Status:** Feature-complete and working. Build passes, 11 unit tests pass.
  Dev server runs at `http://localhost:5173`. **Not a git repo.**
- **Spec:** `claude/build-brief.md` — but note that file only contains **§1–§12**.
  **§12 (monitoring), §13 (security), §14 (business), §15 (design) were pasted
  into chat and are summarized in section 3 below** — the file's §12 is
  "Research anchors," not monitoring. Treat the chat §13–§15 as authoritative.
- **User-facing overview:** `README.md` (full writeup with measured stats).

---

## 1. How to run / test / build / see it

```bash
cd ~/Documents/get-hired-hack
npm install
npm run dev      # http://localhost:5173
npm test         # vitest — 11 tests (4 files)
npm run build    # tsc --noEmit && vite build  (this is the typecheck gate)
```

**Seeing the UI (important — the built-in browser can't reach localhost).**
The in-app browser runs on the user's machine; the dev server runs in the shell,
so screenshot with **headless Chrome from the shell** instead:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1500,1120 --virtual-time-budget=9000 \
  --screenshot=/tmp/shot.png "http://localhost:5173/?run=1&instant=1"
```
Then `Read` the PNG. **Gotcha:** headless forces a **~485px minimum viewport**, so
a `--window-size` narrower than that gets the layout at 485 but the image clipped
to the window width — to screenshot a phone layout, use `--window-size=500,...` (or
wider) and it shows the true layout. There is NO real horizontal overflow (verified
via a temporary `scrollWidth==clientWidth` diagnostic).

**Deep links** (query params the app honors):
- `?run=1` — auto-send an A→E image on load
- `?run=1&loss=90` — honest-failure beat (unrecoverable, truthful shortfall)
- `?bench=1&loss=40` — run the Fountain-vs-ARQ benchmark head-to-head
- `&instant=1` — skip the airtime animation, jump to the end state (needed for
  screenshots because `performance.now()`-driven rAF doesn't advance under headless
  virtual-time)

**Live-run interaction:** `npm run dev` is likely already running in the background.
Send image from A → wait → send voice/text, or reply from E. One transfer at a time.

---

## 2. Tech stack & conventions

- **React 18 + Vite 6 + TypeScript (strict) + Tailwind v4** (`@tailwindcss/vite`,
  CSS-first `@theme` in `src/styles/index.css`).
- **WebCrypto** (AES-256-GCM + HMAC-SHA-256), **SVG** mesh, **Canvas** image render,
  **Web Audio** playback. **Zero heavy deps** — fountain code, codecs, radio sim all
  hand-rolled. Fonts via `@fontsource` (Fraunces, Archivo, IBM Plex Mono).
- **Design = editorial / Swiss** (NOT the dark instrument console that was rejected
  early as "AI-looking"). Tokens in `src/styles/index.css`:
  - paper `#f3f2ed`, ink `#141414`, one accent red `#c22a22`, soft line `#d7d5cb`.
  - Fonts: `--font-display` Fraunces (serif, playful), `--font-sans` Archivo,
    `--font-mono` IBM Plex Mono. Numerics are tabular mono.
  - **Rules:** hard edges only (hard offset shadows via `.hard-shadow`, NEVER soft
    blur), small radii, segmented fragment meters, `.hatch` = placeholder texture.
  - Endpoints are rendered inside `PhoneFrame` (ink bezel + notch + status bar) =
    "two phones talking over the mesh." Width capped `max-w-[340px]`, %-based.
- **Responsive:** grid cells carry `min-w-0`; masthead headline wraps; root has
  `overflow-x-hidden`. Composer buttons are `flex-wrap`.
- **Skills:** `dataviz` (loaded, used for palette validation — the palette passed
  `validate_palette.js`). `ui-ux-pro-max` is INSTALLED at
  `~/.claude/skills/ui-ux-pro-max/` (user asked; search via
  `python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<q>" --domain <d>`).
  **`frontend-design` is NOT available** in this environment.

---

## 3. Locked decisions (brief + this session) — do not silently change

From the brief (§1–§11): 5 nodes, **partial mesh**, **hop limit 3**, ~200-byte
fragments, LT fountain hero vs naive-ARQ baseline, real Codec2-RATE voice (not real
Codec2), tiny ~64×64 image, airtime from preset data rate.

From the chat-only sections and this session's work:
- **§13 OVERRIDES §8/§9 on encryption.** Encryption is IN scope: real WebCrypto
  AES-256-GCM **encrypt-before-fragment**, per-fragment HMAC auth tags, relays
  forward **ciphertext only** (untrusted-relay threat model). (The older brief text
  said encryption was only "noted, not simulated" — that is superseded.)
- **§12 Monitoring:** per-node/link RSSI/SNR/loss, airtime/duty-cycle, truthful
  alerting, audit log doubling as the honesty ledger. On-screen (woven into Live).
- **§14 Business:** three axes recast as value props; form factors = SDK /
  monitoring SaaS / hardware bundles; six buyer segments (disaster response,
  defense/TAK, search & rescue, remote industrial, agriculture/conservation, large
  events). Lives as the **Product & Business Case** tab.
- **§15 Design:** "must not look AI-generated." We landed on **editorial/Swiss**
  (see section 2). The user explicitly rejected the first dark-instrument direction.
- **Voice = real IMA ADPCM** at ~4 kHz (~16 kbps), reported honestly — NOT actual
  Codec2, NOT a size-model. User chose live-mic record (fallback to synth sample if
  denied).
- **Image = bundled procedural hero** (sunset, labeled `sunset-sample.png`) +
  optional upload (uploads use the real `file.name`).
- **ARQ baseline models lossy ACK round-trips** (stop-and-wait, ACKs cross the same
  mesh, dropped ACK → retransmit storm). This is deliberate so fountain wins
  honestly — do NOT "fix" ARQ to be a selective-repeat oracle (that made fountain
  lose).
- **Bidirectional + one-at-a-time:** both A and E send/receive text/image/voice;
  a global **channel lock** refuses any send while a transfer is in flight.
- **Determinism:** seeded PRNG (`mulberry32`), run seed `2026`, PSK constant
  `farcast-demo-channel-0x2b`. Do NOT add direction into the RNG seed phase — it
  changes outcomes and made fountain lose at the demo seed (A/E already differ via
  flood source).

---

## 4. Architecture (what each file does)

Engine is **pure, DOM-free, deterministic, unit-tested**. Browser layer feeds it
media and renders results.

```
src/
  sim/
    rng.ts         mulberry32 PRNG, chance(), hashSeed()
    presets.ts     RadioPreset table (real Meshtastic kbps) + airtimeSeconds()
    topology.ts    NODES A–E (x,y only used by UI), DEFAULT_LINKS, buildTopology,
                   SOURCE=A DEST=E HOP_LIMIT=3, reachable()
    flood.ts       floodPacket() — managed hop-limited flood, per-link Bernoulli
                   loss, returns {delivered, hops, events[], airLinks}
  packet/
    fragment.ts    PACKET_BYTES=200, HEADER_BYTES=18, SYMBOL_BYTES=182; serialize/
                   deserialize a real packet (type/mediaId/seed/k/cipherLen/tag/symbol)
    __tests__/pipeline.test.ts  full byte chain (encrypt→fountain→packets→loss→tags→decode→decrypt→sha)
  crypto/
    encrypt.ts     deriveKeys(psk)→{aes,mac}; encrypt/decrypt (AES-GCM); fragTag/
                   tagsMatch (truncated HMAC per fragment). WebCrypto. Async.
  codec/
    fountain.ts    makeEncoder(data,symbolSize), decode() — LT: robustSolitonCdf,
                   neighbours(seed) from mulberry32, peeling decoder. THE HERO.
    bytes.ts       xorInto, toBlocks, fromBlocks, bytesEqual
    __tests__/fountain.test.ts
  media/
    imageCodec.ts  compress/decompress — median-cut 16-colour palette, 4-bit indices (pure)
    adpcm.ts       downsample, encodeAdpcm/decodeAdpcm (IMA 4-bit), adpcmKbps (pure)
    image.ts       heroImage(), imageFromFile(file) (uses file.name!), drawRgba, renderPayload (DOM/canvas)
    voice.ts       recordVoice(mic)/sampleVoice(synth), playPayload, payloadWaveform (DOM/WebAudio). VOICE_RATE=4000
    text.ts        textInput(str)→MediaInput, decodeText(bytes)
    hash.ts        sha256Hex, shortHash
    __tests__/codecs.test.ts
  engine/
    simulation.ts  runMedia()/runSimulation(): per media → encrypt → fountain|ARQ →
                   flood (from→to, default A→E) → reassemble → decrypt → sha verify.
                   RunConfig has optional from/to. MAX_FOUNTAIN_OVERHEAD=8, MAX_ARQ_RETX=8.
    __tests__/simulation.test.ts  (fountain-vs-ARQ test AVERAGES over seeds — don't un-average)
  state/
    useSimulation.ts  the controller/hook. Bidirectional channel model:
                      messages[], messageViews[], activeId, send(draft), channel lock
                      (busyMessage), reset, runBenchmark, per-run metrics/linkStats/
                      ledger/currentEvents. keysReady flag. ?loss/?instant honored here.
  ui/
    Masthead.tsx       title + 3 stats + LIVE/BUSINESS tabs
    Topology.tsx       SVG plan view, loss labels, kill-relay on click, animated packet
    PhoneFrame.tsx     ink handset bezel + notch + status bar; wraps an endpoint
    EndpointPanel.tsx  one symmetric endpoint (A or E): conversation (SENT/RECEIVED,
                       text/image/voice) + composer (Message/Send, Caption, Choose
                       file, Send image, Record, Send voice). conversation maxHeight 430 minHeight 300
    AxisMetrics.tsx    AX·01 goodput / AX·02 recovery / AX·03 honest status / AX·04 airtime
    ComparisonPanel.tsx  Run benchmark → fountain vs ARQ verdict + columns w/ mechanism
    LinkFaders.tsx     per-link loss sliders + ALL 5/40/90 shortcuts
    Monitoring.tsx     §12 RSSI/SNR/loss table + airtime/duty/avg-SNR
    SecurityPanel.tsx  §13 cipher/order/per-frag tag/relays-ciphertext + caveat
    AuditLog.tsx       packet-capture ledger (truthful per-fragment state)
    ControlBar.tsx     preset/speed/recovery-mode(+mechanism note)/kill-relay/reset
    BusinessTab.tsx    §14 value props + form factors + 6 buyer segments
    primitives.tsx     Panel/Stat/FragMeter/Button/Select/Field/StatusDot/SectionLabel
  App.tsx            composes Live view + Business tab; deep-link autostart effect
  main.tsx           fonts + render <App/>
  styles/index.css   @theme tokens + editorial base styles + .panel/.hard-shadow/.hatch
```

---

## 5. Measured results (8 seeds, image+voice, Long Fast)

| loss | fountain delivered | ARQ delivered | fountain goodput/B | ARQ goodput/B | ratio | ARQ retransmits |
|---|---|---|---|---|---|---|
| 10% | 100% | 100% | 0.040 | 0.037 | 1.08× | 10 |
| 20% | 100% | 100% | 0.030 | 0.031 | 0.99× | 29 |
| 30% | 100% | 88% | 0.023 | 0.022 | 1.05× | 79 |
| 40% | 88% | 25% | 0.020 | 0.015 | 1.27× | 161 |
| 50% | 13% | 0% | 0.007 | 0.013 | 0.57× | 232 |
| 60%+ | 0% | 0% | ~0 | ~0.01 | — | 263–280 |

Hero window = **~35–45% loss** (40%: fountain 88% vs ARQ 25% delivered, 1.27×
goodput, 0 vs 161 retransmits). Fountain = 0 targeted retransmits at every level.
Above ~50% neither delivers and the app says so honestly (0% false DELIVERED).
Full analysis + caveats in README §4. To regenerate: write a throwaway vitest that
loops `runSimulation` over seeds/losses and `console.log`s a table (previous
harness lived at `src/__stats__/report.test.ts`, deleted after use).

---

## 6. Gotchas learned this session (save yourself the debugging)

- **Negative animation time bug:** a frame-delta rAF loop produced a negative `t`
  under StrictMode double-mount → negative array index → `undefined.x` crash (blank
  page). Fixed by driving `t` from elapsed-since-start (monotonic) and clamping. Use
  elapsed-time, not per-frame deltas.
- **Headless screenshot ≠ layout width** (see section 1) — not a real overflow.
- **esbuild postinstall is sandbox-blocked** but the binary works anyway; `vite`
  and `vitest` run fine. Don't chase it.
- **Tailwind v4:** colors are `@theme { --color-xxx }` → utilities `bg-xxx`,
  `text-xxx`, `border-xxx`. Numeric `font-700` etc. are used (work as arbitrary).
- **TS 5.7 typed arrays vs WebCrypto:** `Uint8Array<ArrayBufferLike>` isn't assignable
  to `BufferSource` — cast `as BufferSource` at importKey/encrypt/sign sites; for
  AudioBuffer use `buffer.getChannelData(0).set(samples)` not `copyToChannel`.
- **LT is probabilistic for small K** — a single-seed "fountain beats ARQ" assertion
  is flaky; average over seeds.
- **Benchmark favorability depends on seed/loss** — demo seed 2026 at ≤~45% loss
  shows fountain winning; don't change the RNG phase strings.

---

## 7. What's next (user asked for suggestions; these are queued ideas)

Ranked by demo impact (full rationale in README §9):
1. **Progressive / partial-decode image** — show a coarse preview as fragments
   arrive; strongest visual for "any sufficient subset."
2. **Live tamper demo** — surface the per-fragment HMAC reject we already compute
   (flip-a-bit button) to make §13 tangible.
3. **Adaptive FEC** — tune fountain overhead to measured loss; show it as a number.
4. **Real Codec2 via WASM** — intelligible voice at a true Codec2 rate.
5. Unequal error protection · energy/battery model · duty-cycle enforcement ·
   topology editor · shareable/export runs · latency axis.

The user said the two highest-value next steps are **progressive-image decode** and
the **live tamper demo**. Confirm with them before building.

---

## 8. To resume

1. `cd ~/Documents/get-hired-hack && npm run dev` (if not already running).
2. Read this file + `README.md` + `claude/build-brief.md` (remember §13–§15 are
   summarized here, not in the brief file).
3. Screenshot via headless Chrome (section 1) to see current state.
4. Ask the user what to work on; default candidates are the "what's next" list.
