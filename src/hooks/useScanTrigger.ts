import { useState } from 'react'
import { networkApi } from '../services/networkApi'
import { useToast } from './useToast'
import { useWirelessMonitoring } from './useWirelessMonitoring'

// Wakes the one real backend monitoring loop immediately. Never starts a
// second scanner, and never fakes a "Scanning..." sequence — the button just
// reflects the real scannerStatus, which flips to SCANNING/IDLE from the
// actual scan_started / scan_completed broadcasts.
export function useScanTrigger() {
  const { scannerState } = useWirelessMonitoring()
  const { showToast } = useToast()
  const [requesting, setRequesting] = useState(false)

  const isScanning = scannerState === 'SCANNING'

  const triggerScan = async () => {
    setRequesting(true)
    try {
      const result = await networkApi.triggerScan()
      if (!result.success) {
        showToast('Could not start scan', result.error || 'Try again in a moment.', 'warning')
      }
    } catch {
      showToast('Scan request failed', 'Scanner backend unavailable.', 'danger')
    } finally {
      setRequesting(false)
    }
  }

  return { triggerScan, isScanning, requesting, disabled: isScanning || requesting }
}
