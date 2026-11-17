/**
 * The add tab's sheet: quick actions (APP-206). It shows what you need fast,
 * the Group's Loyalty cards, and keeps every capture verb below them.
 * Design: `designs/quick-actions/README.md`, direction A.
 *
 * It draws nothing of its own frame. Every sheet in the app is the same
 * `NativeSheet` — one drag gesture, one scrim, one answer to the keyboard — so
 * a fix to any of those is a fix to all of them. This one only needs a Back
 * button in the heading, which is what `leading` is for.
 */
import { useAuth } from '@clerk/expo'
import { type Href, router } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

import { NativeSheet } from '../components/NativeSheet'
import { api } from '../convex/api'
import { useLiveQuery, useQuery } from '../convex/queries'
import {
  STORE_CARD_HEIGHT,
  STORE_CARD_WIDTH,
  StoreCard,
} from '../features/loyalty-cards/components/store-card'
import { cardLastUsed } from '../features/loyalty-cards/list/card-last-used'
import { offlineGroupCards } from '../features/loyalty-cards/offline/offline-cards'
import { useGroup } from '../group/GroupProvider'
import { fmt, useI18n } from '../i18n'
import { moduleHref } from '../modules/moduleDestination'
import { QuickAddTask } from '../modules/tasks/QuickAddTask'
import { SubjectPickerSheet } from '../modules/tasting/SubjectPickerSheet'
import { MODULE_ICONS, UI_ICONS } from '../theme/icons'
import { RADIUS, SPACE, TYPE, useTokens } from '../theme/tokens'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { ModuleTile, moduleTile } from '../ui/module-tile'
import { SectionLabel } from '../ui/section-label'
import { isAccessibilityTextSize } from '../ui/text-scale'
import {
  QUICK_ACTIONS,
  type QuickAction,
  type QuickActionId,
  quickCardsSection,
  quickGridColumns,
  quickGridRows,
  quickTileWidth,
} from './quickActions'

/** What a card in the row draws; a live card and a saved copy both are one. */
interface QuickCard {
  _id: string
  storeName: string
  catalogKey?: string
  brandColor?: string
  holder?: string
  lastUsedAt?: number
}

/** The placeholders in the cards row while nothing is known yet. */
const PLACEHOLDER_CARDS = 3
/** An Add tile's minimum height, so a row of one-line labels stays even. */
const TILE_MIN_HEIGHT = 96

export function QuickActionSheet({
  visible,
  groupName,
  initialAction,
  requestCount = 0,
  onClose,
}: {
  visible: boolean
  groupName: string
  /** A `row` action whose form is open on arrival (`<scheme>://quick?action=`). */
  initialAction?: QuickActionId
  /**
   * Bumped by each `<scheme>://quick` request. A new one while the sheet is up
   * opens `initialAction` in place: remounting the native sheet instead would
   * dismiss it, and iOS drops the new presentation.
   */
  requestCount?: number
  onClose: () => void
}) {
  if (!visible) return null
  return (
    <SheetBody
      groupName={groupName}
      initialAction={initialAction}
      requestCount={requestCount}
      onClose={onClose}
    />
  )
}

function SheetBody({
  groupName,
  initialAction,
  requestCount,
  onClose,
}: {
  groupName: string
  initialAction?: QuickActionId
  requestCount: number
  onClose: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const { fontScale } = useWindowDimensions()
  const [openId, setOpenId] = useState<QuickActionId | null>(
    initialAction ?? null,
  )
  const [seenRequest, setSeenRequest] = useState(requestCount)
  if (requestCount !== seenRequest) {
    setSeenRequest(requestCount)
    setOpenId(initialAction ?? null)
  }
  // Measured, because flex leaves a column as wide as its label.
  const [gridWidth, setGridWidth] = useState(0)
  // What this launcher has saved since it opened. A haptic is never the only
  // confirmation (`feedback/haptics.ts`), so each save is named here.
  const [added, setAdded] = useState<string[]>([])
  const text = t.shell.add
  const Back = UI_ICONS.ChevronLeft
  const openAction = QUICK_ACTIONS.find((action) => action.id === openId)
  // The tasting Modules' first step lives in the launcher and their second
  // does not: this swaps the whole sheet for the subject picker, which then
  // pushes the composer. See `QuickActionKind`'s `compose`.
  const composing =
    openAction?.kind === 'compose' ? openAction.tastingKind : undefined
  const columns = quickGridColumns(fontScale)
  const tileWidth = quickTileWidth(gridWidth, columns, SPACE[3])

  /** Leave the sheet for a screen: a card, the list, the scanner, a form. */
  const go = (href: Href) => {
    onClose()
    router.push(href)
  }

  const choose = (action: QuickAction) => {
    if (action.kind === 'handoff') {
      go(action.href)
      return
    }
    // A `row` tile toggles its form under the grid.
    setOpenId((current) =>
      action.kind === 'row' && current === action.id ? null : action.id,
    )
  }

  /** The form a `row` action expands into, under the grid. */
  const capture = (action: QuickAction) => {
    switch (action.id) {
      case 'task-new':
        return (
          <QuickAddTask
            onSaved={(title, list) => {
              setAdded((items) => [...items, `${title} — ${list}`])
              setOpenId(null)
            }}
          />
        )
      default:
        return null
    }
  }

  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text.back}
      onPress={() => setOpenId(null)}
      hitSlop={12}
      style={({ pressed }) => [
        styles.close,
        { backgroundColor: tokens.surface2 },
        pressed && styles.pressed,
      ]}
    >
      <Back size={18} color={tokens.muted} />
    </Pressable>
  )

  if (composing) {
    return (
      <SubjectPickerSheet
        kind={composing}
        onClose={onClose}
        onChoose={(choice) => {
          onClose()
          router.push(
            moduleHref(`/all/tasting/${composing}/compose`, {
              mode: 'new',
              ...('subjectId' in choice
                ? { subjectId: choice.subjectId }
                : {
                    name: choice.name,
                    ...(choice.catalogKey
                      ? { catalogKey: choice.catalogKey }
                      : {}),
                  }),
            }),
          )
        }}
        leading={backButton}
      />
    )
  }

  const expanded = openAction?.kind === 'row' ? openAction : undefined

  return (
    <NativeSheet
      title={fmt(text.title, { group: groupName })}
      subtitle={
        added.length
          ? fmt(text.saved, { items: added.join(', ') })
          : text.subtitle
      }
      onClose={onClose}
      background="ground"
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.sections}>
          <LoyaltyCardsSection go={go} />

          <View style={styles.section}>
            <SectionLabel>{text.addHeading}</SectionLabel>
            <View
              style={styles.grid}
              onLayout={(event) =>
                setGridWidth(event.nativeEvent.layout.width)
              }
            >
              {quickGridRows(QUICK_ACTIONS, columns).map((row) => (
                <View key={row.map((a) => a?.id).join()} style={styles.gridRow}>
                  {row.map((action, slot) =>
                    action ? (
                      <ActionTile
                        key={action.id}
                        action={action}
                        selected={expanded?.id === action.id}
                        width={tileWidth}
                        onPress={() => choose(action)}
                      />
                    ) : (
                      <View key={`empty-${slot}`} style={{ width: tileWidth }} />
                    ),
                  )}
                </View>
              ))}
            </View>
            {expanded ? (
              <Card style={styles.capture}>{capture(expanded)}</Card>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </NativeSheet>
  )
}

/**
 * The Group's Loyalty cards, last used first; one tap opens a card for the
 * till. Read the way the list screen reads them (`useQuery`, which answers
 * from the last-known copy until Convex does), and from this Group's offline
 * copy when neither has anything, so a sheet opened with no signal still
 * shows the cards saved on this phone.
 */
function LoyaltyCardsSection({ go }: { go: (href: Href) => void }) {
  const tokens = useTokens()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const { userId } = useAuth()
  const { fontScale } = useWindowDimensions()
  const text = t.shell.add.cards
  const words = t.loyaltyCards
  const args = { groupSlug: group.slug }
  const live = useLiveQuery(api.loyaltyCards.list, args)
  const shown = useQuery(api.loyaltyCards.list, args)
  const missing = shown === undefined
  const saved = useMemo(
    () => (missing ? offlineGroupCards(userId, group.slug) : undefined),
    [missing, userId, group.slug],
  )
  const section = quickCardsSection<QuickCard>({ live, shown, saved })
  const scan = () => go(moduleHref('/all/loyalty-cards/new'))
  const tile = moduleTile('loyalty-cards')
  const stacked = isAccessibilityTextSize(fontScale)

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle}>
          <SectionLabel>{text.heading}</SectionLabel>
        </View>
        {section.kind === 'cards' ? (
          <Pressable
            testID="quick-cards-all"
            accessibilityRole="button"
            onPress={() => go(moduleHref('/all/loyalty-cards'))}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={[TYPE.subhead, { color: tokens.ink }]}>
              {text.all}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {section.kind === 'empty' ? (
        <View
          testID="quick-cards-empty"
          style={[
            styles.empty,
            stacked && styles.emptyStacked,
            { backgroundColor: tokens.surface },
          ]}
        >
          {tile ? (
            <ModuleTile group={tile.group} glyph={tile.glyph} size="m" />
          ) : null}
          <View style={styles.emptyText}>
            <Text style={[TYPE.bodyStrong, { color: tokens.ink }]}>
              {text.emptyTitle}
            </Text>
            <Text style={[TYPE.footnote, { color: tokens.muted }]}>
              {text.emptyBody}
            </Text>
          </View>
          <Button label={text.scan} onPress={scan} testID="quick-cards-scan" />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.cardsRow}
          contentContainerStyle={styles.cardsContent}
        >
          {section.kind === 'loading'
            ? Array.from({ length: PLACEHOLDER_CARDS }, (_, index) => (
                <View
                  key={index}
                  accessible={index === 0}
                  accessibilityLabel={index === 0 ? t.actions.loading : undefined}
                  style={[styles.placeholder, { backgroundColor: tokens.surface }]}
                />
              ))
            : section.cards.map((card) => (
                <Pressable
                  key={card._id}
                  testID={`quick-card-${card._id}`}
                  accessibilityRole="button"
                  accessibilityLabel={fmt(text.show, { store: card.storeName })}
                  onPress={() =>
                    go(
                      moduleHref('/all/loyalty-cards/card', {
                        cardId: card._id,
                      }),
                    )
                  }
                  style={({ pressed }) => [
                    styles.cardItem,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <StoreCard
                    name={card.storeName}
                    color={card.brandColor}
                    catalogKey={card.catalogKey}
                  />
                  <View style={styles.cardText}>
                    <Text style={[styles.strong, { color: tokens.ink }]}>
                      {card.storeName}
                    </Text>
                    {section.usageKnown ? (
                      <Text style={[TYPE.footnote, { color: tokens.muted }]}>
                        {card.lastUsedAt
                          ? cardLastUsed(
                              card.lastUsedAt,
                              words.list.when,
                              locale,
                            )
                          : words.index.neverUsed}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
        </ScrollView>
      )}
    </View>
  )
}

/** One capture verb: its Module's tile, the short label and the Module. */
function ActionTile({
  action,
  selected,
  width,
  onPress,
}: {
  action: QuickAction
  selected: boolean
  /** The column's width; `undefined` until the grid is measured. */
  width: number | undefined
  onPress: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const copy = t.shell.add.actions[action.id]

  return (
    <Pressable
      testID={`quick-action-${action.id}`}
      accessibilityRole="button"
      accessibilityLabel={copy.label}
      accessibilityState={
        action.kind === 'row' ? { expanded: selected } : undefined
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          width,
          backgroundColor:
            pressed || selected ? tokens.surface2 : tokens.surface,
          borderColor: selected ? tokens.ink : 'transparent',
        },
      ]}
    >
      <ModuleTile
        group={action.group}
        glyph={MODULE_ICONS[action.icon]}
        size="m"
      />
      <View>
        <Text style={[styles.strong, { color: tokens.ink }]}>{copy.short}</Text>
        <Text style={[TYPE.footnote, { color: tokens.muted }]}>
          {copy.module}
        </Text>
      </View>
    </Pressable>
  )
}

/** The tile border that marks the open `row` tile; kept when unselected. */
const SELECTED_BORDER = 2

const styles = StyleSheet.create({
  close: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The sheet pads its content by the gutter; the scroll view takes it back
  // and pads inside, so the cards row can run to the sheet's edges.
  scroll: { marginHorizontal: -SPACE[4] },
  scrollContent: { paddingHorizontal: SPACE[4] },
  sections: { gap: SPACE[5], paddingBottom: SPACE[1] },
  section: { gap: SPACE[2] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { flex: 1 },
  // The row runs to the sheet's edges and scrolls under them; its first and
  // last cards keep the gutter.
  cardsRow: { marginHorizontal: -SPACE[4] },
  cardsContent: { paddingHorizontal: SPACE[4], gap: SPACE[3] },
  cardItem: { width: STORE_CARD_WIDTH, gap: 6 },
  cardPressed: { transform: [{ scale: 0.97 }] },
  cardText: { paddingHorizontal: SPACE[1] },
  placeholder: {
    width: STORE_CARD_WIDTH,
    height: STORE_CARD_HEIGHT,
    borderRadius: RADIUS.thumb,
    borderCurve: 'continuous',
  },
  strong: { ...TYPE.subhead, fontWeight: '600' },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    padding: SPACE[4],
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
  },
  emptyStacked: { flexDirection: 'column', alignItems: 'stretch' },
  emptyText: { flexShrink: 1, flexGrow: 1 },
  grid: { gap: SPACE[3] },
  gridRow: { flexDirection: 'row', gap: SPACE[3] },
  tile: {
    minHeight: TILE_MIN_HEIGHT,
    padding: SPACE[3] - SELECTED_BORDER,
    borderWidth: SELECTED_BORDER,
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    justifyContent: 'space-between',
    gap: SPACE[2],
  },
  capture: { marginTop: SPACE[1], paddingVertical: 14 },
  pressed: { opacity: 0.7 },
})
