import { Activity, BarChart3, BellRing, Radar, ScanSearch, Settings, Shield, TrendingUp, Wifi, X } from 'lucide-react'
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

interface MobileNavDrawerProps {
  open: boolean
  onClose: () => void
}

// Small phones/tablets get a slide-in drawer instead of the persistent
// sidebar — the desktop Sidebar component and its collapse behavior are
// untouched, this is a separate, simpler nav surface shown only below `lg`.
export function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
  return (
    <div className={`fixed inset-0 z-40 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        className={`absolute inset-y-0 left-0 flex w-64 flex-col border-r border-sg-border bg-[#050b14] px-3 py-4 shadow-soft transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="mb-6 flex items-center justify-between gap-2 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <Shield className="h-5 w-5" />
            </div>
            <div className="bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-lg font-bold tracking-tight text-transparent">ScanGuard</div>
          </div>
          <button aria-label="Close menu" onClick={onClose} className="rounded-lg border border-white/8 bg-white/3 p-1.5 text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-1.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${isActive ? 'border border-cyan-400/30 bg-cyan-400/10 text-white' : 'border border-transparent text-slate-300 hover:bg-white/3'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </div>
  )
}
