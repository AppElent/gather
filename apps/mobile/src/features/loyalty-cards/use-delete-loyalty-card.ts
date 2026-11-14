import { useMutation } from 'convex/react'

import { api, type Id } from '../../convex/api'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'

/**
 * Delete a card, after asking: it goes for the whole household with its
 * photos, and deleting is permanent (`apps/mobile/DESIGN_SYSTEM.md`). Shared by
 * the list's hold menu and the card screen, so both ask the same question.
 */
export function useDeleteLoyaltyCard(groupSlug: string) {
  const { t } = useI18n()
  const words = t.loyaltyCards.form
  const remove = useMutation(api.loyaltyCards.remove)

  return (
    card: { _id: Id<'loyaltyCards'>; storeName: string },
    {
      onDeleted,
      onFailed,
    }: { onDeleted?: () => void; onFailed: (message: string) => void },
  ) =>
    confirmDestructive({
      title: fmt(words.deleteTitle, { store: card.storeName }),
      message: words.deleteBody,
      confirm: words.deleteConfirm,
      cancel: t.common.actions.cancel,
      onConfirm: async () => {
        try {
          await remove({ groupSlug, id: card._id })
          onDeleted?.()
        } catch {
          haptics.actionFailed()
          onFailed(words.deleteFailed)
        }
      },
    })
}
