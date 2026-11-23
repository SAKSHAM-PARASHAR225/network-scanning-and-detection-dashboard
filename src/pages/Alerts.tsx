import { useMemo, useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { EmptyState } from '../components/common/EmptyState'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { AlertTable } from '../components/alerts/AlertTable'
import { AlertDetails } from '../components/alerts/AlertDetails'
import { ScannerStatus } from '../components/ScannerStatus'
import { useWirelessMonitoring } from '../hooks/useWirelessMonitoring'
import { useNetworkActions } from '../hooks/useNetworkActions'
import type { SecurityAlert, Severity } from '../types'
import { countActiveAlertsBySeverity } from '../utils/networkClassification'

const SEVERITY_TABS: Array<{ key: 'All' | Severity; label: string }> = [
  { key: 'All', label: 'All' },
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'HIGH', label: 'High' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'LOW', label: 'Low' },
]

export function AlertsPage() {
  const { alerts, scannerStatus } = useWirelessMonitoring()
  const { resolveAlert, resolveAlerts, resolvingAlertId, bulkResolving } = useNetworkActions()
  const [selected, setSelected] = useState<SecurityAlert | null>(null)
  const [search, setSearch] = useState('')
  const [severityTab, setSeverityTab] = useState<'All' | Severity>('All')
  const [type, setType] = useState('All')
  const [status, setStatus] = useState('All')

  const filtered = useMemo(() => alerts.filter((alert) => {
    const q = search.toLowerCase()
    const matchesQuery = !q
      || (alert.ssid ?? '').toLowerCase().includes(q)
      || (alert.bssid ?? '').toLowerCase().includes(q)
      || alert.type.toLowerCase().includes(q)
    const matchesSeverity = severityTab === 'All' || alert.severity === severityTab
    const matchesType = type === 'All' || alert.type === type
    const matchesStatus = status === 'All' || alert.status === status
    return matchesQuery && matchesSeverity && matchesType && matchesStatus
  }), [alerts, search, severityTab, type, status])

  const counts = useMemo(() => countActiveAlertsBySeverity(alerts), [alerts])
  const openInView = useMemo(() => filtered.filter((alert) => alert.status === 'OPEN'), [filtered])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-400">Threat monitoring</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-100">Security Alerts</h2>
          <p className="mt-1 text-sm text-slate-400">Active threat monitoring and investigation queue</p>
        </div>
        <div className="flex items-center gap-3">
          <ScannerStatus variant="pill" />
          <Button
            variant="secondary"
            onClick={() => void resolveAlerts(openInView)}
            disabled={openInView.length === 0 || bulkResolving}
            icon={<CheckCheck className="h-4 w-4" />}
          >
            {bulkResolving ? 'Resolving...' : `Resolve All (${openInView.length})`}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="glass-card rounded-2xl p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Total Alerts</p><p className="mt-3 text-3xl font-semibold text-slate-100">{alerts.length}</p></div>
        <div className="glass-card rounded-2xl p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Critical</p><p className="mt-3 text-3xl font-semibold text-red-300">{counts.critical}</p></div>
        <div className="glass-card rounded-2xl p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">High</p><p className="mt-3 text-3xl font-semibold text-orange-300">{counts.high}</p></div>
        <div className="glass-card rounded-2xl p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Medium</p><p className="mt-3 text-3xl font-semibold text-yellow-300">{counts.medium}</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SEVERITY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSeverityTab(tab.key)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${severityTab === tab.key ? 'border border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border border-sg-border bg-[#0a121f] text-slate-400 hover:text-slate-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input aria-label="Search alerts" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search alerts" className="rounded-xl border border-sg-border bg-[#050b14] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40" />
          <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-xl border border-sg-border bg-[#050b14] px-3 py-2 text-sm text-slate-100">
            <option value="All">Alert Type: All</option>
            <option value="ROGUE_AP">Rogue AP</option>
            <option value="POSSIBLE_EVIL_TWIN">Possible Evil Twin</option>
            <option value="UNKNOWN_AP">Unverified AP</option>
            <option value="WEAK_ENCRYPTION">Weak Encryption</option>
            <option value="SIGNAL_ANOMALY">Signal Anomaly</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-sg-border bg-[#050b14] px-3 py-2 text-sm text-slate-100">
            <option value="All">Status: All</option>
            <option value="OPEN">Open</option>
            <option value="RESOLVED">Resolved</option>
          </select>
          <button onClick={() => { setSearch(''); setSeverityTab('All'); setType('All'); setStatus('All') }} className="rounded-xl border border-sg-border bg-[#050b14] px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">Clear Filters</button>
        </div>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          title={scannerStatus === 'OFFLINE' ? 'Scanner backend unavailable' : 'No active security alerts'}
          description={scannerStatus === 'OFFLINE' ? 'Reconnecting to the monitoring backend automatically.' : 'The monitoring feed is clear for now.'}
        />
      ) : filtered.length > 0 ? (
        <AlertTable alerts={filtered} onSelect={setSelected} />
      ) : (
        <EmptyState title="No alerts match the current filters" description="Try clearing filters to see the full alert feed." />
      )}

      <Modal isOpen={Boolean(selected)} title="Investigation Panel" onClose={() => setSelected(null)}>
        <AlertDetails
          alert={selected}
          onClose={() => setSelected(null)}
          onResolve={async (alert) => { await resolveAlert(alert); setSelected(null) }}
          resolving={selected ? resolvingAlertId === selected.id : false}
        />
      </Modal>
    </div>
  )
}
