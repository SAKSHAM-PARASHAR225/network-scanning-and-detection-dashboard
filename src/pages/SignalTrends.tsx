import { useMemo } from 'react'
import { Activity, SignalHigh, SignalLow, TrendingUp } from 'lucide-react'
import { LiveSignalChart } from '../components/dashboard/LiveSignalChart'
import { StatCard } from '../components/dashboard/StatCard'
import { EmptyState } from '../components/common/EmptyState'
import { useWirelessMonitoring } from '../hooks/useWirelessMonitoring'
import { useAppSettings } from '../hooks/useAppSettings'
import { latestLiveReading, useLiveSignal } from '../hooks/useLiveSignal'
import { colorForBssid } from '../utils/signalSeries'

// dBm is roughly -90 (unusable) to -30 (right next to the AP); map that
// onto a 0–100% bar so strength is readable at a glance.
function signalPercent(dbm: number) {
  return Math.min(100, Math.max(0, ((dbm + 90) / 60) * 100))
}

export function SignalTrendsPage() {
  const { networks } = useWirelessMonitoring()
  const { points } = useLiveSignal()
  const { settings } = useAppSettings()

  // Latest 1-second reading where available, falling back to the last full
  // scan's value for a network that hasn't appeared in the live feed yet.
  const ranked = useMemo(
    () => networks
      .filter((network) => network.isCurrentlyVisible)
      .map((network) => ({ network, signal: latestLiveReading(points, network.bssid)?.signal ?? network.signal }))
      .filter((entry): entry is { network: typeof entry.network; signal: number } => entry.signal !== null)
      .sort((a, b) => b.signal - a.signal),
    [networks, points],
  )

  const stats = useMemo(() => {
    if (ranked.length === 0) return null
    const average = ranked.reduce((sum, entry) => sum + entry.signal, 0) / ranked.length
    const weak = ranked.filter((entry) => entry.signal < settings.weakSignalThreshold).length
    return { strongest: ranked[0], average, weak }
  }, [ranked, settings.weakSignalThreshold])

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-400 glow-text">Signal intelligence</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-100">Signal Strength Trends</h2>
        <p className="mt-1 text-sm text-slate-400">Live RSSI for every network in range, updated every second</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Networks In Range" value={String(ranked.length)} trend="With a signal reading" icon={<TrendingUp className="h-4 w-4" />} tone="cyan" tooltip="Currently visible networks that report a signal" />
        <StatCard label="Average Signal" value={stats ? `${Math.round(stats.average)} dBm` : '--'} trend="Latest readings" icon={<Activity className="h-4 w-4" />} tone="blue" tooltip="Mean of the latest readings" />
        <StatCard label="Strongest" value={stats ? `${stats.strongest.signal} dBm` : '--'} trend={stats ? stats.strongest.network.ssid || 'Hidden network' : 'No data yet'} icon={<SignalHigh className="h-4 w-4" />} tone="green" tooltip="Network with the strongest current signal" />
        <StatCard label="Weak Signals" value={stats ? String(stats.weak) : '--'} trend={`Below ${settings.weakSignalThreshold} dBm`} icon={<SignalLow className="h-4 w-4" />} tone="yellow" tooltip="Networks under your weak-signal threshold (Settings → Alerts)" />
      </div>

      <LiveSignalChart heightClass="h-[420px]" />

      <div className="glass-card rounded-2xl p-4">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Current Signal Levels</h3>
        {ranked.length === 0 ? (
          <EmptyState title="Waiting for scanner data..." description="Signal levels appear once the scanner reports networks in range." />
        ) : (
          <div className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
            {ranked.map(({ network, signal }) => {
              const color = colorForBssid(network.bssid)
              return (
                <div key={network.bssid}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-slate-200">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                      <span className="truncate">{network.ssid || 'Hidden network'}</span>
                      <span className="hidden font-mono text-[11px] text-slate-500 sm:inline">{network.bssid}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-400">{signal} dBm</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800/80">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${signalPercent(signal)}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
