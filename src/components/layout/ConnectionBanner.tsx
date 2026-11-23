import { AlertOctagon, PauseCircle, WifiOff } from 'lucide-react'
import { useWirelessMonitoring } from '../../hooks/useWirelessMonitoring'
import { useAppSettings } from '../../hooks/useAppSettings'

export function ConnectionBanner() {
  const { restReachable, connectionStatus } = useWirelessMonitoring()
  const { settings } = useAppSettings()

  if (!restReachable) {
    return (
      <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-xs text-red-200 sm:px-6">
        <AlertOctagon className="h-3.5 w-3.5" />
        Scanner backend unavailable — retrying automatically.
      </div>
    )
  }

  if (connectionStatus === 'disconnected') {
    return (
      <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 text-xs text-amber-200 sm:px-6">
        <WifiOff className="h-3.5 w-3.5" />
        Realtime connection lost — attempting to reconnect...
      </div>
    )
  }

  if (!settings.autoRefresh) {
    return (
      <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800/60 px-5 py-2 text-xs text-slate-300 sm:px-6">
        <PauseCircle className="h-3.5 w-3.5" />
        Auto-refresh is off — scanning continues in the background. Click "Refresh Data" to pull the latest, or re-enable it in Settings.
      </div>
    )
  }

  return null
}
