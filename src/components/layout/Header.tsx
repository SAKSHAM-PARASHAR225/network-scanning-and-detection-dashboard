import { useNavigate } from 'react-router-dom'
import { Bell, Menu, RefreshCw } from 'lucide-react'
import { useWirelessMonitoring } from '../../hooks/useWirelessMonitoring'
import { useClock } from '../../hooks/useClock'
import { ScannerStatus } from '../ScannerStatus'
import { GlobalSearch } from './GlobalSearch'
import { ProfileMenu } from './ProfileMenu'

interface HeaderProps {
  title: string
  subtitle: string
  onOpenMobileNav: () => void
}

export function Header({ title, subtitle, onOpenMobileNav }: HeaderProps) {
  const { alerts, refresh } = useWirelessMonitoring()
  const navigate = useNavigate()
  const now = useClock()
  const alertCount = alerts.filter((alert) => alert.status === 'OPEN').length

  const dateLabel = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-4 border-b border-sg-border bg-[#020712]/85 px-5 backdrop-blur-xl sm:px-6">
      <button
        aria-label="Open navigation menu"
        onClick={onOpenMobileNav}
        className="shrink-0 rounded-xl border border-sg-border bg-[#0a121f] p-2.5 text-slate-200 lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="min-w-0 shrink-0">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.26em] text-slate-500">
          <span>ScanGuard</span>
          <span className="text-slate-600">/</span>
          <span className="text-cyan-300">{title}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100 sm:text-[28px]">{title}</h1>
        <p className="mt-1 hidden text-xs text-slate-400 sm:block sm:text-sm">{subtitle}</p>
      </div>

      <div className="hidden flex-1 justify-center lg:flex">
        <GlobalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
        <div className="hidden flex-col items-end text-right text-[11px] text-slate-500 xl:flex">
          <span className="font-mono">{timeLabel}</span>
          <span className="uppercase tracking-[0.14em]">{dateLabel}</span>
        </div>

        <ScannerStatus variant="pill" showCountdown className="hidden md:inline-flex" />

        <button aria-label="Refresh dashboard" onClick={() => void refresh()} className="rounded-xl border border-sg-border bg-[#0a121f] p-2.5 text-slate-200 transition hover:border-cyan-400/30 hover:text-cyan-200">
          <RefreshCw className="h-4 w-4" />
        </button>

        <button aria-label={`Security alerts${alertCount > 0 ? `, ${alertCount} open` : ''}`} onClick={() => navigate('/alerts')} className="relative rounded-xl border border-sg-border bg-[#0a121f] p-2.5 text-slate-200 transition hover:border-cyan-400/30 hover:text-cyan-200">
          <Bell className="h-4 w-4" />
          {alertCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {alertCount}
            </span>
          )}
        </button>

        <ProfileMenu />
      </div>
    </header>
  )
}
