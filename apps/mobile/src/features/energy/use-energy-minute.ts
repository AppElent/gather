import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

/** The time, moving with the minute and when the app comes back. */
export function useEnergyMinute(): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const timer = setInterval(refresh, 60_000)
    const app = AppState.addEventListener('change', refresh)
    return () => {
      clearInterval(timer)
      app.remove()
    }
  }, [])
  return now
}
