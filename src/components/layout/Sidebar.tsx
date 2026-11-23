import { Activity, BarChart3, BellRing, ChevronLeft, ChevronRight, Radar, ScanSearch, Settings, Shield, TrendingUp, Wifi } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Overview', icon: Activity },
  { to: '/networks', label: 'Networks', icon: Wifi },
  { to: '/radar', label: 'Live Radar', icon: Radar },
  { to: '/signals', label: 'Signal Trends', icon: TrendingUp },
  { to: '/alerts', label: 'Security Alerts', icon: BellRing },
  { to: '/history', label: 'Scan History', icon: ScanSearch },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside className="z-30 flex h-screen shrink-0 flex-col border-r border-sg-border bg-[#050b14]/95 px-3 py-4 backdrop-blur-xl">
      <div className="mb-8 flex items-center justify-between gap-2 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-glow">
            <Shield className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-lg font-bold tracking-tight text-transparent">ScanGuard</div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Security Platform</div>
            </div>
          )}
        </div>
        <button aria-label="Collapse sidebar" onClick={onToggle} className="rounded-lg border border-white/8 bg-white/3 p-1.5 text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-200">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="space-y-1.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${isActive ? 'border border-cyan-400/30 bg-cyan-400/10 text-white shadow-glow' : 'border border-transparent text-slate-300 hover:bg-white/3 hover:text-slate-100'} ${collapsed ? 'justify-center px-2' : ''}`}
          >
            <Icon className="h-4 w-4 text-slate-400 group-hover:text-slate-200" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={`mt-auto flex items-center gap-3 rounded-2xl border border-sg-border bg-[#0a121f] p-3 ${collapsed ? 'justify-center' : ''}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-purple-400 text-sm font-bold text-slate-950">
          S
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-slate-100">Saksham</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Administrator</div>
          </div>
        )}
      </div>
    </aside>
  )
}
