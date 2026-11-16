/**
 * Adding a card, in the order a card in the hand suggests (APP-142): scan its
 * barcode, choose its store, check the fields and save.
 *
 * The scan fills in the number and barcode type, and when the number fits one
 * Catalog store's pattern, that store is offered first. Every step has a way
 * past the camera — "Type the number instead" — so a phone without one, a
 * refused permission or a code that will not scan still ends in a card.
 */
import { useMutation } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, useI18n } from '../../../i18n'
import { moduleHref } from '../../../modules/moduleDestination'
import { RADIUS, TYPE, useTokens } from '../../../theme/tokens'
import { cardSaveProblem } from '../components/card-save-problem'
import { type CardSubmission, LoyaltyCardForm } from '../components/loyalty-card-form'
import { StoreTile } from '../components/store-tile'
import type { Retailer } from '../loyalty-card-types'
import { type ScannedCard, suggestedRetailer } from './card-scan'
import { CardScanner } from './card-scanner'
import { RetailerPicker } from './retailer-picker'

type Step =
  | { step: 'scan' }
  | { step: 'store'; scanned: ScannedCard | null }
  | { step: 'fields'; scanned: ScannedCard | null; retailer: Retailer | null }

export function LoyaltyCardAddScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useI18n()
  const { group } = useGroup()
  const words = t.loyaltyCards
  const create = useMutation(api.loyaltyCards.create)
  // The whole Catalog, by name: the picker filters it in place.
  const retailers = useQuery(api.loyaltyCards.searchCatalog, { query: '' })
  const [state, setState] = useState<Step>({ step: 'scan' })
  const [submitting, setSubmitting] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  if (state.step === 'scan') {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: words.scan.title }} />
        <CardScanner
          onScanned={(scanned) => setState({ step: 'store', scanned })}
          onTypeInstead={() => setState({ step: 'store', scanned: null })}
        />
      </>
    )
  }

  if (state.step === 'store') {
    const { scanned } = state
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: words.picker.title }}
        />
        <RetailerPicker
          retailers={retailers}
          suggestion={
            scanned ? suggestedRetailer(retailers, scanned.cardNumber) : null
          }
          scannedLine={
            scanned
              ? fmt(words.scan.scanned, {
                  format: words.formats[scanned.barcodeFormat],
                  number: scanned.cardNumber,
                })
              : null
          }
          onScanAgain={scanned ? () => setState({ step: 'scan' }) : undefined}
          onPick={(retailer) =>
            setState({ step: 'fields', scanned, retailer })
          }
          onOtherStore={() =>
            setState({ step: 'fields', scanned, retailer: null })
          }
        />
      </>
    )
  }

  const { scanned, retailer } = state

  async function save(values: CardSubmission) {
    setSubmitting(true)
    setProblem(null)
    try {
      const id: Id<'loyaltyCards'> = await create({
        groupSlug: group.slug,
        catalogKey: retailer?.seedKey,
        storeName: values.storeName,
        cardNumber: values.cardNumber,
        barcodeFormat: values.barcodeFormat,
        holder: values.holder,
        note: values.note,
        frontPhotoId: (values.frontPhotoId ?? undefined) as
          | Id<'_storage'>
          | undefined,
        backPhotoId: (values.backPhotoId ?? undefined) as
          | Id<'_storage'>
          | undefined,
      })
      haptics.itemSaved()
      router.replace(
        moduleHref('/all/loyalty-cards/card', { cardId: id, justAdded: '1' }),
      )
    } catch (error) {
      haptics.actionFailed()
      setProblem(
        cardSaveProblem(error, {
          saveFailed: words.form.saveFailed,
          refusals: words.refusals,
        }),
      )
      setSubmitting(false)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: words.form.createTitle }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View
          style={[
            styles.store,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          {retailer ? (
            <StoreTile
              name={retailer.name}
              color={retailer.brandColor}
              size="medium"
            />
          ) : null}
          <Text
            numberOfLines={2}
            style={[TYPE.lead, styles.storeName, { color: tokens.fg }]}
          >
            {retailer ? retailer.name : words.picker.otherStore}
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="loyalty-card-change-store"
            hitSlop={8}
            disabled={submitting}
            onPress={() => {
              setProblem(null)
              setState({ step: 'store', scanned })
            }}
            style={({ pressed }) => [
              styles.change,
              { borderColor: tokens.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[TYPE.label, styles.bold, { color: tokens.fg }]}>
              {words.picker.changeStore}
            </Text>
          </Pressable>
        </View>

        <LoyaltyCardForm
          key={retailer?.seedKey ?? 'other'}
          store={retailer ?? undefined}
          storeFixed={Boolean(retailer)}
          initial={{
            storeName: retailer?.name ?? '',
            cardNumber: scanned?.cardNumber ?? '',
            // A scanned code says what it is; the Catalog only says what the
            // store usually prints.
            barcodeFormat:
              scanned?.barcodeFormat ?? retailer?.barcodeFormat ?? 'CODE_128',
            holder: '',
            note: '',
          }}
          submitting={submitting}
          problem={problem}
          onSubmit={save}
        />
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 18 },
  store: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
  },
  storeName: { flex: 1, fontWeight: '600' },
  change: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: RADIUS.control,
  },
  bold: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
})
