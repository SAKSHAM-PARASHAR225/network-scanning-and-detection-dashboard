import { useEffect, useState } from 'react'

// A plain wall-clock display tick — not scanner data, just formatting "now"
// once a minute so the header can show the current date/time.
export function useClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  return now
}
