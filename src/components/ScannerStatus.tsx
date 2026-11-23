import { Radio } from 'lucide-react'
import { useWirelessMonitoring } from '../hooks/useWirelessMonitoring'
import { useRelativeTime } from '../hooks/useRelativeTime'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useScanCountdown } from '../hooks/useScanCountdown'
import { labelForDisplayStatus, THREAT_THEME, themeForDisplayStatus } from '../utils/threatTheme'

interface ScannerStatusProps {
  variant?: 'pill' | 'panel'
  className?: string
  showCountdown?: boolean
}

function CountdownSegment() {
  const { phase, secondsToNext } = useScanCountdown()
  if (phase === 'offline' || phase === 'setup' || phase === 'error') return null
  const busy = phase === 'scanning' || phase === 'due'
  return (
    <span className="ml-1 inline-flex items-center gap-1.5 border-l border-white/10 pl-2.5 font-mono text-slate-300">
      {busy ? <span className="text-cyan-200">SCANNING</span>
        : <>
          {phase === 'complete' && <span className="text-emerald-300">DONE ·</span>}
          NEXT <span className="text-cyan-200">{String(secondsToNext ?? 0).padStart(2, '0')}s</span>
        </>}
    </span>
  )
}

export function ScannerStatus({ variant = 'pill', className = '', showCountdown = false }: ScannerStatusProps) {
  const { scannerStatus, lastScanAt, interfaceName } = useWirelessMonitoring()
  const theme = THREAT_THEME[themeForDisplayStatus(scannerStatus)]
  const label = labelForDisplayStatus(scannerStatus)
  const lastScanLabel = useRelativeTime(lastScanAt)
  const { secondsToNext } = useScanCountdown()
  const reducedMotion = usePrefersReducedMotion()
  const isLive = scannerStatus !== 'OFFLINE' && scannerStatus !== 'CONNECTING'
  const nextScanSeconds = isLive ? secondsToNext : null

  if (variant === 'pill') {
    return (
      <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] ${theme.borderClass} ${theme.bgClass} ${className}`}>
        <span className="relative flex h-2.5 w-2.5">
          {theme.pulse && !reducedMotion && (
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.dotClass} animate-ping`} />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${theme.dotClass}`} />
        </span>
        <span className={`uppercase tracking-[0.18em] ${theme.textClass}`}>{label}</span>
        {showCountdown && <CountdownSegment />}
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-4 ${theme.borderClass} ${theme.bgClass} ${className}`}>
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {theme.pulse && !reducedMotion && (
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.dotClass} animate-ping`} />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${theme.dotClass}`} />
        </span>
        <span className={`text-sm font-semibold uppercase tracking-[0.18em] ${theme.textClass}`}>{label}</span>
      </div>

      {isLive && (
        <div className="mt-3 space-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 uppercase tracking-[0.18em]">
            <Radio className="h-3.5 w-3.5 text-cyan-300" />
            {interfaceName.toUpperCase()}
          </div>
          <div className="flex items-center justify-between">
            <span>Last scan</span>
            <span className="font-mono text-slate-200">{lastScanLabel}</span>
          </div>
          {nextScanSeconds !== null && (
            <div className="flex items-center justify-between">
              <span>Next scan</span>
              <span className="font-mono text-slate-200">{nextScanSeconds} sec</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
