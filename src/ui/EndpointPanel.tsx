/*
  A symmetric endpoint. Both A and E use this: each can SEND text / image / voice
  and VIEW what it received. It renders the shared conversation from this node's
  point of view (sent vs. received) and a composer. Sends go through the channel
  lock in the hook, so neither end transmits while a transfer is in flight.
*/
import { useEffect, useRef, useState } from 'react'
import { Button, FragMeter } from './primitives'
import { drawRgba, renderPayload, heroImage, imageFromFile, type ImageAsset } from '../media/image'
import { sampleVoice, recordVoice, playPayload, payloadWaveform, type VoiceAsset } from '../media/voice'
import { decodeText } from '../media/text'
import type { EndpointId, MessageView, SendDraft } from '../state/useSimulation'

export function EndpointPanel({
  node,
  mode,
  phase,
  busyMessage,
  messages,
  onSend,
}: {
  node: EndpointId
  mode: 'fountain' | 'arq'
  phase: 'idle' | 'running' | 'done'
  busyMessage: string | null
  messages: MessageView[]
  onSend: (d: SendDraft) => void
}) {
  const seq = node === 'A' ? '0x55' : '0x11'
  return (
    <section className="flex flex-col px-4 pb-4 pt-2">
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <div>
          <div className="label !text-ink-3">{node} · ENDPOINT</div>
          <div className="font-display text-[26px] font-600 leading-none text-ink">
            {mode === 'fountain' ? 'Fountain' : 'Naive ARQ'}
          </div>
        </div>
        <span className="mono text-[12px] text-ink-3">{seq}</span>
      </div>

      {busyMessage && (
        <div className="mt-3 border border-[color:var(--color-accent)] px-3 py-2">
          <span className="label !text-[color:var(--color-accent)]">{busyMessage}</span>
        </div>
      )}

      {/* conversation */}
      <div className="mt-3 flex-1 space-y-3.5 overflow-y-auto" style={{ maxHeight: 430, minHeight: 300 }}>
        {messages.length === 0 && (
          <div className="label !text-ink-3 py-6 text-center">no messages yet — compose below</div>
        )}
        {messages.map((m) => (
          <MessageItem key={m.id} view={m} node={node} />
        ))}
      </div>

      <Composer node={node} phase={phase} onSend={onSend} />
    </section>
  )
}

/* ------------------------------------------------------------------ one message */

function MessageItem({ view, node }: { view: MessageView; node: EndpointId }) {
  const sent = view.from === node
  const label = sent ? 'SENT' : 'RECEIVED'
  const typeName = view.type === 'text' ? 'Text' : view.type === 'image' ? 'Image' : 'Voice note'

  const statusText = view.sending
    ? sent
      ? 'Sending…'
      : 'Receiving…'
    : view.delivered
      ? sent
        ? 'Delivered'
        : 'Received'
      : view.complete
        ? 'Failed'
        : '—'
  const tone = view.complete && !view.delivered ? 'accent' : 'ink'

  return (
    <div className="border-l-2 pl-3" style={{ borderColor: sent ? 'var(--color-ink)' : 'var(--color-line-soft)' }}>
      <div className="flex items-baseline justify-between">
        <span className="flex items-baseline gap-2">
          <span className="font-display text-[15px] font-600 text-ink">{typeName}</span>
          <span className="label !text-[8px] !text-ink-3">{label}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone === 'accent' ? 'var(--color-accent)' : 'var(--color-ink)' }} />
          <span className="text-[12px] font-600" style={{ color: tone === 'accent' ? 'var(--color-accent)' : 'var(--color-ink)' }}>
            {statusText}
          </span>
          {view.k > 0 && <span className="mono text-[11px] text-ink-2">{view.blocksGot}/{view.k}</span>}
        </span>
      </div>

      {view.k > 1 && (
        <div className="mt-1.5">
          <FragMeter total={view.k} done={view.blocksGot} />
        </div>
      )}

      <div className="mt-2">
        {view.type === 'text' && <TextBody view={view} sent={sent} />}
        {view.type === 'image' && <ImageBody view={view} sent={sent} />}
        {view.type === 'voice' && <VoiceBody view={view} sent={sent} />}
      </div>
    </div>
  )
}

function TextBody({ view, sent }: { view: MessageView; sent: boolean }) {
  const text = sent ? view.text ?? '' : view.delivered && view.reconstructed ? decodeText(view.reconstructed) : null
  return (
    <div className="border border-line bg-paper-2 px-3 py-2 text-[14px] text-ink" style={{ fontFamily: 'var(--font-display)' }}>
      {text ?? <span className="label !text-ink-3">{view.complete ? 'lost in transit' : 'receiving…'}</span>}
    </div>
  )
}

function ImageBody({ view, sent }: { view: MessageView; sent: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvasRef.current) return
    if (sent && view.originalRgba) drawRgba(view.originalRgba, canvasRef.current)
    else if (!sent && view.reconstructed) renderPayload(view.reconstructed, canvasRef.current)
  }, [sent, view.originalRgba, view.reconstructed])

  const show = sent ? !!view.originalRgba : view.delivered
  return (
    <div>
      {show ? (
        <canvas ref={canvasRef} width={256} height={256} className="w-full border border-line" style={{ imageRendering: 'pixelated', aspectRatio: '1 / 1' }} />
      ) : (
        <div className="hatch flex items-end border border-line" style={{ aspectRatio: '1 / 1' }}>
          <span className="mono bg-paper/85 px-2 py-1 text-[11px] text-ink-2">{view.complete ? 'could not rebuild' : 'awaiting fragments'}</span>
        </div>
      )}
      <div className="mono mt-1.5 truncate text-[10px] text-ink-3">{view.label}</div>
      {view.text && <div className="mt-0.5 text-[12px] text-ink-2">{view.text}</div>}
    </div>
  )
}

function VoiceBody({ view, sent }: { view: MessageView; sent: boolean }) {
  const playable = !sent && view.delivered && !!view.reconstructed
  const wave = !sent && view.delivered && view.reconstructed ? payloadWaveform(view.reconstructed, 32) : view.waveform ?? []
  return (
    <div className="flex items-center gap-3 border border-line px-3 py-2.5">
      <button
        className="grid h-7 w-7 place-items-center bg-ink text-paper disabled:opacity-30"
        disabled={!playable}
        onClick={() => view.reconstructed && playPayload(view.reconstructed)}
        aria-label="play voice note"
      >
        <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><path d="M0 0l10 6-10 6z" /></svg>
      </button>
      <div className="leading-tight">
        <div className="text-[12px] font-600 text-ink">{sent ? 'Voice note sent' : view.delivered ? 'Voice note received' : view.complete ? 'could not rebuild' : 'receiving…'}</div>
        <div className="label !text-[9px]">{playable ? 'press play to listen' : sent ? 'on its way' : ''}</div>
      </div>
      <span className="ml-auto flex h-7 items-end gap-[2px]" aria-hidden>
        {(wave.length ? wave : Array.from({ length: 24 }, () => 0.1)).map((h, i) => (
          <span key={i} className="w-[2px]" style={{ height: Math.max(3, h * 22), background: sent || view.delivered ? 'var(--color-ink)' : 'var(--color-line-soft)' }} />
        ))}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ composer */

function Composer({ node, phase, onSend }: { node: EndpointId; phase: 'idle' | 'running' | 'done'; onSend: (d: SendDraft) => void }) {
  const [text, setText] = useState('')
  const [caption, setCaption] = useState('')
  const [img, setImg] = useState<ImageAsset | null>(null)
  const [voice, setVoice] = useState<VoiceAsset | null>(null)
  const [recording, setRecording] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let ok = true
    ;(async () => {
      const [i, v] = await Promise.all([heroImage(), sampleVoice(2)])
      if (ok) {
        setImg(i)
        setVoice(v)
      }
    })()
    return () => {
      ok = false
    }
  }, [])

  const sendText = () => {
    if (!text.trim()) return
    onSend({ from: node, type: 'text', label: text.trim(), text: text.trim(), payload: new TextEncoder().encode(text.trim()) })
    setText('')
  }
  const sendImage = () => {
    if (!img) return
    onSend({ from: node, type: 'image', label: img.input.label, text: caption.trim() || undefined, payload: img.input.payload, originalRgba: img.originalRgba })
    setCaption('')
  }
  const sendVoice = () => {
    if (!voice) return
    onSend({ from: node, type: 'voice', label: 'voice-note', payload: voice.input.payload, waveform: voice.waveform })
  }
  const record = async () => {
    setRecording(true)
    try {
      setVoice(await recordVoice(3))
    } catch {
      setVoice(await sampleVoice(2))
    }
    setRecording(false)
  }

  return (
    <div className="mt-3 space-y-2.5 border-t border-line pt-3">
      <div className="flex gap-2.5">
        <input
          className="flex-1 border border-line bg-paper px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
          placeholder="Message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendText()}
        />
        <Button onClick={sendText}>Send</Button>
      </div>

      <input
        className="w-full border border-line bg-paper px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
        placeholder="Caption (optional, sent with image)…"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && imageFromFile(e.target.files[0]).then(setImg)} />
      <button className="flex w-full items-center gap-3 border border-line px-3 py-2.5 text-left text-[13px]" onClick={() => fileRef.current?.click()}>
        <span className="label !text-ink">CHOOSE FILE</span>
        <span className="mono truncate text-ink-3">{img?.input.label ?? 'hero'}</span>
      </button>

      <div className="flex flex-wrap gap-2.5">
        <Button onClick={sendImage} className="min-w-[96px] flex-1">{phase === 'running' ? '…' : 'Send image'}</Button>
        <button className="flex min-w-[96px] flex-1 items-center justify-center gap-1.5 border border-line py-2.5 text-[12px] font-600 text-ink" onClick={record} disabled={recording}>
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-accent)' }} />
          {recording ? 'Rec…' : 'Record'}
        </button>
        <Button variant="outline" onClick={sendVoice} className="min-w-[96px] flex-1">Send voice</Button>
      </div>
    </div>
  )
}
