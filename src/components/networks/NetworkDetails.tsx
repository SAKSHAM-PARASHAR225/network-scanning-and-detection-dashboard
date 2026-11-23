import { AlertTriangle } from 'lucide-react'
import type { SecurityStatus, WirelessNetwork } from '../../types'
import { useAppSettings } from '../../hooks/useAppSettings'
import { formatClockTime, formatSecurityStatus } from '../../utils/networkClassification'
import { Badge } from '../common/Badge'
import { Button } from '../common/Button'

interface NetworkDetailsProps {
  network: WirelessNetwork | null
  onClose: () => void
  onTrust: (network: WirelessNetwork) => void
  trusting?: boolean
}

const toneByStatus: Record<SecurityStatus, 'secure' | 'warning' | 'danger' | 'info'> = {
  VERIFIED: 'secure',
  UNVERIFIED: 'info',
  SUSPICIOUS: 'warning',
  POSSIBLE_EVIL_TWIN: 'danger',
  ROGUE: 'danger',
}

const riskTone: Record<string, 'secure' | 'warning' | 'danger'> = {
  LOW: 'secure',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
}

const analysisByStatus: Record<SecurityStatus, string[]> = {
  VERIFIED: ['BSSID matches the administrator-approved trusted baseline'],
  UNVERIFIED: ['BSSID is not in the trusted baseline', 'No prior record of this SSID/BSSID pair as trusted'],
  SUSPICIOUS: ['BSSID is not in the trusted baseline', 'Multiple risk indicators observed — recommend review'],
  POSSIBLE_EVIL_TWIN: ['SSID matches a trusted network', 'BSSID does not match the trusted access point', 'Possible impersonation in progress'],
  ROGUE: ['Multiple independent indicators identify this access point as rogue'],
}

export function NetworkDetails({ network, onClose, onTrust, trusting }: NetworkDetailsProps) {
  const { settings } = useAppSettings()
  if (!network) return null

  const tone = toneByStatus[network.securityStatus]
  const items = analysisByStatus[network.securityStatus]
  const isEvilTwin = network.securityStatus === 'POSSIBLE_EVIL_TWIN'
  const isVerified = network.securityStatus === 'VERIFIED'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Network Details</p>
          <h4 className="mt-2 text-2xl font-semibold text-slate-100">{network.ssid || '(hidden SSID)'}</h4>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={riskTone[network.riskLevel] ?? 'secure'}>{network.riskLevel} RISK</Badge>
          <Badge tone={tone}>{formatSecurityStatus(network.securityStatus)}</Badge>
        </div>
      </div>

      {isEvilTwin && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-red-200">Possible Evil Twin</p>
            <p className="mt-1 text-sm text-red-200/80">
              This SSID matches a trusted network, but the broadcasting BSSID does not match the known trusted access point.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isEvilTwin && network.trustedBssid && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 xl:col-span-2"><p className="text-[10px] uppercase tracking-[0.18em] text-red-300/80">Trusted BSSID</p><p className="mt-2 font-mono text-sm text-red-100">{network.trustedBssid}</p></div>
        )}
        {/* BSSID stays visible for an evil twin regardless of the setting — it's the crux of that finding, not incidental technical detail. */}
        {(settings.showTechnicalDetails || isEvilTwin) && (
          <div className={`rounded-xl border p-3 ${isEvilTwin ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800 bg-slate-950/60'}`}><p className={`text-[10px] uppercase tracking-[0.18em] ${isEvilTwin ? 'text-red-300/80' : 'text-slate-500'}`}>{isEvilTwin ? 'Detected BSSID' : 'BSSID'}</p><p className={`mt-2 font-mono text-sm ${isEvilTwin ? 'text-red-100' : 'text-slate-100'}`}>{network.bssid}</p></div>
        )}
        {settings.showTechnicalDetails && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Channel</p><p className="mt-2 font-mono text-sm text-slate-100">{network.channel ?? '—'}</p></div>
        )}
        {settings.showTechnicalDetails && network.band && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Band</p><p className="mt-2 font-mono text-sm text-slate-100">{network.band}</p></div>
        )}
        {settings.showTechnicalDetails && network.frequency && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Frequency</p><p className="mt-2 font-mono text-sm text-slate-100">{network.frequency} MHz</p></div>
        )}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Signal</p><p className="mt-2 font-mono text-sm text-slate-100">{network.signal !== null ? `${network.signal} dBm` : 'Unknown'}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Encryption</p><p className="mt-2 font-mono text-sm text-slate-100">{network.encryption}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Risk Score</p><p className="mt-2 font-mono text-sm text-slate-100">{network.riskScore} / 100</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">First Seen</p><p className="mt-2 font-mono text-sm text-slate-100">{formatClockTime(network.firstSeen)}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Last Seen</p><p className="mt-2 font-mono text-sm text-slate-100">{formatClockTime(network.lastSeen)}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Currently Visible</p><p className="mt-2 font-mono text-sm text-slate-100">{network.isCurrentlyVisible ? 'Yes' : 'No (out of range)'}</p></div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Security Analysis</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-200">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 text-cyan-300">{network.securityStatus === 'ROGUE' || isEvilTwin ? '!' : network.securityStatus === 'SUSPICIOUS' ? '⚠' : '✓'}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {!isVerified && (
          <Button variant="primary" onClick={() => onTrust(network)} disabled={trusting}>
            {trusting ? 'Adding to baseline...' : 'Add to Trusted Baseline'}
          </Button>
        )}
      </div>
    </div>
  )
}
