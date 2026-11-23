import { useEffect, useState } from 'react'
import { RadioTower } from 'lucide-react'
import { ApiUnavailableError, networkApi } from '../services/networkApi'
import { EmptyState } from '../components/common/EmptyState'
import { LoadingState } from '../components/common/LoadingState'
import { Modal } from '../components/common/Modal'
import { Button } from '../components/common/Button'
import { ScanHistoryTable } from '../components/history/ScanHistoryTable'
import { ScannerStatus } from '../components/ScannerStatus'
import { useScanTrigger } from '../hooks/useScanTrigger'
import { useWirelessMonitoring } from '../hooks/useWirelessMonitoring'
import { formatClockTime } from '../utils/networkClassification'
import type { ScanRecord } from '../types'

export function ScanHistoryPage() {
  const { lastScanAt } = useWirelessMonitoring()
  const { triggerScan, isScanning, disabled: scanDisabled } = useScanTrigger()
  const [records, setRecords] = useState<ScanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [selected, setSelected] = useState<ScanRecord | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await networkApi.getScanHistory()
      setRecords(data)
      setUnavailable(false)
    } catch (error) {
      if (error instanceof ApiUnavailableError) setUnavailable(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-pull scan history whenever a scan completes, so a manually triggered
  // scan (or the regular automatic cycle) shows up here without a refresh.
  useEffect(() => {
    if (lastScanAt) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastScanAt])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-400">Monitoring timeline</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-100">Scan History</h2>
          <p className="mt-1 text-sm text-slate-400">View past scans and compare network activity</p>
        </div>
        <div className="flex items-center gap-3">
          <ScannerStatus variant="pill" />
          <Button variant="primary" onClick={() => void triggerScan()} disabled={scanDisabled} icon={<RadioTower className="h-4 w-4" />}>
            {isScanning ? 'Scanning...' : 'New Scan'}
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading scan history" />
      ) : unavailable ? (
        <EmptyState title="Scanner backend unavailable" description="Scan history will load automatically once the backend is reachable." />
      ) : records.length === 0 ? (
        <EmptyState title="Waiting for scan history..." description="Completed scan cycles will appear here as the backend scanner runs." />
      ) : (
        <ScanHistoryTable records={records} onSelect={setSelected} />
      )}

      <Modal isOpen={Boolean(selected)} title="Scan Report" onClose={() => setSelected(null)}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Scan ID</p>
              <p className="mt-2 font-mono text-sm">{selected?.scanId}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Status</p>
              <p className="mt-2 text-sm">{selected?.status}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Started</p>
              <p className="mt-2 font-mono text-sm">{selected ? formatClockTime(selected.startedAt) : '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Duration</p>
              <p className="mt-2 text-sm">{selected?.duration !== null && selected?.duration !== undefined ? `${selected.duration.toFixed(1)}s` : '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Networks Found</p>
              <p className="mt-2 text-sm">{selected?.networksFound}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Alerts Generated</p>
              <p className="mt-2 text-sm">{selected?.alertsGenerated}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80">Secure</p>
              <p className="mt-2 text-sm text-emerald-200">{selected?.verifiedCount}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80">Suspicious</p>
              <p className="mt-2 text-sm text-amber-200">{selected?.suspiciousCount}</p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-red-300/80">Critical</p>
              <p className="mt-2 text-sm text-red-200">{selected?.rogueCount}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setSelected(null)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
