import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { networkApi } from '../services/networkApi'
import type { SettingsState } from '../types'

const STORAGE_KEY = 'wireless-security-settings'

export const DEFAULT_SETTINGS: SettingsState = {
  autoRefresh: true,
  notifications: true,
  weakSignalThreshold: -70,
  alertOnOpenNetworks: true,
  alertOnWEP: true,
  rogueAPDetection: true,
  compactTable: false,
  showTechnicalDetails: true,
}

interface AppSettingsValue {
  settings: SettingsState
  setSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void
  saveSettings: () => Promise<{ success: boolean; message: string }>
  resetSettings: () => Promise<void>
}

const AppSettingsContext = createContext<AppSettingsValue | null>(null)

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        // Older saves may still carry a scanInterval key from when it was
        // user-editable; drop it so it never re-enters state.
        const { scanInterval: _legacy, ...rest } = JSON.parse(saved)
        setSettings((current) => ({ ...current, ...rest }))
      } catch {
        // ignore corrupt local storage, fall back to defaults
      }
    }

    // The backend is the source of truth for anything it actually enforces.
    networkApi.getSettings()
      .then((backend) => {
        setSettings((current) => ({
          ...current,
          alertOnOpenNetworks: backend.alertOnOpenNetworks,
          alertOnWEP: backend.alertOnWep,
          rogueAPDetection: backend.rogueDetectionEnabled,
        }))
      })
      .catch(() => undefined)
  }, [])

  const setSetting = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const saveSettings = useCallback(async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    try {
      await networkApi.updateSettings(settings)
      return { success: true, message: 'Settings saved and applied by the scanner backend' }
    } catch {
      return { success: false, message: 'Settings saved locally — backend unreachable, will sync when available' }
    }
  }, [settings])

  const resetSettings = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS))
    try {
      await networkApi.updateSettings(DEFAULT_SETTINGS)
    } catch {
      // backend unreachable — local reset still applies, will sync on next save
    }
  }, [])

  return (
    <AppSettingsContext.Provider value={{ settings, setSetting, saveSettings, resetSettings }}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext)
  if (!context) throw new Error('useAppSettings must be used within an AppSettingsProvider')
  return context
}
