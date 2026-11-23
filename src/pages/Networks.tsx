import { useMemo, useState } from 'react'
import { RadioTower, ShieldAlert, ShieldCheck, ShieldX, Wifi } from 'lucide-react'
import type { WirelessNetwork } from '../types'
import { Button } from '../components/common/Button'
import { EmptyState } from '../components/common/EmptyState'
import { Modal } from '../components/common/Modal'
import { NetworkDetails } from '../components/networks/NetworkDetails'
import { NetworkFilters } from '../components/networks/NetworkFilters'
import { NetworkTable } from '../components/networks/NetworkTable'
import { ScannerStatus } from '../components/ScannerStatus'
import { useWirelessMonitoring } from '../hooks/useWirelessMonitoring'
import { useAppSettings } from '../hooks/useAppSettings'
import { useNetworkActions } from '../hooks/useNetworkActions'
import { useScanTrigger } from '../hooks/useScanTrigger'

export function NetworksPage() {
  const { networks: allNetworks, scannerStatus } = useWirelessMonitoring()
  const { settings } = useAppSettings()
  const { trustNetwork, trustingBssid } = useNetworkActions()
  const { triggerScan, isScanning, disabled: scanDisabled } = useScanTrigger()
  const networks = useMemo(() => allNetworks.filter((network) => network.isCurrentlyVisible), [allNetworks])
  const [selected, setSelected] = useState<WirelessNetwork | null>(null)
  const [query, setQuery] = useState('')
  const [security, setSecurity] = useState('All')
  const [encryption, setEncryption] = useState('All')
  const [channel, setChannel] = useState('All')
  const [signal, setSignal] = useState('All')

  const filtered = useMemo(() => networks.filter((network) => {
    const q = query.toLowerCase()
    const matchesQuery = !q || network.ssid.toLowerCase().includes(q) || network.bssid.toLowerCase().includes(q)
    const matchesSecurity = security === 'All' || network.securityStatus === security
    const matchesEncryption = encryption === 'All' || network.encryption === encryption
    const matchesChannel = channel === 'All' || String(network.channel) === channel
    const matchesSignal = signal === 'All'
      || (network.signal !== null && signal === 'Strong' && network.signal >= -55)
      || (network.signal !== null && signal === 'Medium' && network.signal < -55 && network.signal >= settings.weakSignalThreshold)
      || (network.signal !== null && signal === 'Weak' && network.signal < settings.weakSignalThreshold)

    return matchesQuery && matchesSecurity && matchesEncryption && matchesChannel && matchesSignal
  }), [networks, query, security, encryption, channel, signal, settings.weakSignalThreshold])

  const metrics = useMemo(() => {
    const total = networks.length
    const secure = networks.filter((network) => network.securityStatus === 'VERIFIED').length
    const unverified = networks.filter((network) => network.securityStatus === 'UNVERIFIED').length
    const critical = networks.filter((network) => network.securityStatus === 'ROGUE' || network.securityStatus === 'POSSIBLE_EVIL_TWIN').length

    return [
      { label: 'Total Networks', value: total.toString(), detail: 'Live inventory', icon: Wifi, tone: 'cyan' },
      { label: 'Secure', value: `${secure}`, detail: 'Verified / trusted', icon: ShieldCheck, tone: 'green' },
      { label: 'Unverified', value: `${unverified}`, detail: 'Not yet trusted', icon: ShieldAlert, tone: 'amber' },
      { label: 'Rogue / Critical', value: `${critical}`, detail: 'Needs investigation', icon: ShieldX, tone: 'red' },
    ]
  }, [networks])

  return (
    <div className="space-y-6 p-5 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300">Network inventory</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Networks</h2>
          <p className="mt-1 text-sm text-slate-400">View and analyze all detected wireless networks</p>
        </div>
        <div className="flex items-center gap-3">
          <ScannerStatus variant="pill" />
          <Button variant="primary" onClick={() => void triggerScan()} disabled={scanDisabled} icon={<RadioTower className="h-4 w-4" />}>
            {isScanning ? 'Scanning...' : 'Scan Now'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <div key={label} className="glass-card glass-card-hover rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className={`rounded-xl border p-2 ${tone === 'cyan' ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300' : tone === 'green' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : tone === 'amber' ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-red-400/20 bg-red-400/10 text-red-300'}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live</span>
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-100">{value}</div>
            <p className="mt-1 text-xs text-slate-400">{detail}</p>
          </div>
        ))}
      </div>

      <NetworkFilters query={query} security={security} encryption={encryption} channel={channel} signal={signal} onQueryChange={setQuery} onSecurityChange={setSecurity} onEncryptionChange={setEncryption} onChannelChange={setChannel} onSignalChange={setSignal} onClear={() => { setQuery(''); setSecurity('All'); setEncryption('All'); setChannel('All'); setSignal('All') }} />

      {networks.length === 0 ? (
        <EmptyState
          title={scannerStatus === 'OFFLINE' ? 'Scanner backend unavailable' : 'Waiting for scanner data...'}
          description={scannerStatus === 'OFFLINE' ? 'Reconnecting to the monitoring backend automatically.' : 'Nearby access points will appear here as soon as the backend scanner reports them.'}
        />
      ) : filtered.length > 0 ? (
        <NetworkTable networks={filtered} onView={setSelected} onInvestigate={setSelected} />
      ) : (
        <EmptyState title="No wireless networks match the current filters" description="Try clearing filters to see the full live inventory." />
      )}

      <Modal isOpen={Boolean(selected)} title="Network Details" onClose={() => setSelected(null)}>
        <NetworkDetails
          network={selected}
          onClose={() => setSelected(null)}
          onTrust={async (network) => { await trustNetwork(network); setSelected(null) }}
          trusting={selected ? trustingBssid === selected.bssid : false}
        />
      </Modal>
    </div>
  )
}
