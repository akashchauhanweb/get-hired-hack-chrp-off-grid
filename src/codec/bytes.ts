/* Byte-array helpers shared by the codecs and the fragmenter. */

/** XOR src into dst in place (dst ^= src), lengths must match. */
export function xorInto(dst: Uint8Array, src: Uint8Array): void {
  for (let i = 0; i < dst.length; i++) dst[i] ^= src[i]
}

/** Split data into K fixed-size blocks, zero-padding the final block. */
export function toBlocks(data: Uint8Array, blockSize: number): Uint8Array[] {
  const k = Math.max(1, Math.ceil(data.length / blockSize))
  const blocks: Uint8Array[] = []
  for (let i = 0; i < k; i++) {
    const b = new Uint8Array(blockSize)
    b.set(data.subarray(i * blockSize, Math.min((i + 1) * blockSize, data.length)))
    blocks.push(b)
  }
  return blocks
}

/** Reassemble blocks and trim to the original length. */
export function fromBlocks(blocks: Uint8Array[], originalLength: number): Uint8Array {
  const out = new Uint8Array(blocks.length * (blocks[0]?.length ?? 0))
  blocks.forEach((b, i) => out.set(b, i * b.length))
  return out.subarray(0, originalLength)
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** Encode a 32-bit unsigned int as 4 big-endian bytes. */
export function u32ToBytes(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff])
}
