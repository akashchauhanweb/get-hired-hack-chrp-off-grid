import { Button, Field, Select } from './primitives'
import { PRESETS, type PresetId } from '../sim/presets'
import type { NodeId } from '../sim/topology'
import type { RecoveryMode } from '../engine/simulation'

const RELAYS: NodeId[] = ['B', 'C', 'D']

export function ControlBar({
  mode,
  setMode,
  preset,
  setPreset,
  speed,
  setSpeed,
  dead,
  toggleDead,
  onReset,
}: {
  mode: RecoveryMode
  setMode: (m: RecoveryMode) => void
  preset: PresetId
  setPreset: (p: PresetId) => void
  speed: number
  setSpeed: (s: number) => void
  dead: Set<NodeId>
  toggleDead: (n: NodeId) => void
  onReset: () => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-4 border border-line px-5 py-4">
      <Field label="PRESET">
        <Select
          value={preset}
          onChange={setPreset}
          options={(Object.keys(PRESETS) as PresetId[]).map((p) => ({
            value: p,
            label: `${PRESETS[p].label} · ${PRESETS[p].bitrateKbps} kbps`,
          }))}
        />
      </Field>

      <Field label="SPEED">
        <Select
          value={String(speed)}
          onChange={(v) => setSpeed(Number(v))}
          options={['1', '5', '10', '25'].map((s) => ({ value: s, label: `${s}×` }))}
        />
      </Field>

      <Field label="RECOVERY MODE">
        <div className="flex border border-line">
          {(['fountain', 'arq'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-4 py-2 text-[12px] font-700"
              style={{
                background: mode === m ? 'var(--color-ink)' : 'transparent',
                color: mode === m ? 'var(--color-paper)' : 'var(--color-ink-2)',
              }}
            >
              {m === 'fountain' ? 'FOUNTAIN' : 'NAIVE ARQ'}
            </button>
          ))}
        </div>
        <span className="mono block max-w-[202px] text-[10px] leading-snug text-ink-3">
          {mode === 'fountain'
            ? 'rateless FEC · rebuild from any subset · no ACKs, 0 retransmits'
            : 'stop-and-wait · ACKs cross the lossy mesh · dropped ACK → retransmit storm'}
        </span>
      </Field>

      <Field label="KILL RELAY">
        <div className="flex gap-2">
          {RELAYS.map((n) => {
            const down = dead.has(n)
            return (
              <button
                key={n}
                onClick={() => toggleDead(n)}
                className="border px-3 py-2 text-[12px] font-700"
                style={{
                  borderColor: down ? 'var(--color-ink)' : 'var(--color-accent)',
                  color: down ? 'var(--color-ink)' : 'var(--color-accent)',
                  background: down ? 'var(--color-paper-2)' : 'transparent',
                }}
              >
                {down ? `Revive ${n}` : `Kill ${n}`}
              </button>
            )
          })}
        </div>
      </Field>

      <div className="ml-auto">
        <Field label="SESSION">
          <Button variant="outline" onClick={onReset}>
            Reset
          </Button>
        </Field>
      </div>
    </div>
  )
}
