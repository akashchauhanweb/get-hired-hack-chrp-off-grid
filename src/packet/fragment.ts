/*
  Packet framing — real ~200-byte Meshtastic-sized fragments on real bytes.
  A packet carries one fountain symbol over ciphertext, plus the header the
  receiver needs to decode, plus a per-fragment auth tag (§13). Serialized to an
  actual Uint8Array and parsed back on the receiving side.

  Layout (200 bytes):
    [0]      type        1 = image, 2 = voice
    [1]      mediaId
    [2..5]   seed         u32  (derives the symbol's fountain neighbour set)
    [6..7]   k            u16  (source-block count)
    [8..11]  cipherLen    u32  (ciphertext length, to trim padding after decode)
    [12..13] symbolSize   u16
    [14..17] authTag      truncated HMAC-SHA-256 over (seed ‖ symbol)
    [18..]   symbol       symbolSize bytes of fountain-coded ciphertext
*/

export const PACKET_BYTES = 200
export const HEADER_BYTES = 18
export const SYMBOL_BYTES = PACKET_BYTES - HEADER_BYTES // 182

export type MediaType = 1 | 2 // image | voice

export interface Packet {
  type: MediaType
  mediaId: number
  seed: number
  k: number
  cipherLen: number
  symbolSize: number
  tag: Uint8Array // 4 bytes
  symbol: Uint8Array // symbolSize bytes
}

export function serialize(p: Packet): Uint8Array {
  const out = new Uint8Array(PACKET_BYTES)
  const dv = new DataView(out.buffer)
  out[0] = p.type
  out[1] = p.mediaId & 0xff
  dv.setUint32(2, p.seed >>> 0)
  dv.setUint16(6, p.k)
  dv.setUint32(8, p.cipherLen)
  dv.setUint16(12, p.symbolSize)
  out.set(p.tag.subarray(0, 4), 14)
  out.set(p.symbol.subarray(0, SYMBOL_BYTES), HEADER_BYTES)
  return out
}

export function deserialize(bytes: Uint8Array): Packet {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const symbolSize = dv.getUint16(12)
  return {
    type: bytes[0] as MediaType,
    mediaId: bytes[1],
    seed: dv.getUint32(2),
    k: dv.getUint16(6),
    cipherLen: dv.getUint32(8),
    symbolSize,
    tag: bytes.subarray(14, 18).slice(),
    symbol: bytes.subarray(HEADER_BYTES, HEADER_BYTES + symbolSize).slice(),
  }
}
