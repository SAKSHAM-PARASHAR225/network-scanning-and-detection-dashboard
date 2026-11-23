import type { ReactNode } from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  trend: string
  icon: ReactNode
  tone?: 'cyan' | 'green' | 'yellow' | 'red' | 'blue'
  tooltip?: string
}

export function StatCard({ label, value, trend, icon, tone = 'cyan', tooltip }: StatCardProps) {
  const tones = {
    cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    yellow: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    red: 'bg-red-500/10 text-red-300 border-red-500/20',
    blue: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  }

  return (
    <div title={tooltip} className="glass-card rounded-2xl p-4 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <p className="mt-4 text-3xl font-semibold text-slate-100">{value}</p>
        </div>
        <div className={`rounded-xl border p-2 ${tones[tone]}`}>{icon}</div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
        {trend.startsWith('+') ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" /> : <ArrowDownRight className="h-3.5 w-3.5 text-amber-400" />}
        <span>{trend}</span>
      </div>
    </div>
  )
}
