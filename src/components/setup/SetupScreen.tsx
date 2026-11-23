import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Shield, ShieldCheck, Wifi } from 'lucide-react'
import { ApiUnavailableError, networkApi } from '../../services/networkApi'
import { useWirelessMonitoring } from '../../hooks/useWirelessMonitoring'
import type { DiscoveredNetwork } from '../../types'
import { Button } from '../common/Button'
import { EmptyState } from '../common/EmptyState'
import { LoadingState } from '../common/LoadingState'

// Shown instead of the normal dashboard while trusted_access_points is empty.
// The administrator picks which currently-visible APs are authorised; only
// then does POST /api/setup/verify establish the baseline and hand off to
// continuous monitoring.
export function SetupScreen() {
  const { refresh, trustedCount } = useWirelessMonitoring()
  const [networks, setNetworks] = useState<DiscoveredNetwork[]>([])
  const [loading, setLoading] = useState(true)
  const [rescanning, setRescanning] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const loadDiscovered = async () => {
    setError(null)
    try {
      const response = await networkApi.getDiscoveredNetworks()
      if (response.success) {
        setNetworks(response.data)
      } else {
        setError(response.error || 'Discovery scan failed')
      }
    } catch (err) {
      setError(err instanceof ApiUnavailableError ? 'Scanner backend unavailable' : 'Discovery scan failed')
    } finally {
      setLoading(false)
      setRescanning(false)
    }
  }

  useEffect(() => {
    void loadDiscovered()
  }, [])

  const grouped = useMemo(() => {
    const bySsid = new Map<string, DiscoveredNetwork[]>()
    networks.forEach((network) => {
      const key = network.ssid || '(hidden SSID)'
      const list = bySsid.get(key) ?? []
      list.push(network)
      bySsid.set(key, list)
    })
    return Array.from(bySsid.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [networks])

  const toggle = (bssid: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(bssid)) next.delete(bssid)
      else next.add(bssid)
      return next
    })
  }

  const handleRescan = async () => {
    setRescanning(true)
    try {
      await networkApi.rescanForSetup()
    } catch {
      // fall through to reload — discovered-networks will surface the error
    }
    await loadDiscovered()
  }

  const handleVerify = async () => {
    if (selected.size === 0) return
    setVerifying(true)
    try {
      await networkApi.verifyTrustedNetworks(Array.from(selected))
      await refresh()
    } catch {
      setError('Could not save the trusted baseline — backend unavailable')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#070b12] p-6">
      <div className="w-full max-w-4xl space-y-6 py-10">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 shadow-[0_0_16px_rgba(84,210,255,0.18)]">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-400">First-run setup</p>
            <h1 className="text-2xl font-semibold text-slate-100">Establish the trusted network baseline</h1>
          </div>
        </div>

        <p className="max-w-2xl text-sm text-slate-400">
          No trusted access points are configured yet. The scanner has swept the wireless environment and
          found the networks below. Select the access points you administer or otherwise trust — every
          other AP will be monitored as unverified, and anything impersonating a trusted SSID will be
          flagged. Trust is tied to BSSID, not SSID, so pick the specific radios you control.
        </p>

        <div className="flex items-center justify-between glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Wifi className="h-4 w-4 text-cyan-300" />
            {networks.length} access point{networks.length === 1 ? '' : 's'} discovered
            {trustedCount > 0 && <span className="text-slate-500"> · {trustedCount} already trusted</span>}
          </div>
          <Button variant="secondary" onClick={() => void handleRescan()} disabled={rescanning} icon={<RefreshCw className={`h-4 w-4 ${rescanning ? 'animate-spin' : ''}`} />}>
            {rescanning ? 'Scanning...' : 'Rescan'}
          </Button>
        </div>

        {loading ? (
          <LoadingState label="Running baseline discovery scan" />
        ) : error ? (
          <EmptyState title="Scanner backend unavailable" description={error} />
        ) : networks.length === 0 ? (
          <EmptyState title="No wireless networks detected" description="Move within range of your access points and rescan." />
        ) : (
          <div className="space-y-4">
            <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
              {grouped.map(([ssid, group]) => (
                <div key={ssid} className="rounded-2xl border border-white/8 bg-[#0d1722] p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-100">{ssid}</p>
                  <div className="space-y-1.5">
                    {group.map((network) => (
                      <label
                        key={network.bssid}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#07121e] px-3 py-2.5 text-sm text-slate-200 hover:border-cyan-400/30"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selected.has(network.bssid)}
                            onChange={() => toggle(network.bssid)}
                            className="h-4 w-4 accent-cyan-400"
                          />
                          <span className="font-mono text-xs text-slate-300">{network.bssid}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>{network.channel !== null ? `ch ${network.channel}` : '—'}</span>
                          <span>{network.band ?? '—'}</span>
                          <span>{network.encryption}</span>
                          <span className="w-14 text-right font-mono">{network.signal !== null ? `${network.signal} dBm` : '—'}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between glass-card rounded-2xl p-4">
              <span className="text-sm text-slate-400">{selected.size} selected</span>
              <Button
                variant="primary"
                onClick={() => void handleVerify()}
                disabled={selected.size === 0 || verifying}
                icon={<ShieldCheck className="h-4 w-4" />}
              >
                {verifying ? 'Saving trusted baseline...' : `Verify ${selected.size || ''} as Trusted`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
