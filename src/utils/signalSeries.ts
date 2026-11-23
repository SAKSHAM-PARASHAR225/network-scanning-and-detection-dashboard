import type { SecurityStatus, WirelessNetwork } from '../types'

export type SignalFilter = 'ALL' | 'VERIFIED' | 'UNVERIFIED' | 'ROGUE'

export const SIGNAL_FILTERS: SignalFilter[] = ['ALL', 'VERIFIED', 'UNVERIFIED', 'ROGUE']

// Direct 1:1 mapping onto the backend's own classifications. SUSPICIOUS and
// POSSIBLE_EVIL_TWIN are deliberately not folded into ROGUE — they only
// appear under ALL, because the analyzer did not classify them as rogue.
const FILTER_STATUS: Record<Exclude<SignalFilter, 'ALL'>, SecurityStatus> = {
  VERIFIED: 'VERIFIED',
  UNVERIFIED: 'UNVERIFIED',
  ROGUE: 'ROGUE',
}

export function matchesSignalFilter(network: WirelessNetwork, filter: SignalFilter) {
  return filter === 'ALL' || network.securityStatus === FILTER_STATUS[filter]
}

export interface SignalSeriesDefinition {
  // BSSID — unique, unlike SSID (several APs, or an evil twin, can share one).
  key: string
  label: string
  color: string
}

function hashBssid(bssid: string) {
  let hash = 0
  for (let i = 0; i < bssid.length; i += 1) hash = (hash * 31 + bssid.charCodeAt(i)) >>> 0
  return hash
}

// Color follows the BSSID, not its position in the list, so a network keeps
// the same line color when the filter adds or removes other networks.
export function colorForBssid(bssid: string) {
  const hue = (hashBssid(bssid) * 137.508) % 360
  return `hsl(${hue.toFixed(0)}, 80%, 62%)`
}

export function buildSeries(networks: WirelessNetwork[]): SignalSeriesDefinition[] {
  const ssidCounts = new Map<string, number>()
  networks.forEach((network) => {
    const ssid = network.ssid || '(hidden)'
    ssidCounts.set(ssid, (ssidCounts.get(ssid) ?? 0) + 1)
  })

  return networks.map((network) => {
    const ssid = network.ssid || '(hidden)'
    const label = (ssidCounts.get(ssid) ?? 0) > 1 ? `${ssid} · ${network.bssid.slice(-5)}` : ssid
    return { key: network.bssid, label, color: colorForBssid(network.bssid) }
  })
}
