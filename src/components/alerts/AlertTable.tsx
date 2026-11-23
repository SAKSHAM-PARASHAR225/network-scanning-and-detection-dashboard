import type { SecurityAlert } from '../../types'
import { useAppSettings } from '../../hooks/useAppSettings'
import { formatAlertType, formatClockTime } from '../../utils/networkClassification'
import { SeverityBadge } from './SeverityBadge'

interface AlertTableProps {
  alerts: SecurityAlert[]
  onSelect: (alert: SecurityAlert) => void
}

export function AlertTable({ alerts, onSelect }: AlertTableProps) {
  const { settings } = useAppSettings()
  const cellPad = settings.compactTable ? 'px-3 py-1.5' : 'px-4 py-3'

  return (
    <div className="overflow-x-auto glass-card rounded-2xl">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
          <tr>
            <th className={cellPad}>ID</th>
            <th className={cellPad}>Severity</th>
            <th className={cellPad}>Type</th>
            <th className={cellPad}>SSID / Target</th>
            {settings.showTechnicalDetails && <th className={cellPad}>BSSID</th>}
            <th className={cellPad}>Detected At</th>
            <th className={cellPad}>Status</th>
            <th className={cellPad}>Action</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr key={alert.id} className="border-t border-slate-800 text-slate-200 hover:bg-slate-800/50">
              <td className={`${cellPad} font-mono text-xs`}>{alert.id}</td>
              <td className={cellPad}><SeverityBadge severity={alert.severity} /></td>
              <td className={cellPad}>{formatAlertType(alert.type)}</td>
              <td className={cellPad}>{alert.ssid}</td>
              {settings.showTechnicalDetails && <td className={`${cellPad} font-mono text-xs`}>{alert.bssid}</td>}
              <td className={`${cellPad} font-mono text-xs`}>{formatClockTime(alert.timestamp)}</td>
              <td className={cellPad}>{alert.status}</td>
              <td className={cellPad}>
                <button onClick={() => onSelect(alert)} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 hover:bg-slate-700">View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
