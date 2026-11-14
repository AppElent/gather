import {
  BARCODE_FORMATS,
  type BarcodeFormat,
  checkCardNumber,
} from '@gather/core/barcodes'
import {
  DEFAULT_STORE_COLOR,
  LOYALTY_CARD_LIMITS,
} from '@gather/core/loyalty-cards'
import { useId, useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { RetailerSuggestion } from '../../../convex/loyaltyCards'
import { fmt, useMessages } from '../../lib/i18n'
import { ImageUploadField } from '../photo/ImageUploadField'
import { inputClass } from '../recipes/fields'
import { Barcode } from './Barcode'

export interface LoyaltyCardFormValues {
  storeName: string
  /** Only for a store typed by hand; a Catalog store keeps its own colour. */
  brandColor?: string
  cardNumber: string
  barcodeFormat: BarcodeFormat
  holder: string
  note: string
  frontPhotoId?: Id<'_storage'>
  backPhotoId?: Id<'_storage'>
}

interface LoyaltyCardFormProps {
  initial: LoyaltyCardFormValues
  /** The Catalog entry the card comes from, for its hints. */
  retailer?: RetailerSuggestion
  /** Whether the colour can be chosen: only for a store typed by hand. */
  customStore: boolean
  photoUrls?: { front: string | null; back: string | null }
  generateUploadUrl: () => Promise<string>
  submitting: boolean
  onSubmit: (values: LoyaltyCardFormValues) => void
}

/**
 * The fields of a card, for adding and editing alike.
 *
 * The card number is checked against its barcode type as it is typed, with
 * the same rule Convex applies (`@gather/core/barcodes`), and the barcode is
 * previewed once it is valid, so a wrong digit shows here and not at a till.
 */
export function LoyaltyCardForm({
  initial,
  retailer,
  customStore,
  photoUrls,
  generateUploadUrl,
  submitting,
  onSubmit,
}: LoyaltyCardFormProps) {
  const messages = useMessages()
  const copy = messages.loyaltyCards.form
  const ids = {
    store: useId(),
    number: useId(),
    numberHelp: useId(),
    numberError: useId(),
    format: useId(),
    formatHelp: useId(),
    holder: useId(),
    holderHelp: useId(),
    note: useId(),
    color: useId(),
  }

  const [storeName, setStoreName] = useState(initial.storeName)
  const [brandColor, setBrandColor] = useState(
    initial.brandColor ?? DEFAULT_STORE_COLOR,
  )
  const [cardNumber, setCardNumber] = useState(initial.cardNumber)
  const [barcodeFormat, setBarcodeFormat] = useState(initial.barcodeFormat)
  const [holder, setHolder] = useState(initial.holder)
  const [note, setNote] = useState(initial.note)
  const [frontPhotoId, setFrontPhotoId] = useState(initial.frontPhotoId)
  const [backPhotoId, setBackPhotoId] = useState(initial.backPhotoId)
  const [frontUrl, setFrontUrl] = useState(photoUrls?.front ?? null)
  const [backUrl, setBackUrl] = useState(photoUrls?.back ?? null)
  const [numberTouched, setNumberTouched] = useState(false)
  // Saving while a photo is still on its way would store the card without it,
  // and the blob that lands afterwards would belong to nothing.
  const [frontUploading, setFrontUploading] = useState(false)
  const [backUploading, setBackUploading] = useState(false)
  const uploading = frontUploading || backUploading

  const check = checkCardNumber(barcodeFormat, cardNumber)
  const showProblem = numberTouched && !check.ok
  const formatIsGuess =
    retailer?.formatConfidence === 'guess' &&
    barcodeFormat === retailer.barcodeFormat

  const numberHints = [
    retailer?.numberLength
      ? fmt(copy.cardNumberHintLength, { length: retailer.numberLength })
      : null,
    retailer?.numberPrefix
      ? fmt(copy.cardNumberHintPrefix, { prefix: retailer.numberPrefix })
      : null,
  ].filter(Boolean)

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setNumberTouched(true)
        if (uploading || !check.ok || !storeName.trim()) return
        onSubmit({
          storeName: storeName.trim(),
          brandColor: customStore ? brandColor : undefined,
          cardNumber: check.value,
          barcodeFormat,
          holder: holder.trim(),
          note: note.trim(),
          frontPhotoId,
          backPhotoId,
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-1 text-sm">
          <label htmlFor={ids.store} className="font-medium">
            {copy.storeName}
          </label>
          <input
            id={ids.store}
            className={inputClass}
            value={storeName}
            maxLength={LOYALTY_CARD_LIMITS.storeName}
            required
            onChange={(event) => setStoreName(event.target.value)}
          />
        </div>
        {customStore ? (
          <div className="grid gap-1 text-sm">
            <label htmlFor={ids.color} className="font-medium">
              {copy.color}
            </label>
            <input
              id={ids.color}
              type="color"
              className="h-10 w-16 cursor-pointer rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-1"
              value={brandColor}
              onChange={(event) => setBrandColor(event.target.value)}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-1 text-sm">
        <label htmlFor={ids.number} className="font-medium">
          {copy.cardNumber}
        </label>
        <input
          id={ids.number}
          className={`${inputClass} font-mono tracking-wider`}
          value={cardNumber}
          inputMode={
            ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'ITF'].includes(barcodeFormat)
              ? 'numeric'
              : 'text'
          }
          autoComplete="off"
          spellCheck={false}
          required
          aria-invalid={showProblem}
          aria-describedby={
            [
              numberHints.length ? ids.numberHelp : null,
              showProblem ? ids.numberError : null,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          onChange={(event) => setCardNumber(event.target.value)}
          onBlur={() => setNumberTouched(true)}
        />
        {numberHints.length ? (
          <p id={ids.numberHelp} className="m-0 text-[var(--app-muted)]">
            {numberHints.join(' ')}
          </p>
        ) : null}
        {showProblem && !check.ok ? (
          <p id={ids.numberError} className="m-0 text-[var(--app-danger)]">
            {copy.problems[check.problem]}
          </p>
        ) : null}
      </div>

      <div className="grid gap-1 text-sm">
        <label htmlFor={ids.format} className="font-medium">
          {copy.barcodeFormat}
        </label>
        <select
          id={ids.format}
          className={inputClass}
          value={barcodeFormat}
          aria-describedby={formatIsGuess ? ids.formatHelp : undefined}
          onChange={(event) =>
            setBarcodeFormat(event.target.value as BarcodeFormat)
          }
        >
          {BARCODE_FORMATS.map((format) => (
            <option key={format} value={format}>
              {messages.loyaltyCards.formats[format]}
            </option>
          ))}
        </select>
        {formatIsGuess ? (
          <p id={ids.formatHelp} className="m-0 text-[var(--app-muted)]">
            {fmt(copy.formatGuess, { store: storeName || retailer.name })}
          </p>
        ) : null}
      </div>

      {check.ok ? (
        <div className="grid gap-1 text-sm">
          <span className="font-medium">{copy.preview}</span>
          <Barcode
            format={barcodeFormat}
            value={check.value}
            size="small"
            label={fmt(messages.loyaltyCards.detail.barcodeLabel, {
              format: messages.loyaltyCards.formats[barcodeFormat],
              store: storeName,
            })}
          />
        </div>
      ) : null}

      <div className="grid gap-1 text-sm">
        <label htmlFor={ids.holder} className="font-medium">
          {copy.holder}
        </label>
        <input
          id={ids.holder}
          className={inputClass}
          value={holder}
          maxLength={LOYALTY_CARD_LIMITS.holder}
          aria-describedby={ids.holderHelp}
          onChange={(event) => setHolder(event.target.value)}
        />
        <p id={ids.holderHelp} className="m-0 text-[var(--app-muted)]">
          {copy.holderHint}
        </p>
      </div>

      <div className="grid gap-1 text-sm">
        <label htmlFor={ids.note} className="font-medium">
          {copy.note}
        </label>
        <textarea
          id={ids.note}
          className={`${inputClass} min-h-20`}
          value={note}
          maxLength={LOYALTY_CARD_LIMITS.note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUploadField
          label={copy.frontPhoto}
          imageUrl={frontUrl}
          preset="loyaltyCardPhoto"
          generateUploadUrl={generateUploadUrl}
          fieldId="loyalty-card-front-photo"
          onUploadingChange={setFrontUploading}
          onChange={(id) => {
            setFrontPhotoId(id)
            if (id === undefined) setFrontUrl(null)
          }}
        />
        <ImageUploadField
          label={copy.backPhoto}
          imageUrl={backUrl}
          preset="loyaltyCardPhoto"
          generateUploadUrl={generateUploadUrl}
          fieldId="loyalty-card-back-photo"
          onUploadingChange={setBackUploading}
          onChange={(id) => {
            setBackPhotoId(id)
            if (id === undefined) setBackUrl(null)
          }}
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={submitting || uploading}
          className="min-h-11 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-4 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting
            ? messages.common.actions.saving
            : uploading
              ? copy.waitingForPhoto
              : copy.save}
        </button>
      </div>
    </form>
  )
}
