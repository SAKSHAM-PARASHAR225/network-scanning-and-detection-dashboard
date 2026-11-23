import type { SecurityAlert } from '../../types'

interface SeverityBadgeProps {
  severity: SecurityAlert['severity']
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const tones = {
    CRITICAL: 'bg-red-500/10 text-red-300 border border-red-500/20',
    HIGH: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
    MEDIUM: 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20',
    LOW: 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
    INFO: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
  }

  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tones[severity]}`}>{severity}</span>
}
