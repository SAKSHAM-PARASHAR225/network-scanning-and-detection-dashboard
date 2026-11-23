import { useMemo, useState } from 'react'
import { WirelessRadar, RADAR_STATUS_COLOR, RADAR_STATUS_LABEL } from '../components/WirelessRadar'
import { ScannerStatus } from '../components/ScannerStatus'
import { NetworkDetails } from '../components/networks/NetworkDetails'
import { Modal } from '../components/common/Modal'
import { EmptyState } from '../components/common/EmptyState'
import { useWirelessMonitoring } from '../hooks/useWirelessMonitoring'
import { useNetworkActions } from '../hooks/useNetworkActions'
import type { SecurityStatus, WirelessNetwork } from '../types'
import { formatClockTime } from '../utils/networkClassification'

export function LiveRadarPage() {
  const { networks, lastScanAt } = useWirelessMonitoring()
  const { trustNetwork, trustingBssid } = useNetworkActions()
  const [selected, setSelected] = useState<WirelessNetwork | null>(null)

  const visibleNetworks = useMemo(() => networks.filter((network) => network.isCurrentlyVisible), [networks])

  const counts = useMemo(() => {
    const tally: Record<SecurityStatus, number> = {
      VERIFIED: 0, UNVERIFIED: 0, SUSPICIOUS: 0, POSSIBLE_EVIL_TWIN: 0, ROGUE: 0,
    }
    visibleNetworks.forEach((network) => { tally[network.securityStatus] += 1 })
    return tally
  }, [visibleNetworks])

  const sortedForList = useMemo(
    () => [...visibleNetworks].sort((a, b) => (b.signal ?? -100) - (a.signal ?? -100)),
    [visibleNetworks],
  )

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-400">Real-time visualization</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-100">Live Wireless Radar</h2>
        </div>
        <ScannerStatus variant="pill" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="glass-card rounded-2xl p-5">
          <WirelessRadar hideLegend />
        </div>

        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Legend</h3>
            <div className="space-y-2.5">
              {(Object.keys(RADAR_STATUS_COLOR) as SecurityStatus[]).map((status) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RADAR_STATUS_COLOR[status] }} />
                    {RADAR_STATUS_LABEL[status]}
                  </div>
                  <span className="font-mono text-slate-400">{counts[status]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card max-h-[420px] overflow-y-auto rounded-2xl p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">On Radar ({visibleNetworks.length})</h3>
            {sortedForList.length === 0 ? (
              <EmptyState title="Waiting for scanner data..." description="Networks in range will appear here as soon as the backend reports them." />
            ) : (
              <ul className="space-y-1.5">
                {sortedForList.map((network) => (
                  <li key={network.bssid}>
                    <button
                      onClick={() => setSelected(network)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-white/5"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: RADAR_STATUS_COLOR[network.securityStatus] }} />
                      <span className="min-w-0 flex-1 truncate text-slate-200">{network.ssid || '(hidden SSID)'}</span>
                      <span className="shrink-0 font-mono text-xs text-slate-500">{network.signal !== null ? `${network.signal} dBm` : '—'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {lastScanAt && <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-slate-600">Last scan {formatClockTime(lastScanAt)}</p>}
          </div>
        </div>
      </div>

      <Modal isOpen={Boolean(selected)} title="Network Details" onClose={() => setSelected(null)} footer={null}>
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
