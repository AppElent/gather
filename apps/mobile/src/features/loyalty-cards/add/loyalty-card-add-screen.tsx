/**
 * Adding a card, in the order a card in the hand suggests (APP-142): scan its
 * barcode, choose its store, check the fields and save.
 *
 * The scan fills in the number and barcode type, and when the number fits one
 * Catalog store's pattern, that store is offered first. Every step has a way
 * past the camera — "Type the number instead" — so a phone without one, a
 * refused permission or a code that will not scan still ends in a card.
 *
 * Back steps back through the flow (APP-160): Android's back button goes from
 * the fields to the store and from the store to the camera, and leaves only
 * from there. The form stays mounted, hidden, while the store is changed, so
 * "Change store" keeps the holder, the note and any photo already uploaded.
 * Opened from a link with nothing beneath it, the screen draws its own back
 * button to the Loyalty cards list.
 */
import { useMutation } from 'convex/react'
import { Stack, useIsFocused, useNavigation, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, useI18n } from '../../../i18n'
import {
  moduleDestination,
  moduleHref,
} from '../../../modules/moduleDestination'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, TYPE, useTokens } from '../../../theme/tokens'
import { HeaderIconButton } from '../../../ui/header-icon-button'
import { cardSaveProblem } from '../components/card-save-problem'
import {
  type CardSubmission,
  LoyaltyCardForm,
  type StoreSeed,
} from '../components/loyalty-card-form'
import { StoreTile } from '../components/store-tile'
import type { Retailer } from '../loyalty-card-types'
import {
  type AddStep,
  type ChosenStore,
  reseedFor,
  stepBefore,
} from './add-flow'
import { suggestedRetailer } from './card-scan'
import { CardScanner } from './card-scanner'
import { RetailerPicker } from './retailer-picker'

export function LoyaltyCardAddScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const navigation = useNavigation()
  const focused = useIsFocused()
  const { t } = useI18n()
  const { group } = useGroup()
  const words = t.loyaltyCards
  const create = useMutation(api.loyaltyCards.create)
  // The whole Catalog, by name: the picker filters it in place.
  const retailers = useQuery(api.loyaltyCards.searchCatalog, { query: '' })
  const [state, setState] = useState<AddStep>({ step: 'scan' })
  // Set on the first store chosen; from then on the form stays mounted.
  const [chosen, setChosen] = useState<ChosenStore | null>(null)
  const [storeSeed, setStoreSeed] = useState<StoreSeed>()
  const [submitting, setSubmitting] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  // Nothing beneath this screen in its own stack: it was opened from a link.
  // Not `canGoBack()`, which also asks the tabs, and they can always go back
  // to Home.
  const alone = (navigation.getState()?.index ?? 0) === 0
  const leave = () => router.replace(moduleDestination('loyalty-cards'))

  /** One step back; false when there is no step left and back should leave. */
  function stepBack(): boolean {
    if (submitting) return true
    const before = stepBefore(state, chosen)
    if (before) {
      setProblem(null)
      setState(before)
      return true
    }
    if (alone) {
      leave()
      return true
    }
    return false
  }
  const stepBackRef = useRef(stepBack)
  stepBackRef.current = stepBack

  useEffect(() => {
    if (!focused) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () =>
      stepBackRef.current(),
    )
    return () => subscription.remove()
  }, [focused])

  function choose(next: ChosenStore) {
    if (chosen) setStoreSeed(reseedFor(chosen, next, (storeSeed?.key ?? 0) + 1))
    setChosen(next)
    setState({ step: 'fields' })
  }

  const title =
    state.step === 'scan'
      ? words.scan.title
      : state.step === 'store'
        ? words.picker.title
        : words.form.createTitle
  const headerLeft = alone
    ? () => (
        <HeaderIconButton
          label={t.modules.byId['loyalty-cards'].label}
          testID="loyalty-card-add-back"
          onPress={leave}
        >
          <UI_ICONS.ChevronLeft size={24} color={tokens.ink} strokeWidth={2} />
        </HeaderIconButton>
      )
    : undefined

  const retailer = chosen?.retailer ?? null
  const scanned = chosen?.scanned ?? null

  async function save(values: CardSubmission) {
    setSubmitting(true)
    setProblem(null)
    try {
      const id: Id<'loyaltyCards'> = await create({
        groupSlug: group.slug,
        catalogKey: retailer?.seedKey,
        storeName: values.storeName,
        brandColor: retailer ? undefined : values.brandColor,
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
      <Stack.Screen options={{ headerShown: true, title, headerLeft }} />
      {state.step === 'scan' ? (
        <CardScanner
          onScanned={(next) => setState({ step: 'store', scanned: next })}
          onTypeInstead={() => setState({ step: 'store', scanned: null })}
        />
      ) : null}
      {state.step === 'store' ? (
        <StoreStep
          retailers={retailers}
          scanned={state.scanned}
          onScanAgain={() => setState({ step: 'scan' })}
          onChoose={(picked) =>
            choose({ scanned: state.scanned, retailer: picked })
          }
        />
      ) : null}
      {chosen ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          testID="loyalty-card-fields"
          style={[
            { backgroundColor: tokens.ground },
            // Hidden, not unmounted, while the store is changed.
            state.step !== 'fields' && styles.hidden,
          ]}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 32 },
          ]}
        >
          <View
            style={[
              styles.store,
              { backgroundColor: tokens.surface, borderColor: tokens.hair },
            ]}
          >
            {retailer ? (
              <StoreTile
                name={retailer.name}
                color={retailer.brandColor}
                catalogKey={retailer.seedKey}
                size="medium"
              />
            ) : null}
            <Text
              style={[TYPE.bodyStrong, styles.storeName, { color: tokens.ink }]}
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
                { borderColor: tokens.hair },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[TYPE.footnoteStrong, { color: tokens.ink }]}>
                {words.picker.changeStore}
              </Text>
            </Pressable>
          </View>

          <LoyaltyCardForm
            store={retailer ?? undefined}
            storeFixed={Boolean(retailer)}
            colorPickable={!retailer}
            storeSeed={storeSeed}
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
      ) : null}
    </>
  )
}

/** Choosing the store, with the scan's suggestion first when there is one. */
function StoreStep({
  retailers,
  scanned,
  onScanAgain,
  onChoose,
}: {
  retailers: Retailer[] | undefined
  scanned: ChosenStore['scanned']
  onScanAgain: () => void
  onChoose: (retailer: Retailer | null) => void
}) {
  const { t } = useI18n()
  const words = t.loyaltyCards
  return (
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
      onScanAgain={scanned ? onScanAgain : undefined}
      onPick={onChoose}
      onOtherStore={() => onChoose(null)}
    />
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
  storeName: { flex: 1 },
  change: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
  },
  pressed: { opacity: 0.6 },
  hidden: { display: 'none' },
})
