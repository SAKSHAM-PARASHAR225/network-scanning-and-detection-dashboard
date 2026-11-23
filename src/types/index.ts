// Backend-driven classification. The frontend trusts these values as sent by
// the Security Analyzer — it never re-derives or overrides a classification.
// VERIFIED is only granted by an administrator via the trusted baseline.
export type SecurityStatus = 'VERIFIED' | 'UNVERIFIED' | 'SUSPICIOUS' | 'POSSIBLE_EVIL_TWIN' | 'ROGUE'
export type Encryption = 'WPA3' | 'WPA2' | 'WPA' | 'WEP' | 'OPEN' | 'UNKNOWN'
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
export type AlertType =
  | 'ROGUE_AP'
  | 'POSSIBLE_EVIL_TWIN'
  | 'UNKNOWN_AP'
  | 'WEAK_ENCRYPTION'
  | 'SIGNAL_ANOMALY'
export type AlertTriageStatus = 'OPEN' | 'RESOLVED'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface WirelessNetwork {
  id: number
  ssid: string
  bssid: string
  channel: number | null
  frequency?: number | null
  band?: string | null
  signal: number | null
  encryption: Encryption
  securityStatus: SecurityStatus
  riskScore: number
  riskLevel: RiskLevel
  vendor?: string
  trustedBssid?: string
  firstSeen: string
  lastSeen: string
  isCurrentlyVisible: boolean
}

export interface SecurityAlert {
  id: number
  networkId?: number | null
  ssid: string | null
  bssid: string | null
  severity: Severity
  type: AlertType
  title?: string
  message: string
  riskScore?: number
  metadata?: Record<string, unknown>
  timestamp: string
  status: AlertTriageStatus
  resolvedAt?: string | null
}

export interface ScanRecord {
  id: number
  scanId: string
  startedAt: string
  completedAt: string | null
  networksFound: number
  alertsGenerated: number
  verifiedCount: number
  suspiciousCount: number
  rogueCount: number
  duration: number | null
  status: 'COMPLETED' | 'RUNNING' | 'FAILED'
  error?: string | null
}

export interface SignalReading {
  signal: number
  // Real ISO 8601 timestamp (from the backend), never a client-formatted
  // display string — sorting/merging depends on this being chronological.
  timestamp: string
}

export type SignalHistory = Record<string, SignalReading[]>

// One 1-second read of the OS signal table, pushed by the backend as
// `signal_tick`. values maps BSSID -> dBm for every AP present in that read.
export interface LiveSignalPoint {
  timestampMs: number
  values: Record<string, number>
}

// One real completed scan cycle, for the "over time" trend charts.
export interface ActivityPoint {
  time: string
  // Real epoch milliseconds from the same backend timestamp `time` was
  // formatted from — kept separately so range filters can compare against
  // an actual instant instead of re-parsing a locale display string.
  timestampMs: number
  networks: number
  alerts: number
}

// Reported by GET /api/scan/status and the `scanner_status` socket event.
export type ScannerState =
  | 'STARTING'
  | 'WAITING_FOR_SETUP'
  | 'SCANNING'
  | 'IDLE'
  | 'ERROR'
  | 'OFFLINE'

export interface ScanStatusResponse {
  status: ScannerState
  interfaceName?: string | null
  interface?: string | null
  lastScanAt?: string | null
  nextScanAt?: string | null
  scanIntervalSeconds?: number
  setupRequired?: boolean
  error?: string | null
}

export interface SetupStatusResponse {
  setup_required: boolean
  trusted_network_count: number
}

export interface DiscoveredNetwork {
  ssid: string
  bssid: string
  signal: number | null
  channel: number | null
  frequency: number | null
  band: string | null
  encryption: Encryption
}

export interface TrustedAccessPoint {
  id: number
  ssid: string
  bssid: string
  channel: number | null
  frequency: number | null
  band: string | null
  encryption: Encryption | null
  location: string | null
  active: boolean
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

// Derived entirely from live alerts/networks — never set directly by the UI.
export type ThreatLevel = 'normal' | 'warning' | 'rogue' | 'critical'

// What the dashboard actually displays, combining socket connection state,
// backend scanner state, and whether any data has arrived yet.
export type DisplayScannerStatus =
  | 'CONNECTING'
  | 'LIVE_MONITORING'
  | 'WAITING_FOR_DATA'
  | 'WAITING_FOR_SETUP'
  | 'SECURITY_WARNING'
  | 'ROGUE_AP_DETECTED'
  | 'CRITICAL_THREAT'
  | 'OFFLINE'

export interface SettingsState {
  autoRefresh: boolean
  notifications: boolean
  weakSignalThreshold: number
  alertOnOpenNetworks: boolean
  alertOnWEP: boolean
  rogueAPDetection: boolean
  compactTable: boolean
  showTechnicalDetails: boolean
}
