import { useMemo, useState, type CSSProperties } from 'react'
import { WifiOff } from 'lucide-react'
import './WirelessRadar.css'
import { useWirelessMonitoring } from '../hooks/useWirelessMonitoring'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import type { SecurityAlert, SecurityStatus, WirelessNetwork } from '../types'
import { THREAT_THEME, themeForDisplayStatus } from '../utils/threatTheme'

const RING_COUNT = 4

const STATUS_COLOR: Record<SecurityStatus, string> = {
  VERIFIED: '#34d399',
  UNVERIFIED: '#facc15',
  SUSPICIOUS: '#fb923c',
  POSSIBLE_EVIL_TWIN: '#f472b6',
  ROGUE: '#ef4444',
}

const STATUS_LABEL: Record<SecurityStatus, string> = {
  VERIFIED: 'Verified / Trusted',
  UNVERIFIED: 'Unverified',
  SUSPICIOUS: 'Suspicious',
  POSSIBLE_EVIL_TWIN: 'Possible Evil Twin',
  ROGUE: 'Rogue',
}

function hashToUnit(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return (hash % 1000) / 1000
}

function signalToRadiusPct(signal: number | null): number {
  if (signal === null) return 92
  const clamped = Math.min(-30, Math.max(-90, signal))
  const t = (clamped + 30) / -60
  return 14 + t * 78
}

function networkPosition(network: WirelessNetwork) {
  const angle = hashToUnit(network.bssid) * 360
  const radiusPct = signalToRadiusPct(network.signal)
  const radians = (angle * Math.PI) / 180
  const x = 50 + radiusPct * 0.5 * Math.cos(radians)
  const y = 50 + radiusPct * 0.5 * Math.sin(radians)
  return { x, y }
}

function hasCriticalAlert(network: WirelessNetwork, alerts: SecurityAlert[]) {
  return alerts.some((alert) => alert.status === 'OPEN' && alert.severity === 'CRITICAL' && alert.bssid === network.bssid)
}

interface WirelessRadarProps {
  className?: string
  hideLegend?: boolean
  selectedBssid?: string | null
  onSelect?: (network: WirelessNetwork) => void
  onHoverChange?: (network: WirelessNetwork | null) => void
}

export function WirelessRadar({ className = '', hideLegend = false, selectedBssid = null, onSelect, onHoverChange }: WirelessRadarProps) {
  const { networks, alerts, scannerStatus, threatLevel } = useWirelessMonitoring()
  const reducedMotion = usePrefersReducedMotion()
  const [hoveredBssid, setHoveredBssid] = useState<string | null>(null)

  const setHovered = (network: WirelessNetwork | null) => {
    setHoveredBssid(network?.bssid ?? null)
    onHoverChange?.(network)
  }

  const theme = THREAT_THEME[themeForDisplayStatus(scannerStatus)]
  const isOffline = scannerStatus === 'OFFLINE' || scannerStatus === 'CONNECTING'
  const isSweeping = !isOffline

  const positions = useMemo(
    () => networks.filter((network) => network.isCurrentlyVisible).map((network) => ({ network, ...networkPosition(network) })),
    [networks],
  )

  const hovered = positions.find(({ network }) => network.bssid === hoveredBssid) ?? null

  const shellClass = [
    'radar-shell',
    !reducedMotion && threatLevel === 'critical' && !isOffline ? 'radar-shell--pulse-fast' : '',
    !reducedMotion && threatLevel === 'rogue' && !isOffline ? 'radar-shell--pulse' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={className}>
      {/* Tooltip lives outside the circular shell so it isn't clipped by its overflow. */}
      <div className="relative mx-auto w-full max-w-[420px]" onMouseLeave={() => setHovered(null)}>
      <div className={shellClass} style={{ '--radar-color': theme.color } as CSSProperties}>
        <svg className="radar-rings" viewBox="0 0 100 100" aria-hidden="true">
            {Array.from({ length: RING_COUNT }).map((_, index) => (
              <circle
                key={index}
                cx={50}
                cy={50}
                r={(index + 1) * (48 / RING_COUNT)}
                fill="none"
                stroke={theme.color}
                strokeOpacity={0.28}
                strokeWidth={0.4}
              />
            ))}
            <line x1={50} y1={2} x2={50} y2={98} stroke={theme.color} strokeOpacity={0.22} strokeWidth={0.4} />
            <line x1={2} y1={50} x2={98} y2={50} stroke={theme.color} strokeOpacity={0.22} strokeWidth={0.4} />
          </svg>

          <div className={`radar-sweep ${isSweeping && !reducedMotion ? '' : 'radar-sweep--paused'}`} />
          <div className="radar-center" />

          {positions.map(({ network, x, y }) => {
            const color = STATUS_COLOR[network.securityStatus]
            const critical = hasCriticalAlert(network, alerts)
            const pulse = network.securityStatus === 'ROGUE' || network.securityStatus === 'POSSIBLE_EVIL_TWIN' || network.securityStatus === 'SUSPICIOUS'
            const selected = network.bssid === selectedBssid
            const dotClass = [
              'radar-dot',
              pulse && !reducedMotion ? (critical ? 'radar-dot--pulse-fast' : 'radar-dot--pulse') : '',
              selected ? 'radar-dot--selected' : '',
              network.bssid === hoveredBssid ? 'radar-dot--hovered' : '',
            ].filter(Boolean).join(' ')

            return (
              <button
                type="button"
                key={network.bssid}
                className={dotClass}
                aria-label={`${network.ssid || 'Hidden network'}, ${network.signal ?? 'unknown'} dBm, ${STATUS_LABEL[network.securityStatus]}`}
                aria-pressed={selected}
                style={{ left: `${x}%`, top: `${y}%`, backgroundColor: color, boxShadow: `0 0 8px 1px ${color}`, color }}
                onMouseEnter={() => setHovered(network)}
                onFocus={() => setHovered(network)}
                onBlur={() => setHovered(null)}
                onClick={() => onSelect?.(network)}
              />
            )
          })}

          {isOffline && (
            <div className="radar-offline-overlay">
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <WifiOff className="h-6 w-6" />
                <span className="text-[10px] uppercase tracking-[0.2em]">
                  {scannerStatus === 'CONNECTING' ? 'Connecting to scanner' : 'Scanner offline'}
                </span>
              </div>
            </div>
          )}
      </div>

      {hovered && <RadarTooltip network={hovered.network} x={hovered.x} y={hovered.y} />}
      </div>

      {!hideLegend && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-400">
          {(Object.keys(STATUS_COLOR) as SecurityStatus[]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
              {STATUS_LABEL[status]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function RadarTooltip({ network, x, y }: { network: WirelessNetwork; x: number; y: number }) {
  const color = STATUS_COLOR[network.securityStatus]
  // Flip to the other side of the node near the right/top edges so the card
  // stays inside the radar's column.
  const alignRight = x > 58
  const below = y < 30
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 w-48 rounded-xl border bg-[#060c16]/95 px-3 py-2.5 text-xs shadow-glow backdrop-blur-md"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        borderColor: `${color}66`,
        transform: `translate(${alignRight ? 'calc(-100% - 12px)' : '12px'}, ${below ? '12px' : 'calc(-100% - 12px)'})`,
      }}
    >
      <p className="truncate text-sm font-semibold text-slate-100">{network.ssid || 'Hidden network'}</p>
      <p className="mt-1 font-mono text-slate-300">{network.signal !== null ? `${network.signal} dBm` : 'Signal unknown'}</p>
      <p className="text-slate-400">{network.encryption}</p>
      <p className="text-slate-400">{network.channel !== null ? `Channel ${network.channel}` : 'Channel unknown'}</p>
      <p className="mt-1 font-semibold uppercase tracking-[0.14em]" style={{ color }}>{STATUS_LABEL[network.securityStatus]}</p>
    </div>
  )
}

export { STATUS_COLOR as RADAR_STATUS_COLOR, STATUS_LABEL as RADAR_STATUS_LABEL }
