/*
  End-to-end BYTE pipeline test (no radio): proves the media pipeline is real.
  plaintext → AES-GCM encrypt → fountain over ciphertext → serialize packets →
  drop a random 40% → deserialize → verify per-fragment tags → decode → decrypt
  → SHA-256 must equal the original. This is the "functional, not mockup" claim.
*/
import { describe, it, expect } from 'vitest'
import { deriveKeys, encrypt, decrypt, fragTag, tagsMatch, type Sealed } from '../../crypto/encrypt'
import { makeEncoder, decode } from '../../codec/fountain'
import { serialize, deserialize, SYMBOL_BYTES, type Packet } from '../fragment'
import { sha256Hex } from '../../media/hash'
import { bytesEqual } from '../../codec/bytes'
import { mulberry32 } from '../../sim/rng'

function randomData(len: number, seed: number): Uint8Array {
  const rng = mulberry32(seed)
  const d = new Uint8Array(len)
  for (let i = 0; i < len; i++) d[i] = Math.floor(rng() * 256)
  return d
}

describe('full media byte pipeline', () => {
  it('reconstructs the exact original through encrypt→fountain→packets→loss→decode→decrypt', async () => {
    const original = randomData(2400, 2026)
    const originalHash = await sha256Hex(original)

    const keys = await deriveKeys('demo-channel-psk')
    const sealed: Sealed = await encrypt(keys, original)

    // fountain over the CIPHERTEXT (encrypt-before-fragment)
    const enc = makeEncoder(sealed.ciphertext, SYMBOL_BYTES)

    // build a generous rateless stream of real packets with per-fragment auth tags
    const packets: Uint8Array[] = []
    for (let i = 0; i < enc.k * 6; i++) {
      const sym = enc.symbol(7000 + i)
      const tag = await fragTag(keys, sym.seed, sym.data)
      const p: Packet = {
        type: 1,
        mediaId: 1,
        seed: sym.seed,
        k: enc.k,
        cipherLen: sealed.ciphertext.length,
        symbolSize: SYMBOL_BYTES,
        tag,
        symbol: sym.data,
      }
      packets.push(serialize(p))
    }

    // simulate loss: drop ~40% of packets at random
    const rng = mulberry32(555)
    const arrived = packets.filter(() => rng() > 0.4)

    // receiver: parse + verify tags, keep only authentic fragments
    const good = []
    for (const raw of arrived) {
      const p = deserialize(raw)
      const tag = await fragTag(keys, p.seed, p.symbol)
      if (tagsMatch(tag, p.tag)) good.push({ seed: p.seed, data: p.symbol })
    }

    const res = decode(good, enc.k, SYMBOL_BYTES, sealed.ciphertext.length)
    expect(res.recovered).not.toBeNull()

    // decrypt reconstructed ciphertext
    const plain = await decrypt(keys, { iv: sealed.iv, ciphertext: res.recovered! })
    expect(plain).not.toBeNull()
    expect(bytesEqual(plain!, original)).toBe(true)
    expect(await sha256Hex(plain!)).toBe(originalHash)
  })

  it('drops a tampered fragment on its auth tag', async () => {
    const keys = await deriveKeys('psk')
    const data = randomData(400, 1)
    const sealed = await encrypt(keys, data)
    const enc = makeEncoder(sealed.ciphertext, SYMBOL_BYTES)
    const sym = enc.symbol(1)
    const tag = await fragTag(keys, sym.seed, sym.data)
    // flip a byte in the symbol
    const tampered = sym.data.slice()
    tampered[0] ^= 0xff
    const recomputed = await fragTag(keys, sym.seed, tampered)
    expect(tagsMatch(recomputed, tag)).toBe(false)
  })
})
