/**
 * The fields of a card, for adding and editing alike (APP-142).
 *
 * The number is checked against its barcode type as it is typed, by the rule
 * Convex applies (`checkCardDraft`), and the barcode is previewed once it is
 * valid, so a wrong digit shows here and not at a till. Save on a draft the
 * server would refuse names each problem under its field instead of sending
 * it, and Save stays off while a photo is still uploading: a card saved then
 * would go without the photo it shows.
 *
 * A Catalog store keeps its own name and colour; a store typed by hand picks
 * one of `STORE_COLOR_PRESETS`, the same colours the web suggests (APP-160).
 *
 * The add flow keeps this form mounted while its store is changed, so the
 * holder, the note and the photos survive "Change store"; `storeSeed` hands
 * it the new store's fields to take over.
 */
import { MenuView } from '@expo/ui/community/menu'
import { BARCODE_FORMATS, type BarcodeFormat } from '@gather/core/barcodes'
import {
  DEFAULT_STORE_COLOR,
  STORE_COLOR_PRESETS,
  textOnBrand,
} from '@gather/core/loyalty-cards'
import { useMutation } from 'convex/react'
import { useRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  type TextInputInstance,
  View,
} from 'react-native'

import { PhotoField } from '../../../components/PhotoField'
import { api } from '../../../convex/api'
import { haptics } from '../../../feedback/haptics'
import { fmt, useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, TYPE, useTokens } from '../../../theme/tokens'
import { Button } from '../../../ui/button'
import { Field } from '../../../ui/field'
import { CardBarcode } from './card-barcode'
import {
  type CardDraft,
  type CardValues,
  cardNumberCapitals,
  cardNumberKeyboard,
  cardNumberMaxLength,
  checkCardDraft,
  FIELD_LIMITS,
} from './loyalty-card-draft'

/** What a Catalog store says about its cards, for the hints. */
export interface StoreHints {
  name: string
  barcodeFormat: BarcodeFormat
  formatConfidence: 'sourced' | 'guess'
  numberLength?: number
  numberPrefix?: string
}

/**
 * A photo slot as it goes to Convex: `undefined` leaves it as it is, a
 * storage id sets it, `null` takes the one that is there off.
 */
export type PhotoChange = string | null | undefined

export interface CardSubmission extends CardValues {
  /** Only for a store typed by hand; a Catalog store keeps its own colour. */
  brandColor?: string
  frontPhotoId: PhotoChange
  backPhotoId: PhotoChange
}

/**
 * A new store for a form that is already filled in. Each field present
 * replaces the one typed; absent ones stay. `key` changes once per new store.
 */
export interface StoreSeed {
  key: number
  storeName?: string
  cardNumber?: string
  barcodeFormat?: BarcodeFormat
}

export function LoyaltyCardForm({
  initial,
  store,
  storeFixed,
  colorPickable = false,
  initialColor,
  storeSeed,
  photoUrls,
  submitting,
  problem,
  onSubmit,
}: {
  initial: CardDraft
  /** The Catalog entry the card comes from, for its hints. */
  store?: StoreHints
  /** Whether the store's name is the Catalog's, and so not typed here. */
  storeFixed: boolean
  /** Whether the store's colour is chosen here: only for a store typed by hand. */
  colorPickable?: boolean
  initialColor?: string
  storeSeed?: StoreSeed
  photoUrls?: { front: string | null; back: string | null }
  submitting: boolean
  /** Why the last save failed, already in words. */
  problem: string | null
  onSubmit: (values: CardSubmission) => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.loyaltyCards.form
  const generateUploadUrl = useMutation(api.loyaltyCards.generateUploadUrl)

  const [draft, setDraft] = useState(initial)
  const [color, setColor] = useState(initialColor ?? DEFAULT_STORE_COLOR)
  const [seedKey, setSeedKey] = useState(storeSeed?.key)
  if (storeSeed && storeSeed.key !== seedKey) {
    // A new store, chosen while this form kept everything else.
    setSeedKey(storeSeed.key)
    const { key: _key, ...fields } = storeSeed
    setDraft((current) => ({
      ...current,
      ...Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
      ),
    }))
  }
  const [front, setFront] = useState<PhotoChange>(undefined)
  const [back, setBack] = useState<PhotoChange>(undefined)
  const [uploads, setUploads] = useState({ front: false, back: false })
  const [numberTouched, setNumberTouched] = useState(
    initial.cardNumber.length > 0,
  )
  const [storeTouched, setStoreTouched] = useState(false)
  const numberRef = useRef<TextInputInstance>(null)
  const holderRef = useRef<TextInputInstance>(null)
  const noteRef = useRef<TextInputInstance>(null)

  const check = checkCardDraft(draft)
  const uploading = uploads.front || uploads.back
  const numberProblem =
    !check.ok && numberTouched ? check.numberProblem : null
  const storeMissing = !check.ok && storeTouched && check.storeMissing
  const formatIsGuess =
    store?.formatConfidence === 'guess' &&
    draft.barcodeFormat === store.barcodeFormat
  const numberHints = [
    store?.numberLength
      ? fmt(words.cardNumberHintLength, { length: store.numberLength })
      : null,
    store?.numberPrefix
      ? fmt(words.cardNumberHintPrefix, { prefix: store.numberPrefix })
      : null,
  ]
    .filter(Boolean)
    .join(' ')
  const storeLabel = draft.storeName.trim() || t.loyaltyCards.picker.otherStore

  function set<K extends keyof CardDraft>(key: K, value: CardDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function submit() {
    setNumberTouched(true)
    setStoreTouched(true)
    if (uploading || submitting) return
    if (!check.ok) {
      haptics.actionFailed()
      return
    }
    onSubmit({
      ...check.values,
      brandColor: colorPickable ? color : undefined,
      frontPhotoId: front,
      backPhotoId: back,
    })
  }

  function photoLabels(heading: string, alt: string) {
    return {
      heading,
      take: words.takePhoto,
      choose: words.choosePhoto,
      replace: words.replacePhoto,
      remove: words.removePhoto,
      uploading: words.waitingForPhoto,
      denied: words.photoDenied,
      failed: words.photoFailed,
      alt: fmt(alt, { store: storeLabel }),
    }
  }

  return (
    <View style={styles.form}>
      {storeFixed ? null : (
        <View style={styles.field}>
          <Field
            label={words.storeName}
            value={draft.storeName}
            onChangeText={(next) => set('storeName', next)}
            onBlur={() => setStoreTouched(true)}
            maxLength={FIELD_LIMITS.storeName}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => numberRef.current?.focus()}
            invalid={storeMissing}
            testID="loyalty-card-store-name"
          />
          {storeMissing ? (
            <Text
              accessibilityRole="alert"
              style={[TYPE.footnote, { color: tokens.danger }]}
            >
              {t.loyaltyCards.refusals['loyalty:needsStore']}
            </Text>
          ) : null}
        </View>
      )}

      {colorPickable ? (
        <View style={styles.field}>
          <Text style={[TYPE.footnoteStrong, styles.label, { color: tokens.muted }]}>
            {words.color}
          </Text>
          <ColorSwatches value={color} onChange={setColor} />
        </View>
      ) : null}

      <View style={styles.field}>
        <Field
          ref={numberRef}
          label={words.cardNumber}
          value={draft.cardNumber}
          onChangeText={(next) => set('cardNumber', next)}
          onBlur={() => setNumberTouched(true)}
          keyboardType={cardNumberKeyboard(draft.barcodeFormat)}
          autoCapitalize={cardNumberCapitals(draft.barcodeFormat)}
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          maxLength={cardNumberMaxLength(draft.barcodeFormat)}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => holderRef.current?.focus()}
          accessibilityHint={numberHints || undefined}
          invalid={Boolean(numberProblem)}
          testID="loyalty-card-number-input"
        />
        {numberHints ? (
          <Text style={[TYPE.footnote, { color: tokens.muted }]}>
            {numberHints}
          </Text>
        ) : null}
        {numberProblem ? (
          <Text
            accessibilityRole="alert"
            testID="loyalty-card-number-problem"
            style={[TYPE.footnote, { color: tokens.danger }]}
          >
            {words.problems[numberProblem]}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={[TYPE.footnoteStrong, styles.label, { color: tokens.muted }]}>
          {words.barcodeFormat}
        </Text>
        <FormatSelect
          value={draft.barcodeFormat}
          onChange={(format) => set('barcodeFormat', format)}
        />
        {formatIsGuess ? (
          <Text style={[TYPE.footnote, { color: tokens.muted }]}>
            {fmt(words.formatGuess, { store: storeLabel })}
          </Text>
        ) : null}
      </View>

      {check.ok ? (
        <View style={styles.field}>
          <Text style={[TYPE.footnoteStrong, styles.label, { color: tokens.muted }]}>
            {words.preview}
          </Text>
          <CardBarcode
            format={check.values.barcodeFormat}
            value={check.values.cardNumber}
            size="preview"
            label={fmt(t.loyaltyCards.detail.barcodeLabel, {
              format: t.loyaltyCards.formats[check.values.barcodeFormat],
              store: storeLabel,
            })}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <Field
          ref={holderRef}
          label={words.holder}
          value={draft.holder}
          onChangeText={(next) => set('holder', next)}
          maxLength={FIELD_LIMITS.holder}
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => noteRef.current?.focus()}
          accessibilityHint={words.holderHint}
          testID="loyalty-card-holder"
        />
        <Text style={[TYPE.footnote, { color: tokens.muted }]}>
          {words.holderHint}
        </Text>
      </View>

      <Field
        ref={noteRef}
        label={words.note}
        value={draft.note}
        onChangeText={(next) => set('note', next)}
        maxLength={FIELD_LIMITS.note}
        multiline
        testID="loyalty-card-note"
      />

      <PhotoField
        photoUrl={photoUrls?.front}
        value={front}
        onChange={setFront}
        onBusyChange={(busy) => setUploads((now) => ({ ...now, front: busy }))}
        generateUploadUrl={() => generateUploadUrl({})}
        preset="loyaltyCardPhoto"
        disabled={submitting}
        testID="loyalty-card-front-photo"
        labels={photoLabels(words.frontPhoto, t.loyaltyCards.till.front)}
      />
      <PhotoField
        photoUrl={photoUrls?.back}
        value={back}
        onChange={setBack}
        onBusyChange={(busy) => setUploads((now) => ({ ...now, back: busy }))}
        generateUploadUrl={() => generateUploadUrl({})}
        preset="loyaltyCardPhoto"
        disabled={submitting}
        testID="loyalty-card-back-photo"
        labels={photoLabels(words.backPhoto, t.loyaltyCards.till.back)}
      />

      {problem ? (
        <Text
          accessibilityRole="alert"
          testID="loyalty-card-save-problem"
          style={[TYPE.subhead, { color: tokens.danger }]}
        >
          {problem}
        </Text>
      ) : null}

      <Button
        label={uploading ? words.waitingForPhoto : words.save}
        onPress={submit}
        busy={submitting}
        disabled={uploading}
        testID="loyalty-card-save"
      />
    </View>
  )
}

/**
 * The store's colour, as a row of swatches: few enough to take in at a
 * glance, and the same set the web suggests. One is always chosen.
 */
function ColorSwatches({
  value,
  onChange,
}: {
  value: string
  onChange: (hex: string) => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const names = t.loyaltyCards.form.colors
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t.loyaltyCards.form.color}
      style={styles.swatches}
    >
      {STORE_COLOR_PRESETS.map((preset) => {
        const selected = preset.hex === value.toLowerCase()
        return (
          <Pressable
            key={preset.id}
            accessibilityRole="radio"
            accessibilityLabel={names[preset.id]}
            accessibilityState={{ checked: selected }}
            testID={`loyalty-card-color-${preset.id}`}
            hitSlop={4}
            onPress={() => {
              haptics.selectionChanged()
              onChange(preset.hex)
            }}
            style={({ pressed }) => [
              styles.swatchRing,
              { borderColor: selected ? tokens.ink : 'transparent' },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.swatch,
                // A hairline keeps light presets (yellow) visible on a light page.
                { backgroundColor: preset.hex, borderColor: tokens.hair },
              ]}
            >
              {selected ? (
                <UI_ICONS.Check
                  size={18}
                  color={textOnBrand(preset.hex)}
                  strokeWidth={2.4}
                />
              ) : null}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * The barcode type, as a field that opens the platform menu on a tap. The
 * menu's iOS host sizes itself to its children, so the field is measured
 * first and handed its width (as `NativeContextMenu` does for rows).
 */
function FormatSelect({
  value,
  onChange,
}: {
  value: BarcodeFormat
  onChange: (format: BarcodeFormat) => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.loyaltyCards
  const [width, setWidth] = useState<number>()
  const field = (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${words.form.barcodeFormat}: ${words.formats[value]}`}
      accessibilityHint={words.form.chooseFormat}
      testID="loyalty-card-format"
      style={[
        styles.select,
        { width, borderColor: tokens.hair, backgroundColor: tokens.surface },
      ]}
    >
      <Text style={[TYPE.body, styles.selectText, { color: tokens.ink }]}>
        {words.formats[value]}
      </Text>
      <UI_ICONS.ChevronDown size={18} color={tokens.muted} strokeWidth={1.9} />
    </View>
  )
  return (
    <View
      style={styles.selectSlot}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width == null ? (
        field
      ) : (
        <MenuView
          testID="loyalty-card-format-menu"
          title={words.form.chooseFormat}
          shouldOpenOnLongPress={false}
          onOpenMenu={() => haptics.menuOpened()}
          actions={BARCODE_FORMATS.map((format) => ({
            id: format,
            title: words.formats[format],
            state: value === format ? ('on' as const) : ('off' as const),
          }))}
          onPressAction={({ nativeEvent }) => {
            const picked = BARCODE_FORMATS.find(
              (format) => format === nativeEvent.event,
            )
            if (picked) onChange(picked)
          }}
        >
          {field}
        </MenuView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  field: { gap: 6 },
  label: { letterSpacing: 0.2 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: RADIUS.card,
  },
  selectText: { flex: 1 },
  selectSlot: { alignSelf: 'stretch' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatchRing: {
    padding: 3,
    borderWidth: 2,
    borderRadius: RADIUS.pill,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
})
