import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from './networkApi'
import type { ScanRecord, ScanStatusResponse, SecurityAlert, SetupStatusResponse, WirelessNetwork } from '../types'

export interface NetworkUpdatePayload {
  networks: WirelessNetwork[]
}

export interface SignalUpdatePayload {
  network_id?: number
  networkId?: number
  ssid: string
  bssid: string
  signal: number | null
  timestamp: string
}

export interface SignalTickPayload {
  timestamp: string
  readings: Array<{ bssid: string; signal: number }>
}

export type AlertCreatedPayload = SecurityAlert

export interface ScanLifecyclePayload {
  scan: ScanRecord
}

export interface ServerToClientEvents {
  network_update: (payload: NetworkUpdatePayload) => void
  signal_update: (payload: SignalUpdatePayload) => void
  signal_tick: (payload: SignalTickPayload) => void
  alert_created: (payload: AlertCreatedPayload) => void
  scan_started: (payload: Partial<ScanRecord>) => void
  scan_completed: (payload: ScanLifecyclePayload) => void
  scanner_status: (payload: ScanStatusResponse & { last_scan?: string; next_scan?: string; interface?: string }) => void
  setup_status: (payload: SetupStatusResponse) => void
}

// A single shared connection for the whole app. Every page reads from the
// same socket through useWirelessMonitoring instead of opening its own.
let socket: Socket<ServerToClientEvents> | null = null

export function connectSocket(): Socket<ServerToClientEvents> {
  if (!socket) {
    socket = io(API_BASE_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      transports: ['websocket', 'polling'],
    })
  } else if (!socket.connected) {
    socket.connect()
  }
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
}

export function getSocket() {
  return socket
}
