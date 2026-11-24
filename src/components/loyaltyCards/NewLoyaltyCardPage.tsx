import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { RetailerSuggestion } from '../../../convex/loyaltyCards'
import { useErrorMessage } from '../../lib/errorMessage'
import { useMessages } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { ErrorNotice } from './ErrorNotice'
import { LoyaltyCardForm } from './LoyaltyCardForm'
import { RetailerPicker } from './RetailerPicker'
import { StoreTile } from './StoreTile'

type Choice = { retailer: RetailerSuggestion } | { other: true } | null

/**
 * Adding a card: pick the store, then fill in the card.
 *
 * Picking a Catalog retailer prefills the store's name and barcode type and
 * remembers its key as Provenance; `create` copies its colour and domain from
 * the Catalog row itself (ADR-0043).
 */
export function NewLoyaltyCardPage() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const create = useMutation(api.loyaltyCards.create)
  const generateUploadUrl = useMutation(api.loyaltyCards.generateUploadUrl)
  const navigate = useNavigate()
  const messages = useMessages()
  const errorText = useErrorMessage()
  const copy = messages.loyaltyCards
  const [choice, setChoice] = useState<Choice>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trail: Crumb[] = [
    {
      label: messages.modules.byId['loyalty-cards'].label,
      link: linkTo('loyalty-cards'),
    },
    { label: copy.form.createTitle },
  ]

  const retailer = choice && 'retailer' in choice ? choice.retailer : undefined

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <Breadcrumbs trail={trail} className="mb-0" />
      <h1 className="m-0 font-rounded text-2xl font-bold">{copy.form.createTitle}</h1>

      {choice === null ? (
        <RetailerPicker
          onPick={(picked) => setChoice({ retailer: picked })}
          onOtherStore={() => setChoice({ other: true })}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] p-3">
            <span className="flex min-w-0 items-center gap-3">
              {retailer ? (
                <StoreTile
                  name={retailer.name}
                  color={retailer.brandColor}
                  catalogKey={retailer.seedKey}
                  size="small"
                />
              ) : null}
              <span className="truncate font-semibold">
                {retailer ? retailer.name : copy.picker.otherStore}
              </span>
            </span>
            <button
              type="button"
              className="min-h-9 shrink-0 rounded-[var(--radius-control)] border border-[var(--hair)] px-3 text-sm"
              onClick={() => {
                setChoice(null)
                setError(null)
              }}
            >
              {copy.picker.changeStore}
            </button>
          </div>

          <ErrorNotice message={error} />

          <LoyaltyCardForm
            key={retailer?.seedKey ?? 'other'}
            retailer={retailer}
            customStore={!retailer}
            focusOnOpen={retailer ? 'cardNumber' : 'storeName'}
            initial={{
              storeName: retailer?.name ?? '',
              cardNumber: '',
              barcodeFormat: retailer?.barcodeFormat ?? 'CODE_128',
              holder: '',
              note: '',
            }}
            generateUploadUrl={generateUploadUrl}
            submitting={submitting}
            onSubmit={async (values) => {
              setSubmitting(true)
              setError(null)
              try {
                const id = await create({
                  groupSlug,
                  catalogKey: retailer?.seedKey,
                  storeName: values.storeName,
                  brandColor: values.brandColor,
                  cardNumber: values.cardNumber,
                  barcodeFormat: values.barcodeFormat,
                  holder: values.holder || undefined,
                  note: values.note || undefined,
                  frontPhotoId: values.frontPhotoId,
                  backPhotoId: values.backPhotoId,
                })
                navigate({
                  ...linkTo('loyaltyCard', { cardId: id }),
                  search: { saved: true },
                })
              } catch (caught) {
                setError(
                  errorText(caught, copy.form.saveFailed, copy.refusals),
                )
                setSubmitting(false)
              }
            }}
          />
        </>
      )}
    </div>
  )
}
