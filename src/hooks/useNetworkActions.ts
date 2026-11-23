import { useState } from 'react'
import { networkApi } from '../services/networkApi'
import type { SecurityAlert, WirelessNetwork } from '../types'
import { useWirelessMonitoring } from './useWirelessMonitoring'

// Shared "trust this AP" / "resolve this alert" actions, wired to the real
// backend endpoints, with a refresh of the shared monitoring state afterward.
export function useNetworkActions() {
  const { refresh } = useWirelessMonitoring()
  const [trustingBssid, setTrustingBssid] = useState<string | null>(null)
  const [resolvingAlertId, setResolvingAlertId] = useState<number | null>(null)
  const [bulkResolving, setBulkResolving] = useState(false)

  const trustNetwork = async (network: WirelessNetwork) => {
    setTrustingBssid(network.bssid)
    try {
      await networkApi.verifyTrustedNetworks([network.bssid])
      await refresh()
    } finally {
      setTrustingBssid(null)
    }
  }

  const resolveAlert = async (alert: SecurityAlert) => {
    setResolvingAlertId(alert.id)
    try {
      await networkApi.resolveAlert(alert.id)
      await refresh()
    } finally {
      setResolvingAlertId(null)
    }
  }

  // Resolves every given alert in parallel, one real API call each — not a
  // separate "mark all read" concept, since OPEN/RESOLVED is the only status
  // the backend tracks.
  const resolveAlerts = async (alertsToResolve: SecurityAlert[]) => {
    if (alertsToResolve.length === 0) return
    setBulkResolving(true)
    try {
      await Promise.allSettled(alertsToResolve.map((alert) => networkApi.resolveAlert(alert.id)))
      await refresh()
    } finally {
      setBulkResolving(false)
    }
  }

  return { trustNetwork, resolveAlert, resolveAlerts, trustingBssid, resolvingAlertId, bulkResolving }
}
