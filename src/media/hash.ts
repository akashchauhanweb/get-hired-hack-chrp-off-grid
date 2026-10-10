/*
  Hash verify (honesty axis). DELIVERED only flips true when SHA-256 of the
  reconstructed bytes equals the hash of the original. No green check without it.
*/
const subtle = globalThis.crypto.subtle

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const view = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  const digest = new Uint8Array(await subtle.digest('SHA-256', view))
  let hex = ''
  for (const b of digest) hex += b.toString(16).padStart(2, '0')
  return hex
}

export function shortHash(hex: string): string {
  return hex.slice(0, 8) + '…' + hex.slice(-4)
}
