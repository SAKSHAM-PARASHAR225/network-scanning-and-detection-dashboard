import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HelpCircle, Keyboard, LogOut, Settings, User } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export function ProfileMenu() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    setOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
        className="flex items-center gap-3 rounded-xl border border-sg-border bg-[#0a121f] px-3 py-2 transition hover:border-cyan-400/30"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-purple-400 text-xs font-bold text-slate-950">S</div>
        <div className="hidden text-left sm:block">
          <div className="text-sm font-medium text-slate-100">Saksham</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Administrator</div>
        </div>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-sg-border bg-[#0a121f] p-2 shadow-soft">
          <div className="border-b border-white/5 px-3 py-2.5">
            <div className="text-sm font-medium text-slate-100">Saksham</div>
            <div className="text-xs text-slate-500">Administrator</div>
            <div className="mt-0.5 text-xs text-slate-500">admin@scanguard.local</div>
          </div>
          <div className="py-1.5">
            <MenuItem icon={User} label="Profile" />
            <MenuItem icon={Settings} label="Preferences" onClick={() => { setOpen(false); navigate('/settings') }} />
            <MenuItem icon={Keyboard} label="Keyboard Shortcuts" />
            <MenuItem icon={HelpCircle} label="Help &amp; Documentation" />
          </div>
          <div className="border-t border-white/5 pt-1.5">
            <MenuItem icon={LogOut} label="Logout" tone="danger" onClick={handleLogout} />
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, tone = 'default' }: { icon: typeof User; label: string; onClick?: () => void; tone?: 'default' | 'danger' }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5 ${tone === 'danger' ? 'text-red-300' : 'text-slate-200'}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  )
}
