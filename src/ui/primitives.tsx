/* Shared editorial UI primitives — the design vocabulary, reused everywhere. */
import type { ReactNode } from 'react'

export function Panel({
  children,
  className = '',
  shadow = false,
}: {
  children: ReactNode
  className?: string
  shadow?: boolean
}) {
  return <section className={`panel ${shadow ? 'hard-shadow' : ''} ${className}`}>{children}</section>
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="label">{children}</span>
      {right && <span className="label !text-ink-3">{right}</span>}
    </div>
  )
}

export function Stat({
  value,
  label,
  tone,
  small,
}: {
  value: ReactNode
  label: string
  tone?: 'accent' | 'ink'
  small?: boolean
}) {
  return (
    <div className="leading-none">
      <div
        className={`font-sans ${small ? 'text-[clamp(22px,2.4vw,30px)]' : 'text-[clamp(28px,3.2vw,44px)]'} font-700 tabular-nums tracking-tight`}
        style={{ color: tone === 'accent' ? 'var(--color-accent)' : 'var(--color-ink)' }}
      >
        {value}
      </div>
      <div className="label mt-1.5">{label}</div>
    </div>
  )
}

export function FragMeter({ total, done, lost = 0 }: { total: number; done: number; lost?: number }) {
  const n = Math.min(total, 40)
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: n }).map((_, i) => {
        const filled = i < done
        const isLost = !filled && i < done + lost
        return (
          <span
            key={i}
            className="h-4 flex-1"
            style={{
              background: filled ? 'var(--color-ink)' : 'transparent',
              border: filled
                ? 'none'
                : `1.5px solid ${isLost ? 'var(--color-accent)' : 'var(--color-ink)'}`,
            }}
          />
        )
      })}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'solid',
  disabled,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'solid' | 'outline' | 'danger'
  disabled?: boolean
  className?: string
}) {
  const base = 'px-4 py-2.5 text-[13px] font-600 transition-colors disabled:opacity-40'
  const styles =
    variant === 'solid'
      ? 'bg-ink text-paper'
      : variant === 'danger'
        ? 'border border-[color:var(--color-accent)] text-[color:var(--color-accent)]'
        : 'border border-line text-ink hover:bg-paper-2'
  return (
    <button className={`${base} ${styles} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="mono appearance-none border border-line bg-paper py-2 pl-3 pr-9 text-[12px] text-ink focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-2">▾</span>
    </div>
  )
}

export function Field({ label, accent, children }: { label: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label" style={accent ? { color: 'var(--color-accent)' } : undefined}>
        {label}
      </span>
      {children}
    </div>
  )
}

export function StatusDot({ tone }: { tone: 'ink' | 'good' | 'accent' }) {
  const bg = tone === 'accent' ? 'var(--color-accent)' : 'var(--color-ink)'
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: bg }} />
}
