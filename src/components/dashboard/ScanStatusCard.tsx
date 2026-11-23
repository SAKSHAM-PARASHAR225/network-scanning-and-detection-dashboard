import { AlertTriangle, CheckCircle2, Radar, WifiOff } from 'lucide-react'
import { useScanCountdown, type ScanPhase } from '../../hooks/useScanCountdown'
import { formatAgo } from '../../hooks/useNow'

const PHASE_TITLE: Record<ScanPhase, string> = {
  offline: 'Scanner Offline',
  setup: 'Awaiting Setup',
  error: 'Scanner Error',
  scanning: 'Scanning Networks...',
  due: 'Scanning...',
  complete: 'Scan Complete',
  active: 'Scanner Active',
}

const PHASE_TONE: Record<ScanPhase, { dot: string; text: string }> = {
  offline: { dot: 'bg-slate-500', text: 'text-slate-400' },
  setup: { dot: 'bg-amber-400', text: 'text-amber-300' },
  error: { dot: 'bg-red-400', text: 'text-red-300' },
  scanning: { dot: 'bg-cyan-400', text: 'text-cyan-200' },
  due: { dot: 'bg-cyan-400', text: 'text-cyan-200' },
  complete: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
  active: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
}

export function ScanStatusCard() {
  const { phase, secondsToNext, secondsSinceLast, progress, interval, networksDetected } = useScanCountdown()
  const tone = PHASE_TONE[phase]
  const busy = phase === 'scanning' || phase === 'due'

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div key={phase} className="flex items-center gap-2 animate-sg-fade">
          <span className="relative flex h-2.5 w-2.5">
            {phase !== 'offline' && <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping ${tone.dot}`} />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${tone.dot}`} />
          </span>
          <span className={`text-sm font-semibold uppercase tracking-[0.2em] ${tone.text}`}>{PHASE_TITLE[phase]}</span>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${busy ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200 shadow-glow' : 'border-sg-border bg-white/5 text-slate-400'}`}>
          {phase === 'offline' ? <WifiOff className="h-4 w-4" />
            : phase === 'error' ? <AlertTriangle className="h-4 w-4 text-red-300" />
              : phase === 'complete' ? <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                : <Radar className={`h-4 w-4 ${busy ? 'motion-safe:animate-spin' : ''}`} />}
        </div>
      </div>

      <div key={`${phase}-body`} className="mt-4 animate-sg-fade">
        {phase === 'complete' ? (
          <div>
            <p className="font-mono text-3xl font-semibold text-emerald-200 glow-text">{networksDetected ?? '--'}</p>
            <p className="text-sm text-slate-400">networks detected</p>
          </div>
        ) : busy ? (
          <div>
            <p className="text-sm text-slate-300">Sweeping the air for access points...</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800/80">
              <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent motion-safe:animate-sg-scan-bar" style={{ boxShadow: '0 0 12px rgba(34, 211, 238, 0.7)' }} />
            </div>
          </div>
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Last scan</dt>
              <dd className="font-mono text-slate-100">{secondsSinceLast !== null ? formatAgo(secondsSinceLast) : '--'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Next scan</dt>
              <dd className="font-mono text-cyan-200">{secondsToNext !== null && phase === 'active' ? `${String(secondsToNext).padStart(2, '0')} sec` : '--'}</dd>
            </div>
          </dl>
        )}
      </div>

      {phase !== 'offline' && phase !== 'setup' && (
        <div className="mt-4">
          {!busy && (
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 transition-[width] duration-1000 ease-linear"
                style={{ width: `${phase === 'complete' ? 0 : progress}%`, boxShadow: '0 0 12px rgba(34, 211, 238, 0.6)' }}
              />
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-500">
            {phase === 'complete' && secondsToNext !== null ? `Next scan in ${secondsToNext}s · ` : ''}Automatic scan every {interval}s
          </p>
        </div>
      )}
    </div>
  )
}
