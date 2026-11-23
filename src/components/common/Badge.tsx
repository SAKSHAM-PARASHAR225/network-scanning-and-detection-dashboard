import type { ReactNode } from 'react'

export type BadgeTone = 'secure' | 'warning' | 'danger' | 'info' | 'neutral'

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  const tones = {
    secure: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
    danger: 'bg-red-500/10 text-red-300 border border-red-500/20',
    info: 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20',
    neutral: 'bg-slate-800 text-slate-200 border border-slate-700',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}
