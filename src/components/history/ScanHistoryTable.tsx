import type { ScanRecord } from '../../types'
import { useAppSettings } from '../../hooks/useAppSettings'
import { formatClockTime } from '../../utils/networkClassification'

interface ScanHistoryTableProps {
  records: ScanRecord[]
  onSelect: (record: ScanRecord) => void
}

export function ScanHistoryTable({ records, onSelect }: ScanHistoryTableProps) {
  const { settings } = useAppSettings()
  const cellPad = settings.compactTable ? 'px-3 py-1.5' : 'px-4 py-3'

  return (
    <div className="overflow-x-auto rounded-2xl border border-sg-border bg-[#0a121f]">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
          <tr>
            <th className={cellPad}>Date &amp; Time</th>
            <th className={cellPad}>Networks Found</th>
            <th className={cellPad}>Secure</th>
            <th className={cellPad}>Suspicious</th>
            <th className={cellPad}>Critical</th>
            <th className={cellPad}>Duration</th>
            <th className={cellPad}>Status</th>
            <th className={cellPad}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.scanId} className="border-t border-white/5 text-slate-200 hover:bg-white/5">
              <td className={`${cellPad} font-mono text-xs`}>{formatClockTime(record.startedAt)}</td>
              <td className={cellPad}>{record.networksFound}</td>
              <td className={`${cellPad} text-emerald-300`}>{record.verifiedCount}</td>
              <td className={`${cellPad} text-amber-300`}>{record.suspiciousCount}</td>
              <td className={`${cellPad} text-red-300`}>{record.rogueCount}</td>
              <td className={cellPad}>{record.duration !== null ? `${record.duration.toFixed(1)}s` : '—'}</td>
              <td className={cellPad}>{record.status}</td>
              <td className={cellPad}>
                <button onClick={() => onSelect(record)} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 hover:bg-slate-700">View Report</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
