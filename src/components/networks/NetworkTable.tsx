import type { SecurityStatus, WirelessNetwork } from '../../types'
import { useAppSettings } from '../../hooks/useAppSettings'
import { formatClockTime, formatSecurityStatus, signalBucket } from '../../utils/networkClassification'
import { Badge } from '../common/Badge'

interface NetworkTableProps {
  networks: WirelessNetwork[]
  onView: (network: WirelessNetwork) => void
  onInvestigate: (network: WirelessNetwork) => void
}

const statusTone: Record<SecurityStatus, 'secure' | 'warning' | 'danger' | 'info'> = {
  VERIFIED: 'secure',
  UNVERIFIED: 'info',
  SUSPICIOUS: 'warning',
  POSSIBLE_EVIL_TWIN: 'danger',
  ROGUE: 'danger',
}

const statusDotClass: Record<SecurityStatus, string> = {
  VERIFIED: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]',
  UNVERIFIED: 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.85)]',
  SUSPICIOUS: 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.85)]',
  POSSIBLE_EVIL_TWIN: 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.85)]',
  ROGUE: 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.85)]',
}

const SIGNAL_BAR_CLASS: Record<'Strong' | 'Medium' | 'Weak', string> = {
  Strong: 'bg-emerald-500/80',
  Medium: 'bg-amber-500/80',
  Weak: 'bg-red-500/80',
}

export function NetworkTable({ networks, onView, onInvestigate }: NetworkTableProps) {
  const { settings } = useAppSettings()
  const cellPad = settings.compactTable ? 'px-3 py-1.5' : 'px-5 py-3'
  const headPad = settings.compactTable ? 'px-3 py-2' : 'px-5 py-3'

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0d1722] shadow-soft">
      <div className={`flex items-center justify-between border-b border-white/8 ${settings.compactTable ? 'px-4 py-2.5' : 'px-5 py-4'}`}>
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Nearby Wireless Networks</h3>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{networks.length} networks</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#101b29] text-[10px] uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className={`${headPad} font-medium`}>SSID</th>
              {settings.showTechnicalDetails && <th className={`${headPad} font-medium`}>BSSID</th>}
              {settings.showTechnicalDetails && <th className={`${headPad} font-medium`}>Channel</th>}
              <th className={`${headPad} font-medium`}>Signal</th>
              <th className={`${headPad} font-medium`}>Encryption</th>
              <th className={`${headPad} font-medium`}>Security Status</th>
              <th className={`${headPad} font-medium`}>Last Seen</th>
              <th className={`${headPad} font-medium`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {networks.map((network, index) => {
              const bucket = network.signal !== null ? signalBucket(network.signal, settings.weakSignalThreshold) : null
              return (
                <tr key={network.bssid} className={index % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'}>
                  <td className={cellPad}>
                    <div className="flex items-center gap-2.5">
                      <span className={`inline-flex h-2.5 w-2.5 rounded-full ${statusDotClass[network.securityStatus]}`} />
                      <span className="font-medium text-slate-100">{network.ssid}</span>
                    </div>
                  </td>
                  {settings.showTechnicalDetails && <td className={`${cellPad} font-mono text-xs text-slate-300`}>{network.bssid}</td>}
                  {settings.showTechnicalDetails && <td className={`${cellPad} font-mono text-xs text-slate-300`}>{network.channel}</td>}
                  <td className={cellPad}>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-200">
                      <span>{network.signal !== null ? `${network.signal} dBm` : '—'}</span>
                      {bucket && <span className={`h-1.5 w-12 rounded-full ${SIGNAL_BAR_CLASS[bucket]}`} />}
                    </div>
                  </td>
                  <td className={`${cellPad} font-medium text-slate-200`}>{network.encryption}</td>
                  <td className={cellPad}>
                    <Badge tone={statusTone[network.securityStatus]}>{formatSecurityStatus(network.securityStatus)}</Badge>
                  </td>
                  <td className={`${cellPad} font-mono text-xs text-slate-300`}>{formatClockTime(network.lastSeen)}</td>
                  <td className={cellPad}>
                    <div className="flex gap-2">
                      <button onClick={() => onView(network)} className="rounded-lg border border-white/8 bg-[#111d2b] px-2.5 py-1.5 text-[11px] text-slate-200 transition hover:border-cyan-400/30 hover:text-cyan-200">View</button>
                      {network.securityStatus !== 'VERIFIED' && (
                        <button onClick={() => onInvestigate(network)} className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-400/15">Investigate</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
