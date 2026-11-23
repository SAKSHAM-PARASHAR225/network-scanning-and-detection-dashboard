import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Lock, Radar, Shield, ShieldCheck, Wifi } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { API_BASE_URL } from '../services/networkApi'

type HealthState = 'checking' | 'online' | 'offline'

interface HealthSnapshot {
  state: HealthState
  database: string | null
  scannerStatus: string | null
}

const HEALTH_POLL_MS = 5000

// Real, unauthenticated read of the backend's health endpoint — shown on the
// login screen so "System Status" reflects the actual backend/database/
// scanner state instead of decorative placeholder text. No session is
// required for this endpoint, so it works before the access gate is passed.
function useBackendHealth(): HealthSnapshot {
  const [snapshot, setSnapshot] = useState<HealthSnapshot>({ state: 'checking', database: null, scannerStatus: null })

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/health`)
        const body = await response.json()
        if (cancelled) return
        setSnapshot({
          state: response.ok ? 'online' : 'offline',
          database: body.database ?? null,
          scannerStatus: body.scannerStatus ?? null,
        })
      } catch {
        if (!cancelled) setSnapshot({ state: 'offline', database: null, scannerStatus: null })
      }
    }

    check()
    const interval = setInterval(check, HEALTH_POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return snapshot
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const health = useBackendHealth()

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    // A short, deliberate pause before validating — this is a UI pace beat
    // for the login moment, not a network call or fake scan.
    setTimeout(() => {
      if (login(password)) {
        navigate('/authenticating', { replace: true, state: { remember } })
      } else {
        setError('Incorrect access password')
        setSubmitting(false)
      }
    }, 350)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020712] text-slate-100">
      <div className="relative z-10 flex min-h-screen flex-col lg:grid lg:grid-cols-2">
        <BrandPanel health={health} />

        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center text-center lg:hidden">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 shadow-glow">
                <Shield className="h-7 w-7 text-cyan-300" />
              </div>
              <h1 className="bg-gradient-to-r from-cyan-300 via-sky-200 to-purple-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                ScanGuard
              </h1>
              <p className="mt-1 text-[10px] uppercase tracking-[0.35em] text-slate-500">Secure &bull; Monitor &bull; Protect</p>
            </div>

            <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-slate-100">Welcome back</h2>
              <p className="mt-1.5 text-sm text-slate-400">Sign in to continue to your security console.</p>

              <label htmlFor="access-password" className="mb-2 mt-6 block text-sm font-medium text-slate-200">
                Access Password
              </label>
              <div className={`flex items-center gap-2 rounded-xl border bg-[#050b14] px-3 py-2.5 transition ${error ? 'border-red-500/50' : 'border-white/10 focus-within:border-cyan-400/50'}`}>
                <Lock className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  id="access-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setError(null) }}
                  placeholder="••••••••••"
                  autoFocus
                  className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((value) => !value)}
                  className="shrink-0 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

              <label className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-[#050b14] accent-cyan-400"
                />
                Remember me on this device
              </label>

              <button
                type="submit"
                disabled={!password || submitting}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 py-2.5 text-sm font-semibold text-slate-950 shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Verifying...' : 'Access System'}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-8 text-center text-xs italic text-slate-600 lg:hidden">"Because every connection matters."</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function BrandPanel({ health }: { health: HealthSnapshot }) {
  return (
    <div className="relative hidden overflow-hidden border-r border-sg-border bg-[#03060f] lg:flex lg:flex-col lg:justify-between lg:p-10">
      <NetworkGlobe />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 shadow-glow">
            <Shield className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-cyan-300 via-sky-200 to-purple-300 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              ScanGuard
            </h1>
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Secure &bull; Monitor &bull; Protect</p>
          </div>
        </div>
        <p className="max-w-[10rem] text-right text-[11px] uppercase leading-relaxed tracking-[0.2em] text-slate-500">
          Cybersecurity for a safer tomorrow.
        </p>
      </div>

      <div className="relative z-10 space-y-5">
        <SystemStatusCard health={health} />
        <p className="text-center text-xs italic text-slate-600">"Because every connection matters."</p>
      </div>
    </div>
  )
}

function SystemStatusCard({ health }: { health: HealthSnapshot }) {
  const backendOnline = health.state === 'online'
  const dbConnected = health.database === 'connected'
  const scannerLabel = health.state === 'checking'
    ? 'Checking...'
    : backendOnline
      ? (health.scannerStatus ?? 'Unknown')
      : 'Unreachable'

  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">System Status</p>
      <div className="space-y-2.5 text-sm">
        <StatusRow
          icon={Wifi}
          label="Backend Connection"
          value={health.state === 'checking' ? 'Checking...' : backendOnline ? 'Online' : 'Offline'}
          ok={backendOnline}
          pending={health.state === 'checking'}
        />
        <StatusRow
          icon={ShieldCheck}
          label="Database"
          value={health.state === 'checking' ? 'Checking...' : dbConnected ? 'Connected' : 'Unavailable'}
          ok={dbConnected}
          pending={health.state === 'checking'}
        />
        <StatusRow
          icon={Radar}
          label="Scanner"
          value={scannerLabel}
          ok={backendOnline && !!health.scannerStatus && !['ERROR', 'OFFLINE'].includes(health.scannerStatus)}
          pending={health.state === 'checking'}
        />
      </div>
    </div>
  )
}

function StatusRow({ icon: Icon, label, value, ok, pending }: { icon: typeof Wifi; label: string; value: string; ok: boolean; pending: boolean }) {
  const dotColor = pending ? 'bg-slate-500' : ok ? 'bg-emerald-400' : 'bg-red-400'
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-slate-300">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor} ${pending ? '' : 'motion-safe:animate-pulse'}`} />
        <span className="text-xs font-medium text-slate-400">{value}</span>
      </div>
    </div>
  )
}

function NetworkGlobe() {
  const dots = Array.from({ length: 28 })
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 sg-bg-aurora" />
      <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/10" />
      <div className="absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/10" />
      <div className="absolute left-1/2 top-1/2 h-[16rem] w-[16rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-purple-400/10" />
      {dots.map((_, index) => {
        const left = (index * 137.508) % 100
        const top = (index * 73.13) % 100
        const size = 2 + (index % 3)
        const duration = 8 + (index % 6)
        const delay = (index % 5) * 0.7
        return (
          <span
            key={index}
            className="absolute rounded-full bg-cyan-300/40 motion-reduce:!animate-none"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              animationName: 'sg-drift',
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
            }}
          />
        )
      })}
      <style>{`
        @keyframes sg-drift {
          0%, 100% { transform: translate(0, 0); opacity: 0.25; }
          50% { transform: translate(12px, -18px); opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
