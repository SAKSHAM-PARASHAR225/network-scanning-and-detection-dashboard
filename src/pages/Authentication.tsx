import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, Shield } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const STEPS = [
  'Verifying credentials',
  'Loading modules',
  'Establishing secure session',
  'Initializing dashboard',
]

const STEP_INTERVAL_MS = 320
const HOLD_AFTER_COMPLETE_MS = 500

export function AuthenticationPage() {
  const { completeAuthentication } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const remember = Boolean((location.state as { remember?: boolean } | null)?.remember)
  const [completedSteps, setCompletedSteps] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (completedSteps >= STEPS.length) {
      setDone(true)
      const finish = setTimeout(() => {
        completeAuthentication(remember)
        navigate('/', { replace: true })
      }, HOLD_AFTER_COMPLETE_MS)
      return () => clearTimeout(finish)
    }

    const advance = setTimeout(() => setCompletedSteps((count) => count + 1), STEP_INTERVAL_MS)
    return () => clearTimeout(advance)
  }, [completedSteps, completeAuthentication, navigate, remember])

  const progress = done ? 100 : Math.round((completedSteps / STEPS.length) * 100)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#020712] px-4">
      <div className="relative flex h-40 w-40 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-cyan-400/20 motion-safe:animate-[spin_6s_linear_infinite]" />
        <span className="absolute inset-3 rounded-full border border-cyan-400/30 motion-safe:animate-[spin_4s_linear_infinite_reverse]" />
        <span className="absolute inset-7 rounded-full border border-purple-400/25 motion-safe:animate-[spin_5s_linear_infinite]" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-400/10 shadow-glow">
          <Shield className="h-8 w-8 text-cyan-300" />
        </div>
      </div>

      <h1 className="mt-8 text-xl font-semibold text-slate-100">ScanGuard</h1>
      <p className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-500">Authenticating...</p>

      <div className="mt-8 w-full max-w-xs">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-right text-[11px] font-mono text-slate-500">{progress}%</p>
      </div>

      <ul className="mt-2 w-full max-w-xs space-y-2 text-sm">
        {STEPS.map((step, index) => {
          const isComplete = index < completedSteps
          const isCurrent = index === completedSteps && !done
          return (
            <li key={step} className={`flex items-center gap-2 transition-colors ${isComplete ? 'text-emerald-300' : isCurrent ? 'text-slate-200' : 'text-slate-600'}`}>
              {isComplete ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Circle className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-cyan-400' : ''}`} />}
              {step}
            </li>
          )
        })}
        {!done && completedSteps === STEPS.length && (
          <li className="flex items-center gap-2 text-slate-500"><Circle className="h-4 w-4 shrink-0" />Almost there...</li>
        )}
      </ul>

      {done && (
        <p className="mt-6 text-sm font-medium text-emerald-300">Access Granted. Welcome Back!</p>
      )}
    </div>
  )
}
