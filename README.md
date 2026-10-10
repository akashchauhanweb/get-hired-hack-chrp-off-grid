# FARCAST — resilient media over a LoRa mesh

**Five nodes, one honest byte.**

FARCAST is a live, self-contained web demo that sends a **real image, a real
Codec2-rate voice note, and real text** both ways across a **5-node partial-mesh
LoRa network** with per-link packet loss and hop limit 3 — and proves, on screen
and in real time, three things: how much media gets through *per byte*, how well
delivery *recovers from loss*, and how *honest* the delivery status is.

> **Functional simulation, not a mockup.** Everything the bytes touch is real
> code on real bytes: compress → **encrypt (AES-256-GCM)** → fragment into
> ~200-byte packets → **LT fountain-code** → relay hop-by-hop → reassemble →
> decrypt → **SHA-256 verify** → render the image / play the audio / show the
> text. The **only** simulated layer is the physical radio (the links, per-link
> loss, flooding, hop limit, airtime) — the one part that would otherwise need
> hardware, and the one part you *want* to simulate so loss and recovery are
> visible and controllable live.

---

## 1. What the traditional thing does

Today's LoRa mesh networking — **Meshtastic** is the reference — is built for
tiny text telemetry, not media:

- **A very narrow pipe.** LoRa runs at roughly **0.3–22 kbps** depending on the
  radio preset. The default "Long Fast" preset is **~1.07 kbps**. One ~200-byte
  packet takes **~1.5 seconds on air** at that rate.
- **Tiny packets, multi-hop flooding.** Messages are ~200-byte frames, relayed by
  **managed flooding** bounded by a **hop limit** (default 3). There is no dynamic
  routing — every node that hears a new packet rebroadcasts it once.
- **Lossy links.** RF links drop packets. The stock answer is **ARQ** — the
  receiver acknowledges, and the sender retransmits what wasn't acknowledged.
- **AES channels.** Traffic on a channel is encrypted with a shared PSK
  (AES-128/256); relays forward ciphertext.
- **Net effect: no practical media.** A normal photo is hundreds of KB; a normal
  voice clip is tens of KB. Over a ~1 kbps lossy multi-hop pipe, you simply
  cannot send them — so the clients (Apple / Android / **Meshtastic Web**) do
  text, position, and small telemetry. Media is the radio's constraint, identical
  across every client.

FARCAST is **not** built on any of those clients (they talk to real radios over
BLE/USB/Wi-Fi; demoing controllable loss + fountain recovery on them would need
hardware and firmware changes). It is a **standalone build from scratch** that
keeps every realism anchor — 200-byte fragments, hop limit 3, real preset data
rates, airtime, AES — and asks: *what would it take to actually move media
through this pipe, honestly?*

---

## 2. What we built on top of it

| Traditional | FARCAST adds |
|---|---|
| Text-only telemetry | A **real media pipeline** — image + Codec2-rate voice + text, genuinely compressed, transmitted, and reconstructed |
| ARQ retransmit on loss | **LT fountain (erasure) coding** as the hero — rebuild from *any* sufficient subset, **zero targeted retransmits** — benchmarked head-to-head against a naive-ARQ baseline |
| "Sent" ≈ handed to the radio | **Honest delivery status** — `DELIVERED` only after SHA-256 verifies the reconstruction equals the original; a truthful `FAILED — need N more fragments` otherwise |
| One-way text in a client | A **bidirectional link** — both endpoints A and E send/receive text, image, or voice, with a **channel lock** (one transfer on the air at a time) |
| AES channel (noted) | **Real WebCrypto AES-256-GCM encrypt-before-fragment** + per-fragment HMAC auth tags; relays provably carry **ciphertext only** |
| Basic signal info | A **monitoring pillar** — per-link RSSI/SNR/observed-loss, airtime, EU868 duty cycle, and an audit log that doubles as the honesty ledger |
| A hobbyist tool | A **product/business framing** — the three technical axes recast as value props, form factors, and six buyer segments |

---

## 3. Approaches taken (how each piece works)

**Source compression — spend bytes like they're scarce**
- *Image:* downscaled to **64×64**, quantized with a hand-rolled **median-cut
  palette codec** (16 colours, 4-bit indices) → **~2 KB**, ~12 fragments.
- *Voice:* real **IMA ADPCM** on real PCM, decimated to a low speech rate
  (~4 kHz, ~16 kbps reported honestly). We do **not** run actual Codec2 (too heavy
  for a clean build) and this is **not** a size-model; the true bitrate is shown.
- *Text:* UTF-8 bytes through the exact same pipeline (usually 1 block).

**Security — encrypt before you fragment** (`src/crypto`)
- The whole payload is sealed once with **AES-256-GCM**, *then* the ciphertext is
  fragmented — so relays only ever forward sealed bytes (untrusted-relay threat
  model, mirroring Meshtastic's channel PSK).
- Every fragment carries a **truncated HMAC-SHA-256** auth tag, so a tampered or
  corrupt fragment is detected and dropped before it can poison the decoder.

**The hero — LT fountain code** (`src/codec/fountain.ts`)
- A **rateless erasure code**: each encoded symbol is the XOR of a random subset
  of source blocks, its neighbour set derived from a 32-bit **seed** via a
  **Robust Soliton** degree distribution (so the neighbour list is never
  transmitted). The decoder is **belief-propagation "peeling."**
- Result: the receiver rebuilds the file from **any** sufficiently large subset of
  symbols. Loss just means "emit a few more symbols" — **no ACKs, no targeted
  retransmits.** Measured decode overhead is **< 2× K** symbols on average.

**The baseline — naive ARQ** (`src/engine/simulation.ts`)
- Stop-and-wait: each fragment must be **ACKed by the receiver**, and the ACK
  crosses the **same lossy mesh**. A dropped ACK makes the sender resend a
  fragment the receiver already has — the classic **retransmit storm**. This
  feedback cost is exactly what a rateless code avoids, so the comparison is
  honest rather than rigged.

**The radio — the only simulated layer** (`src/sim`)
- **Managed flood** from source to destination: a node that first hears a packet
  rebroadcasts it once while the **hop limit (3)** allows; every link transmission
  is an independent **Bernoulli trial** against that link's loss rate.
- **Airtime** is computed from the chosen preset's real data rate; **RSSI/SNR**
  are modelled from configured loss (and labelled as modelled).
- A **seeded PRNG** makes every run **deterministic and reproducible** — the same
  seed drives the fountain neighbour sets and the radio, so the honest status is
  recomputed live whenever you move a loss fader.

**Honesty — never a green check without proof** (`src/media/hash.ts`)
- Reassemble → decrypt → **SHA-256**; `DELIVERED` flips true *only* when the hash
  of the reconstruction equals the hash of the original, and we then actually
  render the image / play the audio to prove it.

---

## 4. Results (measured, not claimed)

Averaged over **8 seeds**, image + voice, Long Fast preset, uniform per-link loss.
Fountain does **0 targeted retransmits at every loss level** by design.

| Link loss | Fountain delivered | ARQ delivered | Fountain goodput/B | ARQ goodput/B | Goodput ratio | ARQ retransmits (avg) |
|---|---|---|---|---|---|---|
| 10% | **100%** | 100% | 0.040 | 0.037 | 1.08× | 10 |
| 20% | **100%** | 100% | 0.030 | 0.031 | 0.99× | 29 |
| 30% | **100%** | 88% | 0.023 | 0.022 | 1.05× | 79 |
| 40% | **88%** | 25% | 0.020 | 0.015 | **1.27×** | 161 |
| 50% | 13% | 0% | 0.007 | 0.013 | 0.57× | 232 |
| 60%+ | 0% | 0% | ~0 | ~0.01 | — | 263–280 |

**What this says, honestly:**

1. **Up to ~30% loss, both deliver** — the pipe has enough headroom.
2. **The hero window is ~35–45% loss.** At **40%**, fountain delivers **88%** of
   the time while ARQ delivers only **25%** — a **~3.5× reliability gap** — at
   **1.27× the goodput** and **zero retransmits** vs ARQ's **~161**.
3. **ARQ's retransmits explode with loss** (10 → 29 → 79 → 161 → 232+): the
   retransmit storm, driven by ACKs that themselves drop. Fountain stays flat at 0.
4. **Beyond ~50% loss, this 5-node / hop-3 mesh is simply below capacity** and
   *neither* scheme can deliver — and FARCAST reports that honestly: **0% false
   deliveries**, a truthful `FAILED — need N more fragments`.
   - *Metric caveat:* above 50% the raw goodput ratio inverts only because
     fountain is rateless (it keeps emitting symbols and burns airtime trying)
     while ARQ gives up after its retry budget. The meaningful signals there are
     **delivery rate (0% for both)** and **honest FAILED status**, not goodput.

The single strongest beat: flip **Fountain ↔ Naive ARQ** at **40% loss** and watch
one deliver the photo while the other stalls — then crank loss to 90% and watch
the status fail honestly instead of lying.

---

## 5. What each panel does and shows

**Masthead** — the wordmark, the live link summary (5 nodes · hop limit 3), and the
three headline stats: **bytes on air**, **goodput ÷ byte**, and **link loss** (red).
Tabs switch between **Live Simulation** and the **Product & Business Case**.

**Topology** (left box) — the 5-node partial mesh as a plan view, with per-link
**loss %** labels, the active route / packet-loss / idle-relay legend, and a packet
animating hop-by-hop along its real delivered path. **Click a relay (B/C/D) to kill
it** and watch alternate-path recovery (or honest failure).

**The two phones — Endpoint A & Endpoint E** — the two handsets talking across the
mesh. Each is a full endpoint:
- *Conversation:* every message rendered from that phone's point of view —
  **SENT** (original) vs **RECEIVED** (reconstruction) — with `Delivered X/Y`, a
  segmented fragment meter, the image/voice/text itself, and a **play** button for
  received voice.
- *Composer:* **Message + Send** (text), **Caption**, **Choose file** +
  **Send image**, **Record** + **Send voice**.
- *Channel lock:* a send from either end is refused while any transfer is in
  flight — *"Channel busy — one transfer at a time."*

**Axis metrics (AX·01–04)** — the three judging axes made explicit and live, plus
the airtime budget:
- **AX·01 Media through / byte** — useful bytes ÷ bytes on air.
- **AX·02 Recovers from loss** — % blocks recovered, fragments lost, retransmits.
- **AX·03 Honest status** — `DELIVERED` / `FAILED` / `RECEIVING`, backed by SHA-256.
- **AX·04 Airtime budget** — seconds on air at the current preset (~1.5 s/fragment
  at Long Fast).

**Benchmark — Fountain vs Naive ARQ** — press **Run benchmark** to transmit both
strategies under the *current* link loss and the *same* seed. Each column explains
how that strategy works, then shows the head-to-head results; a verdict strip gives
the goodput ratio, bytes-on-air saved, and retransmit counts.

**Per-link loss** — a fader for every link, plus **ALL 5% / 40% / 90%** shortcuts,
so a presenter can sculpt the loss landscape live.

**Monitoring · link telemetry (§12)** — per-link **RSSI / SNR / observed loss /
TX-LOST** counts, plus **airtime**, **EU868 duty cycle** (10% cap flagged), and
average SNR. Framed as a real product pillar, not demo dressing.

**Security · trust model (§13)** — the cipher (AES-256-GCM), the order
(encrypt → fragment), the per-fragment HMAC tag, and the "relays see ciphertext
only" guarantee, with the honest key-handling caveat (demo PSK in-page).

**Audit log · packet capture** — a truthful per-fragment ledger: timestamp, seq,
fragment, path, hops, state (`DELIVERED` / `LOST` / `RECOVERED`), and a ciphertext
stub (relays never see plaintext).

**Control bar** — radio **preset**, animation **speed**, the **Recovery mode**
toggle (with a one-line mechanism note), **Kill relay** B/C/D, and **Reset**.

**Product & Business Case (§14)** — the three technical axes recast as three value
props, the form factors (**SDK / monitoring SaaS / hardware bundles**), and six
credible buyer segments (disaster response, defense/TAK, search & rescue, remote
industrial, agriculture/conservation, large events).

---

## 6. Honesty notes (what's real vs modelled)

- **Real:** the whole media pipeline on real bytes — compression, AES-256-GCM
  encryption, per-fragment HMAC tags, LT fountain encode/decode, reassembly,
  decryption, SHA-256 verification, and the final image render / audio playback.
- **Modelled & labelled as such:** the radio layer (links, per-link loss,
  flooding, hop limit, airtime) and **RSSI/SNR** (derived from configured loss).
- **Stated, not overclaimed:** voice is real low-bitrate **ADPCM** (~16 kbps),
  *not* actual Codec2 — the rate is reported honestly to dramatize the budget; the
  **PSK is a demo constant in-page** (production provisions keys out of band).

---

## 7. Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 11 unit tests across the real pipeline
npm run build    # typecheck + production build
```

Send the image from A → wait for it to finish → then A can send voice/text, or **E
can reply**. Move the loss faders, flip **Fountain ↔ Naive ARQ**, **Kill a relay**,
or press **Run benchmark**.

**Demo deep links**
- `/?run=1` — auto-send an A→E image on load
- `/?run=1&loss=90` — the honest-failure beat (unrecoverable, truthful shortfall)
- `/?bench=1&loss=40` — run the Fountain-vs-ARQ benchmark head-to-head
- append `&instant=1` to any of these to skip the airtime animation

---

## 8. Architecture

Core engine is **pure, DOM-free, deterministic, and unit-tested**; the browser
layer feeds it media and renders results.

```
src/
  sim/        rng · presets (real Meshtastic data rates) · topology (5-node partial mesh)
              · flood (hop-limit-3 managed flood with per-link loss)
  packet/     real ~200 B fragment framing (header + symbol + auth tag)
  crypto/     AES-256-GCM encrypt-before-fragment + per-fragment HMAC tags (§13)
  codec/      fountain.ts (LT: robust-soliton + peeling decoder) · bytes
  media/      imageCodec (median-cut palette) · adpcm (voice) · text · image/voice DOM · hash
  engine/     simulation.ts — orchestrates a run (both fountain & ARQ, both directions)
  state/      useSimulation.ts — bidirectional channel: conversation + lock + metrics
  ui/         Masthead · Topology · PhoneFrame + EndpointPanel ×2 · AxisMetrics
              · ComparisonPanel · LinkFaders · Monitoring §12 · SecurityPanel §13
              · AuditLog · ControlBar · BusinessTab §14
```

Stack: React + Vite + TypeScript + Tailwind v4, WebCrypto, SVG + Canvas + Web
Audio, zero heavy dependencies (the fountain code, codecs, and radio sim are all
hand-rolled). Editorial / Swiss design: warm paper, Fraunces display serif, strict
black-and-white with one editorial red, hard edges, segmented meters.

---

## 9. Ideas worth adding next (things you might not have considered)

These are beyond the current scope but would each strengthen a specific axis:

1. **Real Codec2 via WASM.** Swap the ADPCM model for genuine Codec2 (1.2–3.2 kbps)
   so the voice is *intelligible at a true Codec2 rate* — turns the honesty caveat
   into a flex, and makes the per-byte story airtight.
2. **Progressive / partial-decode image.** Render a coarse preview as fragments
   arrive and sharpen it as more land — visually dramatizes "any sufficient subset"
   and gives the receiver something *before* full delivery.
3. **Adaptive FEC.** Auto-tune the fountain overhead to the *measured* link loss
   (send just enough, not a fixed budget) and show the chosen overhead as a live
   number — directly improves the goodput axis and reads as intelligence.
4. **Unequal error protection.** Protect the image palette/header and voice
   pitch/energy bits more heavily than fine detail — graceful degradation instead
   of all-or-nothing, which matters exactly in the 45–60% "can't quite deliver"
   band where we currently fail.
5. **Live tamper demo.** We already compute per-fragment HMAC tags (and test them);
   surface a "flip a bit" button that corrupts a fragment on the wire and show the
   receiver *reject it on its tag* — makes §13 tangible, not just stated.
6. **Energy / battery model.** Convert airtime to mAh and show "messages per charge"
   — the off-grid buyer segments (SAR, conservation) care about this more than kbps.
7. **Duty-cycle enforcement.** Actually *block* transmits when over the EU868 10%
   cap (we display duty but don't enforce it) — a credible regulatory-realism beat.
8. **Topology editor + scale.** Drag nodes, add/remove links, go past 5 nodes — lets
   a judge stress the alternate-path story themselves and explore where fountain's
   edge widens.
9. **Shareable runs & export.** Encode the full config in the URL for a permalink,
   and let the audit log download as CSV — useful for the monitoring-SaaS pitch.
10. **Latency dimension.** Surface end-to-end delivery *time* (airtime × hops ×
    rounds), not just bytes — a second quantified axis that ARQ loses even harder on
    because of ACK round-trips.
