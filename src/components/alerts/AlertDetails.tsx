import type { SecurityAlert } from '../../types'
import { formatAlertType, formatClockTime } from '../../utils/networkClassification'
import { Button } from '../common/Button'
import { SeverityBadge } from './SeverityBadge'

interface AlertDetailsProps {
  alert: SecurityAlert | null
  onClose: () => void
  onResolve: (alert: SecurityAlert) => void
  resolving?: boolean
}

export function AlertDetails({ alert, onClose, onResolve, resolving }: AlertDetailsProps) {
  if (!alert) return null

  const reasons = Array.isArray(alert.metadata?.reasons) ? (alert.metadata.reasons as string[]) : []
  const isOpen = alert.status === 'OPEN'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Alert Details</p>
          <h4 className="mt-2 text-2xl font-semibold text-slate-100">{formatAlertType(alert.type)}</h4>
        </div>
        <div className="flex items-center gap-2">
          <SeverityBadge severity={alert.severity} />
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isOpen ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>
            {alert.status}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Alert ID</p><p className="mt-2 font-mono text-sm">{alert.id}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Detection Time</p><p className="mt-2 font-mono text-sm">{formatClockTime(alert.timestamp)}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Network</p><p className="mt-2 text-sm">{alert.ssid || '(hidden SSID)'}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">BSSID</p><p className="mt-2 font-mono text-xs">{alert.bssid}</p></div>
        {typeof alert.riskScore === 'number' && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:col-span-2"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Risk Score</p><p className="mt-2 font-mono text-sm">{alert.riskScore} / 100</p></div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Reason</p>
        <p className="mt-2 text-sm text-slate-200">{alert.message}</p>
      </div>

      {reasons.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Contributing Factors</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <span className="mt-1 text-cyan-300">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {isOpen && (
          <Button variant="primary" onClick={() => onResolve(alert)} disabled={resolving}>
            {resolving ? 'Resolving...' : 'Mark Resolved'}
          </Button>
        )}
      </div>
    </div>
  )
}
