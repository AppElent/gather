/**
 * Correct a card (APP-142): the same fields as adding one, filled in.
 *
 * The store's name stays editable, as on the web — a Catalog store can be
 * renamed for this household ("AH Kerkstraat") and keeps its colour. A photo
 * left alone is sent as `undefined` and stays; one taken off is `null`.
 * A store typed by hand can be recoloured here; a Catalog one keeps its own.
 */
import { useMutation } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../../components/LoadingSkeleton'
import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, useI18n } from '../../../i18n'
import { TYPE, useTokens } from '../../../theme/tokens'
import { cardSaveProblem } from '../components/card-save-problem'
import {
  type CardSubmission,
  LoyaltyCardForm,
} from '../components/loyalty-card-form'

export function LoyaltyCardEditScreen({
  cardId,
}: {
  cardId: Id<'loyaltyCards'>
}) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useI18n()
  const { group } = useGroup()
  const words = t.loyaltyCards
  const card = useQuery(api.loyaltyCards.get, {
    groupSlug: group.slug,
    id: cardId,
  })
  const retailers = useQuery(api.loyaltyCards.searchCatalog, { query: '' })
  const update = useMutation(api.loyaltyCards.update)
  const [submitting, setSubmitting] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  if (card === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: words.till.edit }}
        />
        <View style={[styles.fill, { backgroundColor: tokens.ground }]}>
          <LoadingSkeleton rows={4} label={t.actions.loading} />
        </View>
      </>
    )
  }

  if (card === null) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: words.till.edit }}
        />
        <View style={[styles.fill, { backgroundColor: tokens.ground }]}>
          <Text
            testID="loyalty-card-not-found"
            style={[TYPE.body, styles.missing, { color: tokens.muted }]}
          >
            {words.detail.notFound}
          </Text>
        </View>
      </>
    )
  }

  const store = card.catalogKey
    ? retailers?.find((retailer) => retailer.seedKey === card.catalogKey)
    : undefined

  async function save(values: CardSubmission) {
    if (!card) return
    setSubmitting(true)
    setProblem(null)
    try {
      await update({
        groupSlug: group.slug,
        id: card._id,
        storeName: values.storeName,
        brandColor: card.catalogKey ? undefined : values.brandColor,
        cardNumber: values.cardNumber,
        barcodeFormat: values.barcodeFormat,
        holder: values.holder,
        note: values.note,
        frontPhotoId: values.frontPhotoId as Id<'_storage'> | null | undefined,
        backPhotoId: values.backPhotoId as Id<'_storage'> | null | undefined,
      })
      haptics.itemSaved()
      router.back()
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
        options={{
          headerShown: true,
          title: fmt(words.form.editTitle, { store: card.storeName }),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <LoyaltyCardForm
          // The hints arrive with the Catalog; the fields keep what was typed.
          store={store}
          storeFixed={false}
          colorPickable={!card.catalogKey}
          initialColor={card.brandColor}
          initial={{
            storeName: card.storeName,
            cardNumber: card.cardNumber,
            barcodeFormat: card.barcodeFormat,
            holder: card.holder ?? '',
            note: card.note ?? '',
          }}
          photoUrls={{ front: card.frontPhotoUrl, back: card.backPhotoUrl }}
          submitting={submitting}
          problem={problem}
          onSubmit={save}
        />
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missing: { textAlign: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
})
