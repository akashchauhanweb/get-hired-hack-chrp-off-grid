/* Text messages are real bytes too — UTF-8 through the same encrypt → fragment →
   fountain → verify pipeline. Tiny payloads (usually 1 block), but fully honest. */
import { sha256Hex } from './hash'
import type { MediaInput } from '../engine/simulation'

const te = new TextEncoder()
const td = new TextDecoder()

export async function textInput(text: string): Promise<MediaInput> {
  const payload = te.encode(text)
  return {
    id: 'text',
    label: text.length > 28 ? text.slice(0, 27) + '…' : text,
    payload,
    originalHash: await sha256Hex(payload),
  }
}

export function decodeText(payload: Uint8Array): string {
  return td.decode(payload)
}
