import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Wifi, ShieldAlert } from 'lucide-react'
import { useWirelessMonitoring } from '../../hooks/useWirelessMonitoring'
import { formatAlertType, formatSecurityStatus } from '../../utils/networkClassification'

const MAX_RESULTS_PER_GROUP = 5
const DEBOUNCE_MS = 150

// Searches the same live data already held in context — no separate API call,
// no fake results. Debounced so fast typing doesn't re-filter on every key.
export function GlobalSearch() {
  const { networks, alerts } = useWirelessMonitoring()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const matchedNetworks = useMemo(() => {
    if (!debouncedQuery) return []
    return networks
      .filter((network) => network.ssid.toLowerCase().includes(debouncedQuery) || network.bssid.toLowerCase().includes(debouncedQuery))
      .slice(0, MAX_RESULTS_PER_GROUP)
  }, [networks, debouncedQuery])

  const matchedAlerts = useMemo(() => {
    if (!debouncedQuery) return []
    return alerts
      .filter((alert) => (alert.ssid ?? '').toLowerCase().includes(debouncedQuery) || (alert.bssid ?? '').toLowerCase().includes(debouncedQuery) || alert.type.toLowerCase().includes(debouncedQuery))
      .slice(0, MAX_RESULTS_PER_GROUP)
  }, [alerts, debouncedQuery])

  const hasResults = matchedNetworks.length > 0 || matchedAlerts.length > 0

  const goTo = (path: string) => {
    navigate(path)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="flex items-center gap-2 rounded-xl border border-sg-border bg-[#0a121f] px-3 py-2 focus-within:border-cyan-400/40">
        <Search className="h-4 w-4 shrink-0 text-slate-500" />
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search networks, devices, alerts..."
          aria-label="Search networks, devices, and alerts"
          className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
        />
      </div>

      {open && debouncedQuery && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-xl border border-sg-border bg-[#0a121f] p-2 shadow-soft">
          {!hasResults && <p className="px-2 py-3 text-center text-xs text-slate-500">No matches for "{query}"</p>}

          {matchedNetworks.length > 0 && (
            <div className="mb-1">
              <p className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">Networks</p>
              {matchedNetworks.map((network) => (
                <button
                  key={network.bssid}
                  onClick={() => goTo('/networks')}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                >
                  <Wifi className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                  <span className="truncate">{network.ssid || '(hidden)'}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-500">{formatSecurityStatus(network.securityStatus)}</span>
                </button>
              ))}
            </div>
          )}

          {matchedAlerts.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">Alerts</p>
              {matchedAlerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => goTo('/alerts')}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                >
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                  <span className="truncate">{formatAlertType(alert.type)} &middot; {alert.ssid || alert.bssid}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-500">{alert.severity}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
