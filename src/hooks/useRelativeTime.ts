import { useEffect, useState } from 'react'

// Ticks once a second so "X sec ago" stays current. This only reformats an
// already-known real timestamp — it never invents new scanner data.
export function useRelativeTime(iso: string | null): string {
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!iso) return
    const id = setInterval(() => forceTick((value) => value + 1), 1000)
    return () => clearInterval(id)
  }, [iso])

  if (!iso) return '--'

  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 1) return 'just now'
  if (seconds < 60) return `${seconds} sec ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return `${hours} hr ago`
}
