import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { LoyaltyCardDetail } from '../../../convex/loyaltyCards'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, useMessages } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { useConfirmAction } from '../app/ConfirmAction'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { ErrorNotice } from './ErrorNotice'
import { LoyaltyCardForm } from './LoyaltyCardForm'

/** Editing a card, and deleting it. */
export function EditLoyaltyCardPage({ cardId }: { cardId: string }) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const id = cardId as Id<'loyaltyCards'>
  const card = useQuery(api.loyaltyCards.get, { groupSlug, id })
  const messages = useMessages()
  const copy = messages.loyaltyCards

  const trail: Crumb[] = [
    {
      label: messages.modules.byId['loyalty-cards'].label,
      link: linkTo('loyalty-cards'),
    },
    ...(card
      ? [
          {
            label: card.holder
              ? `${card.storeName} · ${card.holder}`
              : card.storeName,
            link: linkTo('loyaltyCard', { cardId: card._id }),
          },
        ]
      : []),
    { label: messages.common.actions.edit },
  ]

  if (card === undefined || card === null) {
    return (
      <div className="mx-auto max-w-2xl">
        <Breadcrumbs trail={trail} />
        <p className="text-sm text-[var(--app-muted)]">
          {card === null
            ? copy.detail.notFound
            : messages.common.errors.loading}
        </p>
      </div>
    )
  }

  return (
    <EditForm key={card._id} card={card} groupSlug={groupSlug} trail={trail} />
  )
}

function EditForm({
  card,
  groupSlug,
  trail,
}: {
  card: LoyaltyCardDetail
  groupSlug: string
  trail: readonly Crumb[]
}) {
  const update = useMutation(api.loyaltyCards.update)
  const remove = useMutation(api.loyaltyCards.remove)
  const generateUploadUrl = useMutation(api.loyaltyCards.generateUploadUrl)
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirmAction()
  const messages = useMessages()
  const copy = messages.loyaltyCards.form
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <Breadcrumbs trail={trail} className="mb-0" />
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-2xl font-semibold">
          {fmt(copy.editTitle, { store: card.storeName })}
        </h2>
        <button
          type="button"
          aria-label={messages.common.actions.delete}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-[var(--app-radius)] border border-[var(--app-danger)] text-[var(--app-danger)] lg:gap-2 lg:px-3 lg:text-sm lg:font-semibold"
          onClick={() =>
            confirm({
              title: fmt(copy.deleteTitle, { store: card.storeName }),
              body: copy.deleteBody,
              confirmLabel: copy.deleteConfirm,
              errorFallback: copy.deleteFailed,
              run: async () => {
                await remove({ groupSlug, id: card._id })
                navigate(linkTo('loyalty-cards'))
              },
            })
          }
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span className="hidden lg:inline">
            {messages.common.actions.delete}
          </span>
        </button>
      </div>

      <ErrorNotice message={error} />

      <LoyaltyCardForm
        customStore={!card.catalogKey}
        initial={{
          storeName: card.storeName,
          brandColor: card.brandColor,
          cardNumber: card.cardNumber,
          barcodeFormat: card.barcodeFormat,
          holder: card.holder ?? '',
          note: card.note ?? '',
          frontPhotoId: card.frontPhotoId,
          backPhotoId: card.backPhotoId,
        }}
        photoUrls={{ front: card.frontPhotoUrl, back: card.backPhotoUrl }}
        generateUploadUrl={generateUploadUrl}
        submitting={submitting}
        onSubmit={async (values) => {
          setSubmitting(true)
          setError(null)
          try {
            await update({
              groupSlug,
              id: card._id,
              storeName: values.storeName,
              brandColor: values.brandColor,
              cardNumber: values.cardNumber,
              barcodeFormat: values.barcodeFormat,
              holder: values.holder || undefined,
              note: values.note || undefined,
              // The same id leaves a photo alone; `null` takes it off.
              frontPhotoId: values.frontPhotoId ?? null,
              backPhotoId: values.backPhotoId ?? null,
            })
            navigate(linkTo('loyaltyCard', { cardId: card._id }))
          } catch (caught) {
            setError(
              errorMessage(caught, copy.saveFailed, messages.loyaltyCards.refusals),
            )
            setSubmitting(false)
          }
        }}
      />

      {dialog}
    </div>
  )
}
