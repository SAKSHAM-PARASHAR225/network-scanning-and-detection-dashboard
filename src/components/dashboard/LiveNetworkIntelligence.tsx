import { AlertTriangle, ArrowRight, CheckCircle2, Info, MousePointerClick, XCircle } from 'lucide-react'
import type { SecurityAlert, WirelessNetwork } from '../../types'
import { RADAR_STATUS_COLOR, RADAR_STATUS_LABEL } from '../WirelessRadar'
import { useWirelessMonitoring } from '../../hooks/useWirelessMonitoring'
import { useAppSettings } from '../../hooks/useAppSettings'
import { latestLiveReading, useLiveSignal } from '../../hooks/useLiveSignal'
import { formatAgo, useNow } from '../../hooks/useNow'

export type IntelSource = 'hovered' | 'selected' | 'auto'

interface LiveNetworkIntelligenceProps {
  network: WirelessNetwork | null
  source: IntelSource
  onInvestigate: (network: WirelessNetwork) => void
}

type FindingTone = 'ok' | 'warn' | 'danger' | 'info'
interface Finding { tone: FindingTone; text: string }

const FINDING_STYLE: Record<FindingTone, { icon: typeof CheckCircle2; className: string }> = {
  ok: { icon: CheckCircle2, className: 'text-emerald-300' },
  warn: { icon: AlertTriangle, className: 'text-amber-300' },
  danger: { icon: XCircle, className: 'text-red-300' },
  info: { icon: Info, className: 'text-sky-300' },
}

const ENCRYPTION_FINDING: Record<WirelessNetwork['encryption'], Finding> = {
  WPA3: { tone: 'ok', text: 'Strong encryption (WPA3)' },
  WPA2: { tone: 'ok', text: 'Standard encryption (WPA2)' },
  WPA: { tone: 'warn', text: 'Weak encryption (legacy WPA)' },
  WEP: { tone: 'danger', text: 'Broken encryption (WEP)' },
  OPEN: { tone: 'danger', text: 'No encryption (open network)' },
  UNKNOWN: { tone: 'warn', text: 'Encryption could not be determined' },
}

const STATUS_FINDING: Record<WirelessNetwork['securityStatus'], Finding> = {
  VERIFIED: { tone: 'ok', text: 'Matches the trusted baseline (BSSID verified)' },
  UNVERIFIED: { tone: 'warn', text: 'Unknown access point — not in trusted baseline' },
  SUSPICIOUS: { tone: 'warn', text: 'Flagged suspicious by the analyzer' },
  POSSIBLE_EVIL_TWIN: { tone: 'danger', text: 'Evil-twin pattern — imitates a trusted SSID' },
  ROGUE: { tone: 'danger', text: 'Classified as a rogue access point' },
}

function buildFindings(network: WirelessNetwork, openAlerts: SecurityAlert[], signal: number | null, weakThreshold: number): Finding[] {
  const findings: Finding[] = [ENCRYPTION_FINDING[network.encryption], STATUS_FINDING[network.securityStatus]]
  if (network.securityStatus !== 'POSSIBLE_EVIL_TWIN') findings.push({ tone: 'ok', text: 'No evil-twin pattern detected' })
  if (!network.ssid) findings.push({ tone: 'warn', text: 'Hidden SSID' })
  findings.push(openAlerts.length > 0
    ? { tone: 'warn', text: `${openAlerts.length} open alert${openAlerts.length === 1 ? '' : 's'} for this BSSID` }
    : { tone: 'ok', text: 'No open alerts for this BSSID' })
  if (signal !== null && signal < weakThreshold) findings.push({ tone: 'info', text: `Weak signal (below ${weakThreshold} dBm)` })
  return findings
}

// Log-distance path-loss estimate: reference power at 1 m and an indoor
// path-loss exponent of 3. Walls and interference make this rough, which is
// why the UI labels it as an estimate.
function estimateDistanceMeters(signal: number, band?: string | null) {
  const referenceAt1m = band && /^(5|6)/.test(band) ? -47 : -40
  return 10 ** ((referenceAt1m - signal) / 30)
}

function riskBarClass(level: WirelessNetwork['riskLevel']) {
  if (level === 'CRITICAL') return 'from-red-500 to-pink-500'
  if (level === 'HIGH') return 'from-orange-400 to-red-500'
  if (level === 'MEDIUM') return 'from-yellow-300 to-orange-400'
  return 'from-emerald-400 to-cyan-400'
}

// Every entry is a real timestamp: the latest 1-second reading, the last full
// scan that re-classified this AP, its alerts, and when it was first seen.
function buildTimeline(network: WirelessNetwork, live: { signal: number; timestampMs: number } | null, networkAlerts: SecurityAlert[]) {
  const events: Array<{ label: string; at: number; tone: string }> = []
  if (live) events.push({ label: `Signal reading ${live.signal} dBm`, at: live.timestampMs, tone: 'bg-cyan-400' })
  events.push({ label: 'Security analyzed in network scan', at: new Date(network.lastSeen).getTime(), tone: 'bg-purple-400' })
  ;[...networkAlerts]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 2)
    .forEach((alert) => events.push({
      label: `${alert.title || alert.type.replace(/_/g, ' ').toLowerCase()}${alert.status === 'RESOLVED' ? ' (resolved)' : ''}`,
      at: new Date(alert.timestamp).getTime(),
      tone: alert.status === 'OPEN' ? 'bg-amber-400' : 'bg-slate-500',
    }))
  events.push({ label: 'First detected', at: new Date(network.firstSeen).getTime(), tone: 'bg-emerald-400' })
  return events.filter((event) => Number.isFinite(event.at)).sort((a, b) => b.at - a.at).slice(0, 5)
}

const SOURCE_LABEL: Record<IntelSource, string> = {
  hovered: 'Hovered on radar',
  selected: 'Selected on radar',
  auto: 'Highest risk in range',
}

export function LiveNetworkIntelligence({ network, source, onInvestigate }: LiveNetworkIntelligenceProps) {
  const { alerts } = useWirelessMonitoring()
  const { settings } = useAppSettings()
  const { points } = useLiveSignal()
  const now = useNow(1000)

  const live = network ? latestLiveReading(points, network.bssid) : null
  const signal = live?.signal ?? network?.signal ?? null

  const networkAlerts = network ? alerts.filter((alert) => alert.bssid === network.bssid) : []
  const openAlerts = networkAlerts.filter((alert) => alert.status === 'OPEN')
  const timeline = network ? buildTimeline(network, live, networkAlerts) : []

  return (
    <div className="glass-card flex h-full flex-col rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-100">Live Network Intelligence</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Live
        </span>
      </div>

      {!network ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center text-sm text-slate-400">
          <MousePointerClick className="h-6 w-6 text-slate-500" />
          No networks in range yet. Intelligence appears once the scanner reports access points.
        </div>
      ) : (
        <div key={network.bssid} className="flex flex-1 flex-col gap-4 animate-sg-fade">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{SOURCE_LABEL[source]}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RADAR_STATUS_COLOR[network.securityStatus], boxShadow: `0 0 10px ${RADAR_STATUS_COLOR[network.securityStatus]}` }} />
              <p className="truncate text-lg font-semibold text-slate-100">{network.ssid || 'Hidden network'}</p>
            </div>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: RADAR_STATUS_COLOR[network.securityStatus] }}>
              {RADAR_STATUS_LABEL[network.securityStatus]}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-500">{network.bssid}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <InfoRow label="Signal" value={signal !== null ? `${signal} dBm` : '--'} mono />
            <InfoRow label="Channel" value={network.channel !== null ? String(network.channel) : '--'} mono />
            <InfoRow label="Security" value={network.encryption} />
            <InfoRow label="Band" value={network.band ?? '--'} />
            <InfoRow label="Distance (est.)" value={signal !== null ? `~${Math.round(estimateDistanceMeters(signal, network.band))} m` : '--'} mono />
            <InfoRow label="Risk score" value={`${network.riskScore}%`} mono />
          </dl>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-[0.18em]">
              <span className="text-slate-500">Threat risk</span>
              <span className="font-mono text-slate-200">{network.riskScore}% · {network.riskLevel}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${riskBarClass(network.riskLevel)} transition-[width] duration-500`}
                style={{ width: `${network.riskScore}%`, boxShadow: '0 0 12px rgba(248, 113, 113, 0.45)' }}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">Threat analysis</p>
            <ul className="space-y-1.5 text-sm">
              {buildFindings(network, openAlerts, signal, settings.weakSignalThreshold).map((finding) => {
                const { icon: Icon, className } = FINDING_STYLE[finding.tone]
                return (
                  <li key={finding.text} className="flex items-start gap-2 text-slate-300">
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${className}`} />
                    {finding.text}
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">Recent activity</p>
            <ol className="relative space-y-2 border-l border-white/10 pl-4 text-sm">
              {timeline.map((event) => (
                <li key={`${event.label}-${event.at}`} className="relative flex items-center justify-between gap-3">
                  <span className={`absolute -left-[21px] h-2 w-2 rounded-full shadow-glow ring-2 ring-[#060c16] ${event.tone}`} />
                  <span className="truncate text-slate-300">{event.label}</span>
                  <span className="shrink-0 font-mono text-[11px] text-slate-500">{formatAgo(Math.max(0, Math.floor((now - event.at) / 1000)))}</span>
                </li>
              ))}
            </ol>
          </div>

          <button
            onClick={() => onInvestigate(network)}
            className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200 shadow-glow transition hover:bg-cyan-400/20"
          >
            Investigate Network
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`truncate text-slate-100 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}
