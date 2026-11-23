import type { ChangeEvent } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'

interface NetworkFiltersProps {
  query: string
  security: string
  encryption: string
  channel: string
  signal: string
  onQueryChange: (value: string) => void
  onSecurityChange: (value: string) => void
  onEncryptionChange: (value: string) => void
  onChannelChange: (value: string) => void
  onSignalChange: (value: string) => void
  onClear: () => void
}

export function NetworkFilters({
  query,
  security,
  encryption,
  channel,
  signal,
  onQueryChange,
  onSecurityChange,
  onEncryptionChange,
  onChannelChange,
  onSignalChange,
  onClear,
}: NetworkFiltersProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0d1722] p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
          <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-300" />
          Live filters
        </div>
        <button
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/3 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.15em] text-slate-300 transition hover:border-cyan-400/30 hover:text-cyan-200"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
        <label className="flex items-center gap-2 rounded-xl border border-white/8 bg-[#07121e] px-3 py-2.5 text-slate-300 shadow-inner shadow-black/20">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            aria-label="Search network"
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
            placeholder="Search SSID / BSSID"
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </label>

        <select value={security} onChange={(event) => onSecurityChange(event.target.value)} className="rounded-xl border border-white/8 bg-[#07121e] px-3 py-2.5 text-sm text-slate-100 focus:border-cyan-400/40 focus:outline-none">
          <option value="All">Security: All</option>
          <option value="VERIFIED">Verified</option>
          <option value="UNVERIFIED">Unverified</option>
          <option value="SUSPICIOUS">Suspicious</option>
          <option value="POSSIBLE_EVIL_TWIN">Possible Evil Twin</option>
          <option value="ROGUE">Rogue</option>
        </select>

        <select value={encryption} onChange={(event) => onEncryptionChange(event.target.value)} className="rounded-xl border border-white/8 bg-[#07121e] px-3 py-2.5 text-sm text-slate-100 focus:border-cyan-400/40 focus:outline-none">
          <option value="All">Encryption: All</option>
          <option value="WPA3">WPA3</option>
          <option value="WPA2">WPA2</option>
          <option value="WPA">WPA</option>
          <option value="WEP">WEP</option>
          <option value="OPEN">OPEN</option>
        </select>

        <select value={channel} onChange={(event) => onChannelChange(event.target.value)} className="rounded-xl border border-white/8 bg-[#07121e] px-3 py-2.5 text-sm text-slate-100 focus:border-cyan-400/40 focus:outline-none">
          <option value="All">Channel: All</option>
          <option value="1">1</option>
          <option value="6">6</option>
          <option value="11">11</option>
        </select>

        <select value={signal} onChange={(event) => onSignalChange(event.target.value)} className="rounded-xl border border-white/8 bg-[#07121e] px-3 py-2.5 text-sm text-slate-100 focus:border-cyan-400/40 focus:outline-none">
          <option value="All">Signal: All</option>
          <option value="Strong">Strong</option>
          <option value="Medium">Medium</option>
          <option value="Weak">Weak</option>
        </select>
      </div>
    </div>
  )
}
