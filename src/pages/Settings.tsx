import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '../components/common/Button'
import { useAppSettings } from '../hooks/useAppSettings'
import { useWirelessMonitoring } from '../hooks/useWirelessMonitoring'
import { networkApi } from '../services/networkApi'
import { exportToCsv } from '../utils/exportCsv'

const TABS = ['General', 'Monitoring', 'Alerts', 'Appearance', 'Data & Export'] as const
type Tab = (typeof TABS)[number]

export function SettingsPage() {
  const { settings, setSetting, saveSettings, resetSettings } = useAppSettings()
  const { networks, alerts, interfaceName, restReachable, connectionStatus, scannerState, scanIntervalSeconds } = useWirelessMonitoring()
  const [tab, setTab] = useState<Tab>('General')
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    const result = await saveSettings()
    setSavedMessage(result.message)
    setSaving(false)
    setTimeout(() => setSavedMessage(null), 3200)
  }

  const handleReset = async () => {
    setSaving(true)
    await resetSettings()
    setSavedMessage('Settings reset to defaults')
    setSaving(false)
    setTimeout(() => setSavedMessage(null), 3200)
  }

  const exportNetworks = () => {
    exportToCsv('scanguard-networks.csv', networks.map((n) => ({
      ssid: n.ssid, bssid: n.bssid, channel: n.channel ?? '', band: n.band ?? '',
      signalDbm: n.signal ?? '', encryption: n.encryption, securityStatus: n.securityStatus,
      riskScore: n.riskScore, isCurrentlyVisible: n.isCurrentlyVisible, lastSeen: n.lastSeen,
    })))
  }

  const exportAlerts = () => {
    exportToCsv('scanguard-alerts.csv', alerts.map((a) => ({
      id: a.id, severity: a.severity, type: a.type, ssid: a.ssid, bssid: a.bssid,
      message: a.message, status: a.status, timestamp: a.timestamp,
    })))
  }

  const exportScanHistory = async () => {
    setExporting('scans')
    try {
      const sessions = await networkApi.getScanHistory(500)
      exportToCsv('scanguard-scan-history.csv', sessions.map((s) => ({
        scanId: s.scanId, startedAt: s.startedAt, completedAt: s.completedAt ?? '',
        networksFound: s.networksFound, verified: s.verifiedCount, suspicious: s.suspiciousCount,
        rogue: s.rogueCount, alertsGenerated: s.alertsGenerated, durationSeconds: s.duration ?? '', status: s.status,
      })))
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-400">Monitoring configuration</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-100">Settings</h2>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-sg-border pb-3">
        {TABS.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${tab === item ? 'border border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'General' && (
        <div className="glass-card rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">System</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <InfoTile label="Backend Connection" value={restReachable ? 'Connected' : 'Unavailable'} tone={restReachable ? 'good' : 'bad'} />
            <InfoTile label="Realtime Socket" value={connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting' : 'Disconnected'} tone={connectionStatus === 'connected' ? 'good' : 'bad'} />
            <InfoTile label="Wireless Interface" value={interfaceName || 'Unknown'} tone="neutral" />
          </div>
          <p className="mt-4 text-xs text-slate-500">ScanGuard v1.0.0 — real-time wireless security monitoring, backed by a continuously running Python scanner.</p>
        </div>
      )}

      {tab === 'Monitoring' && (
        <div className="glass-card rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">Monitoring Settings</h3>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <InfoTile
                label="Network Scan"
                value={scannerState === 'IDLE' || scannerState === 'SCANNING' ? 'Automatic scanning enabled' : scannerState === 'ERROR' ? 'Scanner error' : scannerState === 'WAITING_FOR_SETUP' ? 'Waiting for setup' : 'Scanner offline'}
                tone={scannerState === 'IDLE' || scannerState === 'SCANNING' ? 'good' : 'bad'}
              />
              <InfoTile label="Scan Frequency" value={`${scanIntervalSeconds ?? 10} seconds`} tone="neutral" />
              <InfoTile label="Signal Monitor" value="Every 1 second" tone="neutral" />
            </div>
            <p className="text-xs text-slate-500">The scan cadence is fixed and not user-configurable. A full network scan starts every 10 seconds; the live signal graph is fed separately every second.</p>

            <ToggleRow label="Auto-refresh" checked={settings.autoRefresh} onChange={(v) => setSetting('autoRefresh', v)} />
            <p className="text-xs text-slate-500">When off, the dashboard freezes on the last data it had — scanning keeps running on the backend, but nothing here updates until you click "Refresh Data".</p>

            <ToggleRow label="Notifications" checked={settings.notifications} onChange={(v) => setSetting('notifications', v)} />
            <p className="text-xs text-slate-500">Shows a toast in the corner of the screen the moment a new security alert is detected.</p>
          </div>
        </div>
      )}

      {tab === 'Alerts' && (
        <div className="glass-card rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">Security Thresholds</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Weak Signal Threshold (dBm)</span>
              <input
                type="number"
                value={settings.weakSignalThreshold}
                onChange={(event) => setSetting('weakSignalThreshold', Number(event.target.value))}
                className="w-24 rounded-xl border border-sg-border bg-[#050b14] px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <p className="text-xs text-slate-500">Networks weaker than this are labeled "Weak" signal across the dashboard (Networks table, filters, and Analytics).</p>

            <ToggleRow label="Alert on Open Networks" checked={settings.alertOnOpenNetworks} onChange={(v) => setSetting('alertOnOpenNetworks', v)} />
            <ToggleRow label="Alert on WEP" checked={settings.alertOnWEP} onChange={(v) => setSetting('alertOnWEP', v)} />
            <ToggleRow label="Rogue AP Detection" checked={settings.rogueAPDetection} onChange={(v) => setSetting('rogueAPDetection', v)} />
            <p className="text-xs text-slate-500">These three are enforced by the scanner backend itself — turning one off stops that classification/alert from being generated on the next scan, for every connected dashboard.</p>
          </div>
        </div>
      )}

      {tab === 'Appearance' && (
        <div className="glass-card rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">Interface Settings</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ToggleRow label="Compact Table" checked={settings.compactTable} onChange={(v) => setSetting('compactTable', v)} />
            <ToggleRow label="Show Technical Details" checked={settings.showTechnicalDetails} onChange={(v) => setSetting('showTechnicalDetails', v)} />
          </div>
          <p className="mt-4 text-xs text-slate-500">Compact Table tightens row spacing in the network, alert, and scan history tables. Show Technical Details controls whether BSSID/channel/frequency/band appear in those tables and in network details.</p>
        </div>
      )}

      {tab === 'Data & Export' && (
        <div className="glass-card rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold text-slate-100">Export Data</h3>
          <p className="mb-4 text-xs text-slate-500">Downloads a CSV of what's currently in the system — real data, generated client-side.</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={exportNetworks} icon={<Download className="h-4 w-4" />}>Export Networks ({networks.length})</Button>
            <Button variant="secondary" onClick={exportAlerts} icon={<Download className="h-4 w-4" />}>Export Alerts ({alerts.length})</Button>
            <Button variant="secondary" onClick={() => void exportScanHistory()} disabled={exporting === 'scans'} icon={<Download className="h-4 w-4" />}>
              {exporting === 'scans' ? 'Exporting...' : 'Export Scan History'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        <Button variant="secondary" onClick={() => void handleReset()} disabled={saving}>Reset</Button>
        {savedMessage && <span className="text-xs text-slate-400">{savedMessage}</span>}
      </div>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-slate-300">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-cyan-500' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  )
}

function InfoTile({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-red-300' : 'text-slate-200'
  return (
    <div className="rounded-xl border border-sg-border bg-[#050b14] p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-medium ${color}`}>{value}</p>
    </div>
  )
}
