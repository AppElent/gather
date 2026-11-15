import { useMutation } from 'convex/react'
import { useEffect, useRef } from 'react'

import { api, type Id } from '../../../convex/api'

/**
 * Opening a card is showing it at the till: it moves to the top of the list
 * (APP-141's `markUsed`). Once per open — a re-render, a live update to the
 * card or React's development double-mount does not count again — and quietly,
 * because a failed sort hint is not worth interrupting a checkout for.
 */
export function useMarkUsedOnce(groupSlug: string, cardId: Id<'loyaltyCards'>) {
  const markUsed = useMutation(api.loyaltyCards.markUsed)
  const marked = useRef<string | null>(null)

  useEffect(() => {
    const key = `${groupSlug}/${cardId}`
    if (marked.current === key) return
    marked.current = key
    markUsed({ groupSlug, id: cardId }).catch(() => {})
  }, [groupSlug, cardId, markUsed])
}
