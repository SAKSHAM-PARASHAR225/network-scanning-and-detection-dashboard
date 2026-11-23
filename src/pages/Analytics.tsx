import { useEffect, useMemo, useState } from 'react'
import { Activity, Radio, ScanLine, Wifi } from 'lucide-react'
import { AlertTrendChart } from '../components/analytics/AlertTrendChart'
import { NetworkTrendChart } from '../components/analytics/NetworkTrendChart'
import { EmptyState } from '../components/common/EmptyState'
import { StatCard } from '../components/dashboard/StatCard'
import { ScannerStatus } from '../components/ScannerStatus'
import { RADAR_STATUS_COLOR, RADAR_STATUS_LABEL } from '../components/WirelessRadar'
import { useWirelessMonitoring } from '../hooks/useWirelessMonitoring'
import { useAppSettings } from '../hooks/useAppSettings'
import { networkApi } from '../services/networkApi'
import type { ScanRecord, SecurityStatus } from '../types'
import { buildEncryptionDistribution, buildSignalDistribution } from '../utils/networkClassification'

const TIME_RANGES = [
  { label: 'Last Hour', minutes: 60 },
  { label: 'Last 6 Hours', minutes: 360 },
  { label: 'Last 24 Hours', minutes: 1440 },
  { label: 'Last 7 Days', minutes: 10080 },
  { label: 'All Available', minutes: Infinity },
]

export function AnalyticsPage() {
  const { networks, activityTrend } = useWirelessMonitoring()
  const { settings } = useAppSettings()
  const [rangeIndex, setRangeIndex] = useState(TIME_RANGES.length - 1)
  const [scanSessions, setScanSessions] = useState<ScanRecord[]>([])

  // Uptime needs FAILED sessions too, which activityTrend deliberately
  // excludes (it only tracks completed cycles for the trend charts) — so
  // this page pulls its own raw history rather than reusing that filtered view.
  useEffect(() => {
    networkApi.getScanHistory(500).then(setScanSessions).catch(() => undefined)
  }, [])

  // Same rule as Overview and the radar: "current" stats describe what's
  // actually in range right now, not every network ever recorded.
  const visibleNetworks = useMemo(() => networks.filter((network) => network.isCurrentlyVisible), [networks])

  const rangeMinutes = TIME_RANGES[rangeIndex].minutes
  const scopedTrend = useMemo(() => {
    if (rangeMinutes === Infinity) return activityTrend
    const cutoff = Date.now() - rangeMinutes * 60_000
    return activityTrend.filter((point) => point.timestampMs >= cutoff)
  }, [activityTrend, rangeMinutes])

  const summary = useMemo(() => {
    const withSignal = visibleNetworks.filter((network): network is typeof network & { signal: number } => network.signal !== null)
    const averageSignalStrength = withSignal.length
      ? withSignal.reduce((sum, network) => sum + network.signal, 0) / withSignal.length
      : null

    const completed = scanSessions.filter((session) => session.status === 'COMPLETED').length
    const uptime = scanSessions.length ? (completed / scanSessions.length) * 100 : null

    return {
      totalScans: scanSessions.length,
      averageSignalStrength,
      uptime,
    }
  }, [visibleNetworks, scanSessions])

  const encryptionDistribution = useMemo(() => buildEncryptionDistribution(visibleNetworks), [visibleNetworks])
  const signalDistribution = useMemo(
    () => buildSignalDistribution(visibleNetworks, settings.weakSignalThreshold),
    [visibleNetworks, settings.weakSignalThreshold],
  )
  const maxEncryptionValue = Math.max(1, ...encryptionDistribution.map((entry) => entry.value))
  const maxSignalValue = Math.max(1, ...Object.values(signalDistribution))

  const securityDistribution = useMemo(() => {
    const tally: Record<SecurityStatus, number> = { VERIFIED: 0, UNVERIFIED: 0, SUSPICIOUS: 0, POSSIBLE_EVIL_TWIN: 0, ROGUE: 0 }
    visibleNetworks.forEach((network) => { tally[network.securityStatus] += 1 })
    return tally
  }, [visibleNetworks])
  const maxSecurityValue = Math.max(1, ...Object.values(securityDistribution))

  const channelUsage = useMemo(() => {
    const tally = new Map<number, number>()
    visibleNetworks.forEach((network) => {
      if (network.channel === null) return
      tally.set(network.channel, (tally.get(network.channel) ?? 0) + 1)
    })
    return Array.from(tally.entries()).sort((a, b) => a[0] - b[0])
  }, [visibleNetworks])
  const maxChannelValue = Math.max(1, ...channelUsage.map(([, count]) => count))

  const networkTrendData = scopedTrend.map((point) => ({ time: point.time, networks: point.networks }))
  const alertTrendData = scopedTrend.map((point) => ({ time: point.time, alerts: point.alerts }))

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-400">Threat analytics</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-100">Analytics</h2>
          <p className="mt-1 text-sm text-slate-400">Insights and trends from your network scans</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={rangeIndex}
            onChange={(event) => setRangeIndex(Number(event.target.value))}
            className="rounded-xl border border-sg-border bg-[#0a121f] px-3 py-2.5 text-sm text-slate-100"
          >
            {TIME_RANGES.map((range, index) => (
              <option key={range.label} value={index}>{range.label}</option>
            ))}
          </select>
          <ScannerStatus variant="pill" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Scans" value={scanSessions.length ? String(summary.totalScans) : '--'} trend="Recorded cycles" icon={<ScanLine className="h-4 w-4" />} tone="cyan" tooltip="Real completed + failed scan sessions on record" />
        <StatCard label="Active Networks" value={String(visibleNetworks.length)} trend="Currently visible" icon={<Wifi className="h-4 w-4" />} tone="blue" tooltip="Networks detected in the most recent scan" />
        <StatCard label="Average Signal" value={summary.averageSignalStrength !== null ? `${Math.round(summary.averageSignalStrength)} dBm` : '--'} trend="Across visible networks" icon={<Activity className="h-4 w-4" />} tone="green" tooltip="Mean signal strength of currently visible networks" />
        <StatCard label="Uptime" value={summary.uptime !== null ? `${summary.uptime.toFixed(1)}%` : '--'} trend="Scan success rate" icon={<Radio className="h-4 w-4" />} tone="yellow" tooltip="Share of recorded scans that completed successfully" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {scopedTrend.length > 0 ? (
          <>
            <NetworkTrendChart data={networkTrendData} />
            <AlertTrendChart data={alertTrendData} />
          </>
        ) : (
          <>
            <div className="glass-card rounded-2xl p-4"><EmptyState title="No scanner data" description="Network activity populates as live scans are reported." /></div>
            <div className="glass-card rounded-2xl p-4"><EmptyState title="No scanner data" description="Alert activity populates as live scans are reported." /></div>
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="glass-card rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">Security Distribution</h3>
          {visibleNetworks.length === 0 ? (
            <EmptyState title="No scanner data" description="Security distribution will populate once networks are detected." />
          ) : (
            <div className="space-y-3">
              {(Object.keys(securityDistribution) as SecurityStatus[]).map((status) => (
                <div key={status}>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-300">
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: RADAR_STATUS_COLOR[status] }} />{RADAR_STATUS_LABEL[status]}</span>
                    <span>{securityDistribution[status]}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800"><div className="h-full rounded-full" style={{ width: `${(securityDistribution[status] / maxSecurityValue) * 100}%`, backgroundColor: RADAR_STATUS_COLOR[status] }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">Channel Usage</h3>
          {channelUsage.length === 0 ? (
            <EmptyState title="No scanner data" description="Channel usage will populate once networks are detected." />
          ) : (
            <div className="space-y-3">
              {channelUsage.map(([channel, count]) => (
                <div key={channel}>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-300"><span>Channel {channel}</span><span>{count}</span></div>
                  <div className="h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-purple-400" style={{ width: `${(count / maxChannelValue) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="glass-card rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">Encryption Distribution</h3>
          {visibleNetworks.length === 0 ? (
            <EmptyState title="No scanner data" description="Encryption distribution will populate once networks are detected." />
          ) : (
            <div className="space-y-3">
              {encryptionDistribution.map(({ name, value }) => (
                <div key={name}>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-300"><span>{name}</span><span>{value}</span></div>
                  <div className="h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${(value / maxEncryptionValue) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">Signal Strength Distribution</h3>
          {visibleNetworks.length === 0 ? (
            <EmptyState title="No scanner data" description="Signal distribution will populate once networks are detected." />
          ) : (
            <div className="space-y-3">
              {Object.entries(signalDistribution).map(([key, value]) => (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-300"><span>{key}</span><span>{value}</span></div>
                  <div className="h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${(value / maxSignalValue) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
