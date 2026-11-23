import { useMemo, useState } from 'react'
import { Download, RefreshCw, ShieldAlert, ShieldCheck, ShieldX, Wifi } from 'lucide-react'
import type { SecurityAlert, WirelessNetwork } from '../types'
import { Button } from '../components/common/Button'
import { EmptyState } from '../components/common/EmptyState'
import { Modal } from '../components/common/Modal'
import { StatCard } from '../components/dashboard/StatCard'
import { AlertPreview } from '../components/dashboard/AlertPreview'
import { LiveNetworkIntelligence, type IntelSource } from '../components/dashboard/LiveNetworkIntelligence'
import { RecentScans } from '../components/dashboard/RecentScans'
import { ScanStatusCard } from '../components/dashboard/ScanStatusCard'
import { NetworkTable } from '../components/networks/NetworkTable'
import { NetworkDetails } from '../components/networks/NetworkDetails'
import { WirelessRadar } from '../components/WirelessRadar'
import { ScannerStatus } from '../components/ScannerStatus'
import { useWirelessMonitoring } from '../hooks/useWirelessMonitoring'
import { useAppSettings } from '../hooks/useAppSettings'
import { useNetworkActions } from '../hooks/useNetworkActions'
import { exportToCsv } from '../utils/exportCsv'

export function Dashboard() {
  const { networks, alerts, refresh } = useWirelessMonitoring()
  const { settings } = useAppSettings()
  const { trustNetwork, resolveAlert, trustingBssid, resolvingAlertId } = useNetworkActions()
  const [selectedNetwork, setSelectedNetwork] = useState<WirelessNetwork | null>(null)
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null)
  const [tableFilter, setTableFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [encryptionFilter, setEncryptionFilter] = useState('All')
  const [channelFilter, setChannelFilter] = useState('All')
  const [signalFilter, setSignalFilter] = useState('All')
  const [radarSelectedBssid, setRadarSelectedBssid] = useState<string | null>(null)
  const [hoveredBssid, setHoveredBssid] = useState<string | null>(null)

  // Everything on this page describes "right now", so it all shares one
  // scope: currently-visible networks. A network that hasn't been seen in
  // hours (even a VERIFIED one) stays in the database but drops out of every
  // count and chart here, exactly like it drops off the radar.
  const visibleNetworks = useMemo(() => networks.filter((network) => network.isCurrentlyVisible), [networks])

  const filteredNetworks = useMemo(() => {
    return visibleNetworks.filter((network) => {
      const matchesQuery = !searchQuery || network.ssid.toLowerCase().includes(searchQuery.toLowerCase()) || network.bssid.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesSecurity = tableFilter === 'All' || network.securityStatus === tableFilter
      const matchesEncryption = encryptionFilter === 'All' || network.encryption === encryptionFilter
      const matchesChannel = channelFilter === 'All' || String(network.channel) === channelFilter
      const matchesSignal = signalFilter === 'All'
        || (network.signal !== null && signalFilter === 'Strong' && network.signal >= -55)
        || (network.signal !== null && signalFilter === 'Medium' && network.signal < -55 && network.signal >= settings.weakSignalThreshold)
        || (network.signal !== null && signalFilter === 'Weak' && network.signal < settings.weakSignalThreshold)

      return matchesQuery && matchesSecurity && matchesEncryption && matchesChannel && matchesSignal
    })
  }, [visibleNetworks, searchQuery, tableFilter, encryptionFilter, channelFilter, signalFilter, settings.weakSignalThreshold])

  const networkSummary = useMemo(() => {
    const count = (...statuses: WirelessNetwork['securityStatus'][]) => visibleNetworks.filter((network) => statuses.includes(network.securityStatus)).length
    return {
      total: visibleNetworks.length,
      secure: count('VERIFIED'),
      unverified: count('UNVERIFIED'),
      suspicious: count('SUSPICIOUS'),
      critical: count('ROGUE', 'POSSIBLE_EVIL_TWIN'),
    }
  }, [visibleNetworks])

  // Intelligence panel priority: the node under the cursor, then the clicked
  // node, then the highest-risk network in range so the panel is never blank.
  // Looked up by BSSID in the live list so it always shows the latest scan.
  const intel = useMemo((): { network: WirelessNetwork | null; source: IntelSource } => {
    const byBssid = (bssid: string | null) => (bssid ? visibleNetworks.find((network) => network.bssid === bssid) ?? null : null)
    const hovered = byBssid(hoveredBssid)
    if (hovered) return { network: hovered, source: 'hovered' }
    const selected = byBssid(radarSelectedBssid)
    if (selected) return { network: selected, source: 'selected' }
    const riskiest = [...visibleNetworks].sort((a, b) => b.riskScore - a.riskScore)[0] ?? null
    return { network: riskiest, source: 'auto' }
  }, [visibleNetworks, hoveredBssid, radarSelectedBssid])

  const handleExport = () => {
    exportToCsv(
      `scanguard-networks-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      visibleNetworks.map((network) => ({
        ssid: network.ssid,
        bssid: network.bssid,
        channel: network.channel ?? '',
        band: network.band ?? '',
        signalDbm: network.signal ?? '',
        encryption: network.encryption,
        securityStatus: network.securityStatus,
        riskScore: network.riskScore,
        lastSeen: network.lastSeen,
      })),
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-5 rounded-2xl glass-card p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">Welcome back, Saksham 👋</h2>
          <p className="mt-1 text-sm text-slate-400">Here's your network security overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => void refresh()} icon={<RefreshCw className="h-4 w-4" />}>Refresh Data</Button>
          <Button variant="secondary" onClick={handleExport} icon={<Download className="h-4 w-4" />}>Export Report</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Networks" value={String(networkSummary.total)} trend={networkSummary.total > 0 ? 'Currently in range' : 'No data yet'} icon={<Wifi className="h-4 w-4" />} tone="cyan" tooltip="Currently visible access points" />
        <StatCard label="Secure" value={String(networkSummary.secure)} trend="Verified / trusted" icon={<ShieldCheck className="h-4 w-4" />} tone="green" tooltip="Networks matching the trusted baseline" />
        <StatCard label="Unverified" value={String(networkSummary.unverified)} trend={networkSummary.suspicious > 0 ? `+${networkSummary.suspicious} flagged suspicious` : 'Not in trusted baseline'} icon={<ShieldAlert className="h-4 w-4" />} tone="yellow" tooltip="Unverified access points (suspicious ones are counted separately)" />
        <StatCard label="Threats" value={String(networkSummary.critical)} trend={networkSummary.critical > 0 ? 'Rogue / evil twin' : 'All clear'} icon={<ShieldX className="h-4 w-4" />} tone="red" tooltip="Rogue access points and possible evil twins" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="glass-card flex flex-col rounded-2xl p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-100">Live Wireless Radar</h3>
            <span className="text-[11px] text-slate-500">Hover a node for details · click to select</span>
          </div>
          <div className="flex flex-1 items-center">
            <WirelessRadar
              className="w-full"
              selectedBssid={radarSelectedBssid}
              onSelect={(network) => setRadarSelectedBssid((current) => (current === network.bssid ? null : network.bssid))}
              onHoverChange={(network) => setHoveredBssid(network?.bssid ?? null)}
            />
          </div>
        </div>
        <LiveNetworkIntelligence network={intel.network} source={intel.source} onInvestigate={setSelectedNetwork} />
      </div>

      <div className="space-y-4 glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">Nearby Wireless Networks</h3>
        </div>
        <div className="mb-4 grid gap-3 lg:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))_auto]">
          <input aria-label="Search SSID or BSSID" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search SSID/BSSID" className="rounded-xl border border-sg-border bg-[#050b14] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40" />
          <select value={tableFilter} onChange={(event) => setTableFilter(event.target.value)} className="rounded-xl border border-sg-border bg-[#050b14] px-3 py-2 text-sm text-slate-100">
            <option value="All">Security Status: All</option>
            <option value="VERIFIED">Verified</option>
            <option value="UNVERIFIED">Unverified</option>
            <option value="SUSPICIOUS">Suspicious</option>
            <option value="POSSIBLE_EVIL_TWIN">Possible Evil Twin</option>
            <option value="ROGUE">Rogue</option>
          </select>
          <select value={encryptionFilter} onChange={(event) => setEncryptionFilter(event.target.value)} className="rounded-xl border border-sg-border bg-[#050b14] px-3 py-2 text-sm text-slate-100"><option value="All">Encryption: All</option><option value="WPA3">WPA3</option><option value="WPA2">WPA2</option><option value="WPA">WPA</option><option value="WEP">WEP</option><option value="OPEN">OPEN</option></select>
          <select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)} className="rounded-xl border border-sg-border bg-[#050b14] px-3 py-2 text-sm text-slate-100"><option value="All">Channel: All</option><option value="1">1</option><option value="6">6</option><option value="11">11</option></select>
          <select value={signalFilter} onChange={(event) => setSignalFilter(event.target.value)} className="rounded-xl border border-sg-border bg-[#050b14] px-3 py-2 text-sm text-slate-100"><option value="All">Signal: All</option><option value="Strong">Strong</option><option value="Medium">Medium</option><option value="Weak">Weak</option></select>
          <button onClick={() => { setSearchQuery(''); setTableFilter('All'); setEncryptionFilter('All'); setChannelFilter('All'); setSignalFilter('All') }} className="rounded-xl border border-sg-border bg-[#050b14] px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">Clear Filters</button>
        </div>

        {visibleNetworks.length === 0 ? (
          <EmptyState title="Waiting for scanner data..." description="The backend scanner hasn't reported any networks yet. This dashboard updates automatically once monitoring is active." />
        ) : filteredNetworks.length > 0 ? (
          <NetworkTable networks={filteredNetworks} onView={setSelectedNetwork} onInvestigate={setSelectedNetwork} />
        ) : (
          <EmptyState title="No networks match the current filters" description="Try clearing filters to see the full live inventory." />
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <AlertPreview alerts={alerts} onSelect={setSelectedAlert} />
        <RecentScans />
        <div className="space-y-4">
          <h3 className="px-1 text-lg font-semibold text-slate-100">System Status</h3>
          <ScanStatusCard />
          <ScannerStatus variant="panel" />
        </div>
      </div>

      <Modal isOpen={Boolean(selectedNetwork)} title="Network Details" onClose={() => setSelectedNetwork(null)} footer={null}>
        <NetworkDetails
          network={selectedNetwork}
          onClose={() => setSelectedNetwork(null)}
          onTrust={async (network) => { await trustNetwork(network); setSelectedNetwork(null) }}
          trusting={selectedNetwork ? trustingBssid === selectedNetwork.bssid : false}
        />
      </Modal>

      <Modal isOpen={Boolean(selectedAlert)} title="Alert Details" onClose={() => setSelectedAlert(null)} footer={null}>
        <div className="space-y-4">
          <p>{selectedAlert?.message}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSelectedAlert(null)}>Close</Button>
            {selectedAlert?.status === 'OPEN' && (
              <Button
                variant="primary"
                disabled={selectedAlert ? resolvingAlertId === selectedAlert.id : false}
                onClick={async () => { if (selectedAlert) { await resolveAlert(selectedAlert); setSelectedAlert(null) } }}
              >
                Mark Resolved
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
