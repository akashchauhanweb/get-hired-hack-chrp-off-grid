# Build Brief — LoRa Mesh Media Delivery Demo

**Project:** Get-Hired-Hack (hackathon build)
**Status:** Spec finalized, ready to build. Not yet started.
**Target surface for build:** Claude Code in VS Code, standalone new project.

---

## 1. What we're building (one paragraph)

A **live, self-contained web demo** that sends a **voice note** and an **image** across a **5-node simulated LoRa mesh with packet loss**, and proves — on screen, in real time — how much media gets through per byte, how well it recovers from loss, and how honest the delivery status is. It runs entirely in one browser page. No real radios, no hardware, no backend.

## 2. Why this shape (the core insight)

The judges score three things: **(1) media through per byte, (2) recovery from loss, (3) honesty of delivery status.** All three collapse into one honest tension: LoRa is a 0.3–22 kbps pipe with ~200-byte packets over lossy multi-hop links — you physically cannot send a normal photo or normal voice clip. The demo leans *into* that constraint instead of hiding it. The whole thing is a story about discipline and honesty under a brutal bandwidth budget.

Criterion → mechanism mapping:

| Judge criterion | What wins it | Our mechanism |
|---|---|---|
| Media through per byte | Maximize useful bytes delivered ÷ bytes put on air | Aggressive source compression (Codec2-rate voice, tiny image) + FEC overhead tuned to loss, not wasted |
| Recovers from loss | Reconstruct without flooding the air with retransmits | Fragmentation + **LT-style fountain (erasure) coding** — rebuild from *any* sufficient subset of fragments |
| Honest delivery status | Never show a status that isn't real | Per-fragment truthful state machine + final **hash verify** (reconstructed == original) + honest FAILED state under heavy loss |

The single strongest demo beat: a **baseline (naive retransmit) vs. ours (fountain FEC)** toggle under identical loss, with the three metrics quantifying the win.

## 3. Build type — important framing

- It is a **functional simulation, NOT a UI mockup.**
- The **media pipeline is real code on real bytes**: the image is genuinely compressed → fragmented → fountain-encoded → relayed → reassembled → hash-verified → **rendered**; the voice note genuinely plays back from reconstructed bytes.
- The **only simulated layer is the physical radio**: the links, per-link packet loss, hop-by-hop relaying, and airtime timing. That is the one part that would otherwise need real hardware, and simulating it is exactly what lets us *show* loss and recovery live.
- **NOT built on top of** the Meshtastic clients (`meshtastic/Meshtastic-Apple` or the web client). Those are real clients that talk to real radios over BLE/USB/Wi-Fi; demoing controllable packet loss + fountain recovery on them would need physical radios and firmware changes — out of scope and not reliably demoable live. This is a **standalone build from scratch.**

## 4. Locked decisions (all confirmed with the user)

- **Topology:** 5 nodes, **partial mesh** (multiple paths between source and destination so alternate-path relaying shines when links drop).
- **Hop limit:** **3** (Meshtastic default; max configurable in real life is 7). Shortest source→dest path should be ~2–3 hops with alternate routes. Note: 5 nodes gives at most 4 hops; we deliberately keep the realistic default of 3.
- **Recovery strategy:** **LT-style fountain code (hand-rolled, no heavy dependency)** as the hero, shown against a **naive retransmit (ARQ) baseline** via a toggle.
- **Voice:** **real low-bitrate bytes at a Codec2-equivalent bitrate** (~700 bps–3.2 kbps reference). Transmit the real bytes and play back the reconstruction. Labeled honestly as "Codec2-rate" — we are NOT running actual Codec2 (that was considered and rejected as too heavy for "clean and small"), and NOT doing a pure size-model (rejected as unconvincing).
- **Image:** real tiny image, target **~64×64, roughly 1–3 KB**, so it fragments into a watchable ~10–20 packets and genuinely renders at the destination.
- **Fragment size:** **~200 bytes** payload per packet (Meshtastic-realistic).

## 5. What the screen shows

- 5 nodes with links drawn between them (partial mesh).
- Packets animating **hop-by-hop**, with some visibly **dropping** per the link loss rate.
- **Per-link packet-loss sliders** the presenter can adjust live.
- Three **live metrics** (see §6).
- At the end: the **real reconstructed image appears** and the **voice note plays**.
- A **baseline-vs-ours toggle** (naive retransmit vs. fountain FEC).
- An **honest status ledger** — auditable per-fragment states.

## 6. The three live metrics (map 1:1 to judging)

1. **Goodput per byte** — useful media bytes delivered ÷ total bytes put on air. The denominator **honestly includes** packet headers + FEC overhead + any retransmissions. (Headline "per byte" number.)
2. **Loss recovery** — reconstructed at X% link loss; fragments lost vs. fragments recovered by FEC; retransmits needed (ideally 0 with fountain). (The "recovers from loss" number.)
3. **Status honesty** — overall media state that only flips to **DELIVERED** on genuine reconstruction, backed by a **hash/checksum verify** that reconstructed == original; shows partial % and a truthful **FAILED, N fragments short** when loss is too high. (The "honest status" number.)

## 7. Honesty mechanics (do not cut corners here — it's an explicit judging axis)

- Every fragment has a truthful state: `queued → in-flight → delivered / lost` (per hop).
- Overall media status flips to DELIVERED **only** when the receiver genuinely has enough fragments to decode — and we actually decode + render/play to prove it.
- Never a green check unless bytes truly reassembled and the hash matches.
- Include a deliberate **failure demo**: crank loss very high (~90%) and show the status **honestly fail** ("unrecoverable, need k more fragments") instead of lying.

## 8. Realism anchors (bake these in, they read as credibility)

- **200-byte fragments.**
- **Hop limit 3.**
- **Airtime computed from the chosen preset's real data rate.** Reference numbers from Meshtastic radio-settings docs (theoretical max, ignore headers/hops):
  - Short Turbo 21.88 kbps · Short Fast 10.94 kbps · Long Fast (default) 1.07 kbps · Long Moderate 0.34 kbps.
  - At Long Fast ≈1.07 kbps, one 200-byte fragment = 1600 bits ≈ **~1.5 s on air** — makes the budget visceral. Use a preset selector or at least pin to a stated preset.
- Optional nicety: EU 868 has a 10% duty-cycle cap; North America 915 is looser. Mention, don't necessarily simulate.
- Channels are AES128/256 encrypted in real Meshtastic — we **note** this, we do **not** simulate encryption.

## 9. Scope control

**In scope:** everything in §5–§8; exactly one image + one voice note; baseline-vs-ours toggle.
**Out of scope (to stay clean and small):** real radios; RF propagation physics; dynamic routing protocols (use fixed topology + flooding bounded by hop limit); encryption simulation; queued/multi-item media; the actual Meshtastic client codebases.

## 10. Build sequence

1. **Mesh sim core** — 5-node partial-mesh graph, hop-limit-3 relaying, per-link loss model, packet/airtime timing.
2. **Media fragment/reassemble** — real image + real Codec2-rate audio → ~200-byte fragments → reassemble real bytes.
3. **Fountain (LT) layer** — rateless encode/decode; recover from any sufficient subset.
4. **Honest status ledger** — per-fragment state machine + hash verify.
5. **Metrics panel** — the three live numbers.
6. **Visual polish** — node graph, packet animation, loss sliders, reconstructed image + audio playback.
7. **Baseline toggle** — naive retransmit path for side-by-side comparison.

## 11. Demo script (~90 seconds)

Send both media items → packets flow, some links drop → fountain recovers with no retransmit storm → destination renders the image + plays the voice → flip to baseline under identical loss, show it stall / retransmit → point at the three metrics → crank loss to ~90% and show the status **honestly fail** instead of lying.

## 12. Research anchors (for reference while building)

- Meshtastic radio presets & data rates: `meshtastic.org/docs/overview/radio-settings/` (preset table, hop limit, duty cycle, AES encryption).
- Meshtastic clients landscape: Apple app (`github.com/meshtastic/Meshtastic-Apple`), Android app, and browser-based **Meshtastic Web** (`client.meshtastic.org`) — all front-ends to the same radios; media limits are the radio's constraint, identical across them. (We build on none of these.)
- Hardware context: nRF52840 / ESP32 controllers + Semtech SX1262 radio; ~8 km open line-of-sight reference at 915 MHz. (Context only; not needed for the sim.)
- Codec2: open-source speech codec for very low bitrates (~0.7–3.2 kbps) — our stated reference rate for the voice note.