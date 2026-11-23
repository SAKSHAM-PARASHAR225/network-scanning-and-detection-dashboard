import type { AlertType, Encryption, SecurityAlert, SecurityStatus, WirelessNetwork } from '../types'

export function isWeakEncryption(encryption: Encryption): boolean {
  return encryption === 'WEP' || encryption === 'OPEN'
}

export function postureBucket(status: SecurityStatus): 'secure' | 'warning' | 'critical' {
  if (status === 'VERIFIED') return 'secure'
  if (status === 'ROGUE' || status === 'POSSIBLE_EVIL_TWIN') return 'critical'
  return 'warning'
}

export const DEFAULT_WEAK_SIGNAL_THRESHOLD = -70

// weakThreshold is the Settings page's "Weak Signal Threshold" — anything
// weaker than it is "Weak". The Strong/Medium split above it is fixed.
export function signalBucket(signal: number, weakThreshold: number = DEFAULT_WEAK_SIGNAL_THRESHOLD): 'Strong' | 'Medium' | 'Weak' {
  if (signal >= -55) return 'Strong'
  if (signal >= weakThreshold) return 'Medium'
  return 'Weak'
}

export function buildEncryptionDistribution(networks: WirelessNetwork[]) {
  const order: Encryption[] = ['WPA3', 'WPA2', 'WPA', 'WEP', 'OPEN', 'UNKNOWN']
  return order
    .map((name) => ({ name, value: networks.filter((network) => network.encryption === name).length }))
    .filter((entry) => entry.name !== 'UNKNOWN' || entry.value > 0)
}

export function buildSignalDistribution(networks: WirelessNetwork[], weakThreshold: number = DEFAULT_WEAK_SIGNAL_THRESHOLD) {
  const buckets: Record<'Strong' | 'Medium' | 'Weak', number> = { Strong: 0, Medium: 0, Weak: 0 }
  networks.forEach((network) => {
    if (network.signal !== null) buckets[signalBucket(network.signal, weakThreshold)] += 1
  })
  return buckets
}

const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  ROGUE_AP: 'Rogue AP',
  POSSIBLE_EVIL_TWIN: 'Possible Evil Twin',
  UNKNOWN_AP: 'Unverified AP',
  WEAK_ENCRYPTION: 'Weak Encryption',
  SIGNAL_ANOMALY: 'Signal Anomaly',
}

export function formatAlertType(type: AlertType): string {
  return ALERT_TYPE_LABEL[type] ?? type
}

const SECURITY_STATUS_LABEL: Record<SecurityStatus, string> = {
  VERIFIED: 'Verified',
  UNVERIFIED: 'Unverified',
  SUSPICIOUS: 'Suspicious',
  POSSIBLE_EVIL_TWIN: 'Possible Evil Twin',
  ROGUE: 'Rogue',
}

export function formatSecurityStatus(status: SecurityStatus): string {
  return SECURITY_STATUS_LABEL[status] ?? status
}

export function formatClockTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function countActiveAlertsBySeverity(alerts: SecurityAlert[]) {
  const open = alerts.filter((alert) => alert.status === 'OPEN')
  return {
    critical: open.filter((alert) => alert.severity === 'CRITICAL').length,
    high: open.filter((alert) => alert.severity === 'HIGH').length,
    medium: open.filter((alert) => alert.severity === 'MEDIUM').length,
    low: open.filter((alert) => alert.severity === 'LOW').length,
    info: open.filter((alert) => alert.severity === 'INFO').length,
  }
}
