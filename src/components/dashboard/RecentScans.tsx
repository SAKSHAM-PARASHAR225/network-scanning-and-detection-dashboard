import { Link } from 'react-router-dom'
import { useWirelessMonitoring } from '../../hooks/useWirelessMonitoring'
import { EmptyState } from '../common/EmptyState'

const SHOWN = 6

export function RecentScans() {
  const { recentScans } = useWirelessMonitoring()

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">Scan History</h3>
        <Link to="/history" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300 hover:text-cyan-200">View all</Link>
      </div>
      {recentScans.length === 0 ? (
        <EmptyState title="No scans yet" description="Completed scans appear here as the scanner runs." />
      ) : (
        <ul className="space-y-2">
          {recentScans.slice(0, SHOWN).map((scan) => (
            <li key={scan.id} className="animate-sg-fade rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-300">{new Date(scan.startedAt).toLocaleTimeString()}</span>
                <span className={scan.status === 'COMPLETED' ? 'text-emerald-300' : scan.status === 'FAILED' ? 'text-red-300' : 'text-cyan-300'}>{scan.status}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                <span><span className="font-mono text-slate-100">{scan.networksFound}</span> networks</span>
                <span className="flex gap-2 font-mono">
                  <span className="text-emerald-300">{scan.verifiedCount}</span>
                  <span className="text-amber-300">{scan.suspiciousCount}</span>
                  <span className="text-red-300">{scan.rogueCount}</span>
                </span>
                <span className="font-mono">{scan.duration !== null ? `${scan.duration.toFixed(1)}s` : '--'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
