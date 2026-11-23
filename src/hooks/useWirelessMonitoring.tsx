import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiUnavailableError, networkApi } from '../services/networkApi'
import { connectSocket, disconnectSocket, type AlertCreatedPayload, type NetworkUpdatePayload, type ScanLifecyclePayload } from '../services/socket'
import { useAppSettings } from './useAppSettings'
import { useToast } from './useToast'
import type { ToastTone } from '../components/common/Toast'
import type {
  ActivityPoint,
  ConnectionStatus,
  DisplayScannerStatus,
  ScannerState,
  ScanRecord,
  SecurityAlert,
  Severity,
  ThreatLevel,
  WirelessNetwork,
} from '../types'

function toastToneForSeverity(severity: Severity): ToastTone {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'danger'
  return 'warning'
}

interface WirelessMonitoringValue {
  networks: WirelessNetwork[]
  alerts: SecurityAlert[]
  scannerStatus: DisplayScannerStatus
  scannerState: ScannerState | null
  threatLevel: ThreatLevel
  lastScanAt: string | null
  // When the backend loop will start its next cycle — the countdown reads
  // this directly so it can't drift from the real scan timer.
  nextScanAt: string | null
  lastCompletedScan: ScanRecord | null
  recentScans: ScanRecord[]
  interfaceName: string
  scanIntervalSeconds: number | null
  connectionStatus: ConnectionStatus
  restReachable: boolean
  activityTrend: ActivityPoint[]
  setupRequired: boolean
  trustedCount: number
  refresh: () => Promise<void>
}

const WirelessMonitoringContext = createContext<WirelessMonitoringValue | null>(null)

const MAX_TREND_POINTS = 200
const MAX_RECENT_SCANS = 20

function timeLabel(iso?: string) {
  const date = iso ? new Date(iso) : new Date()
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function deriveThreatLevel(networks: WirelessNetwork[], alerts: SecurityAlert[]): ThreatLevel {
  const open = alerts.filter((alert) => alert.status === 'OPEN')

  if (open.some((alert) => alert.severity === 'CRITICAL')) return 'critical'

  if (
    open.some((alert) => alert.type === 'ROGUE_AP' || alert.type === 'POSSIBLE_EVIL_TWIN') ||
    networks.some(
      (network) => network.securityStatus === 'ROGUE' || network.securityStatus === 'POSSIBLE_EVIL_TWIN',
    )
  ) {
    return 'rogue'
  }

  if (
    open.some(
      (alert) =>
        alert.type === 'WEAK_ENCRYPTION' || alert.severity === 'HIGH' || alert.severity === 'MEDIUM',
    ) ||
    networks.some((network) => network.securityStatus === 'SUSPICIOUS')
  ) {
    return 'warning'
  }

  return 'normal'
}

export function WirelessMonitoringProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings()
  const { showToast } = useToast()

  // Refs, not the settings values directly: the socket effect below sets up
  // its listeners once and must not tear down/reconnect every time a toggle
  // changes — it just needs the *current* value when an event arrives.
  const autoRefreshRef = useRef(settings.autoRefresh)
  const notificationsRef = useRef(settings.notifications)
  useEffect(() => { autoRefreshRef.current = settings.autoRefresh }, [settings.autoRefresh])
  useEffect(() => { notificationsRef.current = settings.notifications }, [settings.notifications])

  const [networks, setNetworks] = useState<WirelessNetwork[]>([])
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [activityTrend, setActivityTrend] = useState<ActivityPoint[]>([])
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([])
  const [lastCompletedScan, setLastCompletedScan] = useState<ScanRecord | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [restReachable, setRestReachable] = useState(true)
  const [scannerState, setScannerState] = useState<ScannerState | null>(null)
  const [lastScanAt, setLastScanAt] = useState<string | null>(null)
  const [nextScanAt, setNextScanAt] = useState<string | null>(null)
  const [interfaceName, setInterfaceName] = useState('wlan0')
  const [scanIntervalSeconds, setScanIntervalSeconds] = useState<number | null>(null)
  const [hasReceivedData, setHasReceivedData] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [trustedCount, setTrustedCount] = useState(0)

  const seedScanHistory = useCallback(async () => {
    // Real per-scan history from Postgres — each ScanSession row already
    // carries the true networksFound/alertsGenerated for that exact cycle.
    // The same response also seeds the recent-scans list, so the Overview's
    // Scan History panel costs no extra request.
    try {
      const sessions = await networkApi.getScanHistory(MAX_TREND_POINTS)
      setRecentScans(sessions.slice(0, MAX_RECENT_SCANS))
      setLastCompletedScan((current) => current ?? sessions.find((session) => session.status === 'COMPLETED') ?? null)
      const points: ActivityPoint[] = sessions
        .filter((session) => session.status === 'COMPLETED')
        .map((session) => {
          const at = session.completedAt ?? session.startedAt
          return {
            time: timeLabel(at),
            timestampMs: new Date(at).getTime(),
            networks: session.networksFound,
            alerts: session.alertsGenerated,
          }
        })
        .reverse() // backend returns newest-first; charts read left-to-right
      setActivityTrend(points)
    } catch {
      // Non-fatal — trend charts and scan history fill in from live events.
    }
  }, [])

  const appendActivityPoint = useCallback((networksFound: number, alertsGenerated: number, at: string) => {
    setActivityTrend((prev) => [
      ...prev,
      { time: timeLabel(at), timestampMs: new Date(at).getTime(), networks: networksFound, alerts: alertsGenerated },
    ].slice(-MAX_TREND_POINTS))
  }, [])

  const loadInitialData = useCallback(async () => {
    try {
      const [networksData, alertsData, status, setup] = await Promise.all([
        networkApi.getNetworks(),
        networkApi.getAlerts(),
        networkApi.getScanStatus(),
        networkApi.getSetupStatus(),
      ])
      setNetworks(networksData)
      setAlerts(alertsData)
      setScannerState(status.status)
      setInterfaceName(status.interfaceName || status.interface || 'wlan0')
      if (status.scanIntervalSeconds) setScanIntervalSeconds(status.scanIntervalSeconds)
      if (status.lastScanAt) setLastScanAt(status.lastScanAt)
      setNextScanAt(status.nextScanAt ?? null)
      setSetupRequired(setup.setup_required)
      setTrustedCount(setup.trusted_network_count)
      setRestReachable(true)
      setHasReceivedData(true)
      void seedScanHistory()
    } catch (error) {
      if (error instanceof ApiUnavailableError) setRestReachable(false)
    }
  }, [seedScanHistory])

  useEffect(() => {
    const socket = connectSocket()
    setConnectionStatus(socket.connected ? 'connected' : 'connecting')

    const handleConnect = () => {
      setConnectionStatus('connected')
      setRestReachable(true)
    }
    const handleDisconnect = () => setConnectionStatus('disconnected')
    const handleConnectError = () => setConnectionStatus('disconnected')

    const handleNetworkUpdate = (payload: NetworkUpdatePayload) => {
      // Auto-refresh off: the live feed keeps running on the backend, but the
      // dashboard freezes until the operator clicks "Refresh Data".
      if (!autoRefreshRef.current) return
      setNetworks(payload.networks)
      setHasReceivedData(true)
    }

    const handleAlertCreated = (payload: AlertCreatedPayload) => {
      // A new alert is worth surfacing even if the live feed is paused — it's
      // what tells the operator there's a reason to hit "Refresh Data".
      if (notificationsRef.current) {
        showToast(payload.title || `New ${payload.severity} alert`, payload.message, toastToneForSeverity(payload.severity))
      }
      if (!autoRefreshRef.current) return
      setHasReceivedData(true)
      setAlerts((prev) => [{ ...payload, status: payload.status ?? 'OPEN' }, ...prev])
    }

    const handleScanCompleted = (payload: ScanLifecyclePayload) => {
      if (!autoRefreshRef.current) return
      const scan = payload.scan
      if (scan.completedAt) setLastScanAt(scan.completedAt)
      setRecentScans((prev) => [scan, ...prev.filter((existing) => existing.id !== scan.id)].slice(0, MAX_RECENT_SCANS))
      if (scan.status === 'COMPLETED') {
        setLastCompletedScan(scan)
        appendActivityPoint(scan.networksFound, scan.alertsGenerated, scan.completedAt ?? scan.startedAt)
      }
    }

    const handleScannerStatus = (payload: {
      status: ScannerState
      interfaceName?: string | null
      interface?: string | null
      lastScanAt?: string | null
      last_scan?: string
      nextScanAt?: string | null
      next_scan?: string
      scanIntervalSeconds?: number
    }) => {
      setScannerState(payload.status)
      const iface = payload.interfaceName || payload.interface
      if (iface) setInterfaceName(iface)
      if (payload.scanIntervalSeconds) setScanIntervalSeconds(payload.scanIntervalSeconds)
      const lastScan = payload.lastScanAt || payload.last_scan
      if (lastScan) setLastScanAt(lastScan)
      setNextScanAt(payload.nextScanAt ?? payload.next_scan ?? null)
    }

    const handleSetupStatus = (payload: { setup_required: boolean; trusted_network_count: number }) => {
      setSetupRequired(payload.setup_required)
      setTrustedCount(payload.trusted_network_count)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('network_update', handleNetworkUpdate)
    socket.on('alert_created', handleAlertCreated)
    socket.on('scan_completed', handleScanCompleted)
    socket.on('scanner_status', handleScannerStatus)
    socket.on('setup_status', handleSetupStatus)

    void loadInitialData()

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('network_update', handleNetworkUpdate)
      socket.off('alert_created', handleAlertCreated)
      socket.off('scan_completed', handleScanCompleted)
      socket.off('scanner_status', handleScannerStatus)
      socket.off('setup_status', handleSetupStatus)
      disconnectSocket()
    }
  }, [appendActivityPoint, loadInitialData, showToast])

  const threatLevel = useMemo(() => deriveThreatLevel(networks, alerts), [networks, alerts])

  const scannerStatus = useMemo<DisplayScannerStatus>(() => {
    if (connectionStatus === 'connecting') return 'CONNECTING'
    if (connectionStatus === 'disconnected' || !restReachable) return 'OFFLINE'
    if (setupRequired || scannerState === 'WAITING_FOR_SETUP') return 'WAITING_FOR_SETUP'
    if (!hasReceivedData) return 'WAITING_FOR_DATA'
    if (threatLevel === 'critical') return 'CRITICAL_THREAT'
    if (threatLevel === 'rogue') return 'ROGUE_AP_DETECTED'
    if (threatLevel === 'warning') return 'SECURITY_WARNING'
    return 'LIVE_MONITORING'
  }, [connectionStatus, restReachable, setupRequired, scannerState, hasReceivedData, threatLevel])

  const value = useMemo<WirelessMonitoringValue>(() => ({
    networks,
    alerts,
    scannerStatus,
    scannerState,
    threatLevel,
    lastScanAt,
    nextScanAt,
    lastCompletedScan,
    recentScans,
    interfaceName,
    scanIntervalSeconds,
    connectionStatus,
    restReachable,
    activityTrend,
    setupRequired,
    trustedCount,
    refresh: loadInitialData,
  }), [networks, alerts, scannerStatus, scannerState, threatLevel, lastScanAt, nextScanAt, lastCompletedScan, recentScans, interfaceName, scanIntervalSeconds, connectionStatus, restReachable, activityTrend, setupRequired, trustedCount, loadInitialData])

  return <WirelessMonitoringContext.Provider value={value}>{children}</WirelessMonitoringContext.Provider>
}

export function useWirelessMonitoring() {
  const context = useContext(WirelessMonitoringContext)
  if (!context) throw new Error('useWirelessMonitoring must be used within a WirelessMonitoringProvider')
  return context
}
