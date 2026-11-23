import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { SecurityAlert, Severity } from '../../types'
import { formatAlertType, formatClockTime } from '../../utils/networkClassification'
import { Badge, type BadgeTone } from '../common/Badge'
import { EmptyState } from '../common/EmptyState'

interface AlertPreviewProps {
  alerts: SecurityAlert[]
  onSelect: (alert: SecurityAlert) => void
}

const severityColor: Record<Severity, BadgeTone> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'neutral',
  INFO: 'neutral',
}

export function AlertPreview({ alerts, onSelect }: AlertPreviewProps) {
  const openAlerts = alerts.filter((alert) => alert.status === 'OPEN')

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">Security Alerts</h3>
        <Link to="/alerts" className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200">View All Alerts</Link>
      </div>

      {openAlerts.length === 0 ? (
        <EmptyState title="No active security alerts" description="The monitoring feed is clear for now." />
      ) : (
        <div className="space-y-3">
          {openAlerts.slice(0, 3).map((alert) => (
            <button key={alert.id} onClick={() => onSelect(alert)} className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-left transition hover:border-slate-700 hover:bg-slate-800/80">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{alert.severity}</p>
                    <p className="font-medium text-slate-100">{formatAlertType(alert.type)}</p>
                  </div>
                </div>
                <Badge tone={severityColor[alert.severity]}>{alert.severity}</Badge>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-300">
                <p>SSID: {alert.ssid}</p>
                <p>BSSID: {alert.bssid}</p>
                <p>{formatClockTime(alert.timestamp)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {openAlerts.length > 3 && (
        <div className="mt-4 flex justify-end">
          <Link to="/alerts" className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200">
            More <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  )
}
