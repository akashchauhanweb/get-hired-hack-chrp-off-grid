/*
  Security & trust model (§13) — real WebCrypto, not simulated.

  - Encrypt-BEFORE-fragment: the whole media payload is sealed with AES-256-GCM
    once, then the CIPHERTEXT is fragmented + fountain-coded. Relays therefore
    only ever forward ciphertext — they never see the content. (Threat model:
    relays are untrusted, mirroring Meshtastic's AES channel PSK.)
  - Per-fragment auth tag: every fragment carries a truncated HMAC-SHA-256 over
    (seed ‖ ciphertext-chunk), so a tampered or corrupt fragment is detected and
    dropped at the receiver before it can poison the decoder.
  - The AES-GCM tag authenticates the reassembled plaintext end-to-end: if the
    reconstruction is wrong, decryption fails — we cannot show a false DELIVERED.

  Honest caveat surfaced in the UI: the PSK is a demo constant in the page; real
  deployments provision per-channel keys out of band.
*/

const te = new TextEncoder()
const subtle = globalThis.crypto.subtle

export interface Keys {
  aes: CryptoKey
  mac: CryptoKey
  pskLabel: string
}

async function sha256Raw(data: Uint8Array): Promise<Uint8Array> {
  const view = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  return new Uint8Array(await subtle.digest('SHA-256', view))
}

/** Derive an AES-256 key and an HMAC key from a demo pre-shared key. */
export async function deriveKeys(psk: string): Promise<Keys> {
  const aesRaw = await sha256Raw(te.encode('farcast:aes:' + psk))
  const macRaw = await sha256Raw(te.encode('farcast:mac:' + psk))
  const aes = await subtle.importKey('raw', aesRaw as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  const mac = await subtle.importKey('raw', macRaw as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  return { aes, mac, pskLabel: psk }
}

export interface Sealed {
  iv: Uint8Array
  ciphertext: Uint8Array // includes the GCM auth tag
}

export async function encrypt(keys: Keys, plaintext: Uint8Array): Promise<Sealed> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const buf = await subtle.encrypt({ name: 'AES-GCM', iv }, keys.aes, plaintext as BufferSource)
  return { iv, ciphertext: new Uint8Array(buf) }
}

/** Returns plaintext, or null if authentication fails (honest failure). */
export async function decrypt(keys: Keys, sealed: Sealed): Promise<Uint8Array | null> {
  try {
    const buf = await subtle.decrypt(
      { name: 'AES-GCM', iv: sealed.iv as BufferSource },
      keys.aes,
      sealed.ciphertext as BufferSource,
    )
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

/** 4-byte truncated per-fragment auth tag over (seed ‖ data). */
export async function fragTag(keys: Keys, seed: number, data: Uint8Array): Promise<Uint8Array> {
  const msg = new Uint8Array(4 + data.length)
  msg[0] = (seed >>> 24) & 0xff
  msg[1] = (seed >>> 16) & 0xff
  msg[2] = (seed >>> 8) & 0xff
  msg[3] = seed & 0xff
  msg.set(data, 4)
  const sig = new Uint8Array(await subtle.sign('HMAC', keys.mac, msg as BufferSource))
  return sig.subarray(0, 4)
}

export function tagsMatch(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
