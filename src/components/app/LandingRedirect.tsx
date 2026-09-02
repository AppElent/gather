import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useCurrentGroup } from './useCurrentGroup'

/** Sends the root of the app to the locally selected Group, if there is one. */
export function LandingRedirect() {
  const navigate = useNavigate()
  const { current, groups } = useCurrentGroup()
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current || groups === undefined) return
    sent.current = true
    void navigate({ to: current ? '/home' : '/groups', replace: true })
  }, [current, groups, navigate])

  return (
    <p className="py-16 text-center text-sm text-[var(--app-muted)]">
      Taking you there…
    </p>
  )
}
