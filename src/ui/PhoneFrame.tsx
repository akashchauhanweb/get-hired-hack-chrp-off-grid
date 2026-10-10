/*
  PhoneFrame — wraps an endpoint's screen in a handset device (ink bezel, notch,
  status bar). Two of these = the two phones talking across the mesh. Width is
  capped and percentage-based so the whole device always stays inside its cell.
*/
import type { ReactNode } from 'react'

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div
        className="relative rounded-[34px] bg-ink p-[9px]"
        style={{ boxShadow: '7px 7px 0 rgba(20,20,19,0.10)' }}
      >
        {/* notch */}
        <div className="absolute left-1/2 top-[9px] z-10 h-[20px] w-[104px] -translate-x-1/2 rounded-b-[13px] bg-ink" />
        {/* side buttons */}
        <div className="absolute -left-[2px] top-[96px] h-9 w-[2px] rounded-l bg-ink" />
        <div className="absolute -left-[2px] top-[146px] h-9 w-[2px] rounded-l bg-ink" />
        <div className="absolute -right-[2px] top-[120px] h-14 w-[2px] rounded-r bg-ink" />
        {/* screen */}
        <div className="relative overflow-hidden rounded-[26px] bg-paper">
          <StatusBar />
          {children}
        </div>
      </div>
    </div>
  )
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-5 pb-1 pt-2.5">
      <span className="mono text-[11px] font-500 text-ink">9:41</span>
      <span className="flex items-center gap-1.5 text-ink" aria-hidden>
        {/* signal */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 4.5} y={8 - i * 2.4} width="3" height={3 + i * 2.4} rx="0.6" opacity={i === 3 ? 0.35 : 1} />
          ))}
        </svg>
        {/* wifi */}
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M1.2 3.4a9 9 0 0 1 12.6 0" />
          <path d="M3.6 5.9a5.6 5.6 0 0 1 7.8 0" />
          <circle cx="7.5" cy="8.8" r="1" fill="currentColor" stroke="none" />
        </svg>
        {/* battery */}
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <rect x="0.6" y="1.2" width="20" height="9.6" rx="2.4" stroke="currentColor" strokeWidth="1" />
          <rect x="2.2" y="2.8" width="13" height="6.4" rx="1.2" fill="currentColor" />
          <rect x="21.6" y="4" width="1.8" height="4" rx="0.9" fill="currentColor" />
        </svg>
      </span>
    </div>
  )
}
