import { useWirelessMonitoring } from './useWirelessMonitoring'
import { useNow } from './useNow'

export type ScanPhase = 'offline' | 'setup' | 'error' | 'scanning' | 'due' | 'complete' | 'active'

// How long "SCAN COMPLETE" stays up after a real scan_completed event.
const COMPLETE_FLASH_MS = 3000

/**
 * Countdown driven by the backend's own nextScanAt, re-read every second.
 * It never runs a timer of its own that could drift from the real loop: the
 * phase flips to "scanning" only when the backend reports SCANNING.
 */
export function useScanCountdown() {
  const {
    connectionStatus, restReachable, setupRequired, scannerState,
    nextScanAt, lastScanAt, lastCompletedScan, scanIntervalSeconds,
  } = useWirelessMonitoring()
  const now = useNow(1000)
  const interval = scanIntervalSeconds ?? 10

  const nextMs = nextScanAt ? new Date(nextScanAt).getTime() : null
  const secondsToNext = nextMs !== null ? Math.min(interval, Math.max(0, Math.ceil((nextMs - now) / 1000))) : null
  const secondsSinceLast = lastScanAt ? Math.max(0, Math.floor((now - new Date(lastScanAt).getTime()) / 1000)) : null
  const completedMs = lastCompletedScan?.completedAt ? new Date(lastCompletedScan.completedAt).getTime() : null
  const progress = secondsToNext !== null ? ((interval - secondsToNext) / interval) * 100 : 0

  let phase: ScanPhase
  if (connectionStatus !== 'connected' || !restReachable) phase = 'offline'
  else if (setupRequired || scannerState === 'WAITING_FOR_SETUP') phase = 'setup'
  else if (scannerState === 'ERROR') phase = 'error'
  else if (scannerState === 'SCANNING' || scannerState === 'STARTING') phase = 'scanning'
  else if (completedMs !== null && now - completedMs < COMPLETE_FLASH_MS) phase = 'complete'
  else if (secondsToNext === 0) phase = 'due'
  else phase = 'active'

  return {
    phase,
    secondsToNext,
    secondsSinceLast,
    progress,
    interval,
    networksDetected: lastCompletedScan?.networksFound ?? null,
  }
}
