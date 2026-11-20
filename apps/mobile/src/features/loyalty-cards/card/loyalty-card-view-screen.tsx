/**
 * One Loyalty card, as shown at the till (APP-142).
 *
 * The barcode leads, as large as the screen allows, on a white panel in light
 * and dark mode alike, with the number under it for a cashier to type. While
 * the card is on screen it is at full brightness (`useTillBrightness`) and
 * stays awake (`useKeepAwakeWhile`). Both follow focus, not mount: switching
 * tab or opening Edit keeps this screen mounted, and gives both back.
 * Opening it counts as using it, once (`useMarkUsedOnce`), except the open
 * that follows adding the card (`justAdded`).
 *
 * While it is focused it is the open card (`open-card.ts`, APP-443), which the
 * Control Center control opens again. A card the control opened that turns out
 * to be gone gives way to the quick-actions sheet the control otherwise opens.
 *
 * Until Convex answers, it draws the barcode from this Group's saved copy
 * when there is one (`offlineGroupCard`, APP-206), so a card opened from the
 * quick-actions sheet or the list while the connection is lost still works at
 * the till. That copy is display only: no edit, delete, note or photos.
 */
import { useAuth } from '@clerk/expo'
import { Image } from 'expo-image'
import { Stack, useIsFocused, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../../components/LoadingSkeleton'
import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, useI18n } from '../../../i18n'
import { moduleHref } from '../../../modules/moduleDestination'
import { requestQuickSheet } from '../../../shell/quickSheetRequest'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, TYPE, useTokens } from '../../../theme/tokens'
import { HeaderIconButton } from '../../../ui/header-icon-button'
import { CardBarcode } from '../components/card-barcode'
import { StoreTile } from '../components/store-tile'
import { LOYALTY_CARD_ICONS } from '../loyalty-card-icons'
import { offlineGroupCard } from '../offline/offline-cards'
import { useDeleteLoyaltyCard } from '../use-delete-loyalty-card'
import { useRecordOpenCard } from './open-card-store'
import { useKeepAwakeWhile } from './use-keep-awake-while'
import { useMarkUsedOnce } from './use-mark-used-once'
import { useTillBrightness } from './use-till-brightness'

export function LoyaltyCardViewScreen({
  cardId,
  justAdded = false,
  openedByControl = false,
}: {
  cardId: Id<'loyaltyCards'>
  justAdded?: boolean
  /** Opened by the Control Center control as the open card (APP-443). */
  openedByControl?: boolean
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
  const { userId } = useAuth()
  const waiting = card === undefined
  const saved = useMemo(
    () => (waiting ? offlineGroupCard(userId, group.slug, cardId) : undefined),
    [waiting, userId, group.slug, cardId],
  )
  const face = waiting ? saved : card
  const deleteCard = useDeleteLoyaltyCard(group.slug)
  const [problem, setProblem] = useState<string | null>(null)

  const focused = useIsFocused()
  const shown = focused && Boolean(face)
  useKeepAwakeWhile(shown)
  useTillBrightness(shown)
  useMarkUsedOnce(group.slug, cardId, justAdded)
  useRecordOpenCard(
    { cardId, groupId: group._id, groupSlug: group.slug },
    focused,
    face === null,
  )

  // The control asked for the card or else the sheet: a card that is gone
  // gives way to the sheet, over the screen the member was on before.
  const goneFromControl = openedByControl && face === null
  useEffect(() => {
    if (!goneFromControl) return
    router.back()
    requestQuickSheet()
  }, [goneFromControl, router])

  const moduleTitle = t.modules.byId['loyalty-cards'].label

  if (face === undefined) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: moduleTitle }} />
        <View style={[styles.fill, { backgroundColor: tokens.ground }]}>
          <LoadingSkeleton rows={3} label={t.actions.loading} />
        </View>
      </>
    )
  }

  if (face === null) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: moduleTitle }} />
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

  const store = face.storeName
  const formatName = words.formats[face.barcodeFormat]

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: store,
          headerRight: card ? () => (
            <View style={styles.headerActions}>
              <HeaderIconButton
                label={words.till.edit}
                testID="loyalty-card-edit"
                onPress={() =>
                  router.push(
                    moduleHref('/all/loyalty-cards/edit', { cardId: card._id }),
                  )
                }
              >
                <UI_ICONS.Pencil size={19} color={tokens.ink} strokeWidth={1.9} />
              </HeaderIconButton>
              <HeaderIconButton
                label={words.till.delete}
                testID="loyalty-card-delete"
                onPress={() =>
                  deleteCard(card, {
                    onDeleted: () => router.back(),
                    onFailed: setProblem,
                  })
                }
              >
                <LOYALTY_CARD_ICONS.Trash2
                  size={19}
                  color={tokens.danger}
                  strokeWidth={1.9}
                />
              </HeaderIconButton>
            </View>
          ) : undefined,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.store}>
          <StoreTile
            name={store}
            color={face.brandColor}
            catalogKey={face.catalogKey}
            size="large"
          />
          <View style={styles.storeText}>
            <Text
              accessibilityRole="header"
              style={[TYPE.title2, { color: tokens.ink }]}
            >
              {store}
            </Text>
            {face.holder ? (
              <Text style={[TYPE.subhead, { color: tokens.muted }]}>
                {face.holder}
              </Text>
            ) : null}
          </View>
        </View>

        <CardBarcode
          format={face.barcodeFormat}
          value={face.cardNumber}
          label={fmt(words.detail.barcodeLabel, {
            format: formatName,
            store,
          })}
        />
        <Text style={[TYPE.footnote, styles.hint, { color: tokens.muted }]}>
          {words.detail.showAtTill} · {formatName}
        </Text>

        {problem ? (
          <Text
            accessibilityRole="alert"
            style={[TYPE.subhead, { color: tokens.danger }]}
          >
            {problem}
          </Text>
        ) : null}

        {card?.note ? (
          <View style={styles.section}>
            <Text style={[TYPE.footnoteStrong, { color: tokens.muted }]}>
              {words.detail.note}
            </Text>
            <Text selectable style={[TYPE.subhead, { color: tokens.ink }]}>
              {card.note}
            </Text>
          </View>
        ) : null}

        {card?.frontPhotoUrl || card?.backPhotoUrl ? (
          <View style={styles.section}>
            <Text style={[TYPE.footnoteStrong, { color: tokens.muted }]}>
              {words.detail.photos}
            </Text>
            <View style={styles.photos}>
              {card.frontPhotoUrl ? (
                <Image
                  source={{ uri: card.frontPhotoUrl }}
                  style={[styles.photo, { backgroundColor: tokens.surface2 }]}
                  contentFit="cover"
                  accessibilityLabel={fmt(words.till.front, { store })}
                  accessibilityIgnoresInvertColors
                />
              ) : null}
              {card.backPhotoUrl ? (
                <Image
                  source={{ uri: card.backPhotoUrl }}
                  style={[styles.photo, { backgroundColor: tokens.surface2 }]}
                  contentFit="cover"
                  accessibilityLabel={fmt(words.till.back, { store })}
                  accessibilityIgnoresInvertColors
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missing: { textAlign: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  headerActions: { flexDirection: 'row', gap: 4 },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 16 },
  store: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  storeText: { flex: 1, gap: 2 },
  hint: { textAlign: 'center' },
  section: { gap: 8 },
  photos: { flexDirection: 'row', gap: 10 },
  photo: { flex: 1, aspectRatio: 1.586, borderRadius: RADIUS.card },
})
