import type {
  DiscoveredNetwork,
  ScanRecord,
  ScanStatusResponse,
  SecurityAlert,
  SettingsState,
  SetupStatusResponse,
  TrustedAccessPoint,
  WirelessNetwork,
} from '../types'

// Points at the Flask backend. Override with VITE_API_BASE_URL when the
// scanner service is hosted somewhere other than localhost.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'

export interface BackendSettings {
  interface: string | null
  monitoringEnabled: boolean
  alertOnOpenNetworks: boolean
  alertOnWep: boolean
  rogueDetectionEnabled: boolean
}

export class ApiUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Scanner backend unavailable')
    this.cause = cause
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch (error) {
    throw new ApiUnavailableError(error)
  }

  if (!response.ok) {
    throw new ApiUnavailableError(`${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export const networkApi = {
  getNetworks(): Promise<WirelessNetwork[]> {
    return request<WirelessNetwork[]>('/api/networks')
  },

  getAlerts(): Promise<SecurityAlert[]> {
    return request<SecurityAlert[]>('/api/alerts')
  },

  getScanStatus(): Promise<ScanStatusResponse> {
    return request<ScanStatusResponse>('/api/scan/status')
  },

  getScanHistory(limit?: number): Promise<ScanRecord[]> {
    return request<ScanRecord[]>(`/api/scans${limit ? `?limit=${limit}` : ''}`)
  },

  // Wakes the one real monitoring loop immediately instead of waiting out the
  // interval. Never starts a second scanner — responds 409 with a reason if
  // one's already running or monitoring is stopped, so this reads the body
  // directly rather than using request() (which throws on non-2xx).
  async triggerScan(): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan/trigger`, { method: 'POST' })
      return await response.json()
    } catch (error) {
      throw new ApiUnavailableError(error)
    }
  },

  getNetworkSignals(networkId: number, limit = 60) {
    return request<{ networkId: number; ssid: string; bssid: string; readings: Array<{ signal: number; timestamp: string }> }>(
      `/api/networks/${networkId}/signals?limit=${limit}`,
    )
  },

  resolveAlert(alertId: number) {
    return request<{ success: boolean; data: SecurityAlert }>(`/api/alerts/${alertId}/resolve`, {
      method: 'POST',
    })
  },

  startMonitoring(): Promise<{ success: boolean; status: string }> {
    return request('/api/monitoring/start', { method: 'POST' })
  },

  stopMonitoring(): Promise<{ success: boolean; status: string }> {
    return request('/api/monitoring/stop', { method: 'POST' })
  },

  getSettings() {
    return request<BackendSettings>('/api/settings')
  },

  // Only the fields the backend actually persists and acts on. Everything
  // else in SettingsState (autoRefresh, notifications, weakSignalThreshold,
  // compactTable, showTechnicalDetails) is frontend-only and never sent here.
  updateSettings(settings: Partial<SettingsState>) {
    const body: Record<string, unknown> = {}
    if (settings.alertOnOpenNetworks !== undefined) body.alertOnOpenNetworks = settings.alertOnOpenNetworks
    if (settings.alertOnWEP !== undefined) body.alertOnWep = settings.alertOnWEP
    if (settings.rogueAPDetection !== undefined) body.rogueDetectionEnabled = settings.rogueAPDetection

    return request<{ success: boolean; data: BackendSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  },

  // -- first-run trusted baseline setup ------------------------------------

  getSetupStatus(): Promise<SetupStatusResponse> {
    return request<SetupStatusResponse>('/api/setup/status')
  },

  getDiscoveredNetworks(): Promise<{ success: boolean; data: DiscoveredNetwork[]; error?: string }> {
    return request('/api/setup/discovered-networks')
  },

  rescanForSetup(): Promise<{ success: boolean; count?: number; error?: string }> {
    return request('/api/setup/rescan', { method: 'POST' })
  },

  verifyTrustedNetworks(bssids: string[], location?: string) {
    return request<{
      success: boolean
      verified: TrustedAccessPoint[]
      skipped: Array<{ bssid: string; reason: string }>
      trusted_network_count: number
    }>('/api/setup/verify', {
      method: 'POST',
      body: JSON.stringify({ bssids, location }),
    })
  },

  resetSetup(): Promise<{ success: boolean; removed: number }> {
    return request('/api/setup/reset', { method: 'POST' })
  },

  getTrustedAccessPoints(): Promise<TrustedAccessPoint[]> {
    return request<TrustedAccessPoint[]>('/api/trusted-aps')
  },

  deleteTrustedAccessPoint(id: number) {
    return request<{ success: boolean }>(`/api/trusted-aps/${id}`, { method: 'DELETE' })
  },
}
