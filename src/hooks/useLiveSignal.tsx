import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { connectSocket, type SignalTickPayload } from '../services/socket'
import { useAppSettings } from './useAppSettings'
import type { LiveSignalPoint } from '../types'

// Two minutes of 1-second readings. Older points fall off the front so the
// buffer (and every chart built from it) stays a fixed size.
export const MAX_LIVE_POINTS = 120

interface LiveSignalValue {
  points: LiveSignalPoint[]
  // Client receive time of the most recent tick, for "Updated Ns ago".
  lastTickAt: number | null
}

// Kept in its own context, separate from useWirelessMonitoring: a tick lands
// every second, and only the components that draw live signal should
// re-render for it — not the whole dashboard.
const LiveSignalContext = createContext<LiveSignalValue | null>(null)

export function LiveSignalProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings()
  const autoRefreshRef = useRef(settings.autoRefresh)
  useEffect(() => { autoRefreshRef.current = settings.autoRefresh }, [settings.autoRefresh])

  const [value, setValue] = useState<LiveSignalValue>({ points: [], lastTickAt: null })

  useEffect(() => {
    // Same shared socket the monitoring provider uses — this only adds a
    // listener, it never opens a second connection.
    const socket = connectSocket()

    const handleTick = (payload: SignalTickPayload) => {
      if (!autoRefreshRef.current) return
      const values: Record<string, number> = {}
      payload.readings.forEach((reading) => { values[reading.bssid] = reading.signal })
      const point: LiveSignalPoint = { timestampMs: new Date(payload.timestamp).getTime(), values }
      setValue((prev) => ({
        points: [...prev.points, point].slice(-MAX_LIVE_POINTS),
        lastTickAt: Date.now(),
      }))
    }

    socket.on('signal_tick', handleTick)
    return () => { socket.off('signal_tick', handleTick) }
  }, [])

  return <LiveSignalContext.Provider value={value}>{children}</LiveSignalContext.Provider>
}

export function useLiveSignal() {
  const context = useContext(LiveSignalContext)
  if (!context) throw new Error('useLiveSignal must be used within a LiveSignalProvider')
  return context
}

/** Latest live dBm for a BSSID, or null if it hasn't appeared in the buffer. */
export function latestLiveReading(points: LiveSignalPoint[], bssid: string): { signal: number; timestampMs: number } | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const signal = points[i].values[bssid]
    if (signal !== undefined) return { signal, timestampMs: points[i].timestampMs }
  }
  return null
}
