/**
 * Captures an addressed Gather link before either auth state can draw.
 *
 * The link may arrive while signed out, so this file lives outside `(app)`.
 * It does not validate or select a Group itself; it holds the intent across
 * Clerk's gate and lets the authenticated handoff do both against live data.
 */

import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo } from 'react'

import { rememberGroupLink } from '../../../src/shell/pendingGroupLink'

export default function GroupLinkCapture() {
  const { groupSlug, rest } = useLocalSearchParams<{
    groupSlug: string
    rest: string[]
  }>()
  const link = useMemo(
    () => ({ groupSlug, segments: rest ?? [] }),
    [groupSlug, rest],
  )

  useEffect(() => {
    rememberGroupLink(link)
    router.replace('/deep-link')
  }, [link])

  return null
}
