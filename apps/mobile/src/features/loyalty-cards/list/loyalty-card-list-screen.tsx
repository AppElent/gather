/**
 * The household's Loyalty cards (APP-142), in Convex's order
 * (`compareLoyaltyCards`): cards nobody arranged on top, last used first, so
 * the card shown at the till last week is near the top; then the Group's own
 * arrangement (APP-440). A tap opens the card for the till; holding a row
 * offers Edit, Reorder and Delete. The filter matches the store and whose card
 * it is, the way the web's does.
 *
 * Reorder is a mode (`apps/mobile/DESIGN_SYSTEM.md`), entered from the ⋯ menu
 * or a row's hold menu: grips on the shared `DragList`, no filter, no
 * tap-to-open, Done in the bar. Every drop saves the whole order at once and
 * shows it before Convex answers; a refused write puts the old order back and
 * says so.
 */
import { MenuView } from '@expo/ui/community/menu'
import { cardsInArrangement, foldForSearch } from '@gather/core/loyalty-cards'
import { useMutation } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { type ComponentProps, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
// Gesture Handler's own ScrollView: the reorder grips name it to out-rank it.
import { LegacyScrollView as ScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../../components/LoadingSkeleton'
import { SearchField } from '../../../components/SearchField'
import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../../i18n'
import { moduleHref } from '../../../modules/moduleDestination'
import { DragList } from '../../../shell/all/DragList'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { Button } from '../../../ui/button'
import { HeaderIconButton } from '../../../ui/header-icon-button'
import { InsetList, InsetRow } from '../../../ui/inset-list'
import { moduleTile } from '../../../ui/module-tile'
import { washScreenOptions } from '../../../ui/screen-header'
import { WashHeader } from '../../../ui/wash-header'
import { StoreTile } from '../components/store-tile'
import type { ListedCard } from '../loyalty-card-types'
import { useDeleteLoyaltyCard } from '../use-delete-loyalty-card'
import { cardLastUsed } from './card-last-used'

export function LoyaltyCardListScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const words = t.loyaltyCards
  const cards = useQuery(api.loyaltyCards.list, { groupSlug: group.slug })
  const deleteCard = useDeleteLoyaltyCard(group.slug)
  const reorder = useMutation(api.loyaltyCards.reorder).withOptimisticUpdate(
    (store, args) => {
      const current = store.getQuery(api.loyaltyCards.list, {
        groupSlug: args.groupSlug,
      })
      if (!current) return
      store.setQuery(
        api.loyaltyCards.list,
        { groupSlug: args.groupSlug },
        cardsInArrangement(current, args.ids),
      )
    },
  )
  const [query, setQuery] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [dragging, setDragging] = useState(false)
  // Bumped when a save fails, so the drag list drops its own copy of the
  // order and draws the one Convex rolled back to.
  const [dragKey, setDragKey] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  const canReorder = (cards?.length ?? 0) >= 2
  const arranging = reordering && canReorder
  // Down to one card, the mode ends, so a card added later doesn't reopen it.
  if (reordering && cards !== undefined && !canReorder) setReordering(false)
  const startReorder = () => {
    setQuery('')
    setProblem(null)
    setReordering(true)
  }
  const saveOrder = (ids: string[]) => {
    setProblem(null)
    reorder({ groupSlug: group.slug, ids: ids as Id<'loyaltyCards'>[] }).catch(
      () => {
        haptics.actionFailed()
        setDragKey((key) => key + 1)
        setProblem(t.common.errors.didNotWork)
      },
    )
  }

  const needle = foldForSearch(query.trim())
  const matching = (cards ?? []).filter(
    (card) =>
      !needle ||
      foldForSearch(card.storeName).includes(needle) ||
      foldForSearch(card.holder ?? '').includes(needle),
  )

  const add = () => router.push(moduleHref('/all/loyalty-cards/new'))
  const tile = moduleTile('loyalty-cards')
  const open = (card: ListedCard) =>
    router.push(moduleHref('/all/loyalty-cards/card', { cardId: card._id }))

  return (
    <>
      <Stack.Screen
        options={{
          ...washScreenOptions(t.modules.byId['loyalty-cards'].label),
          headerRight: () =>
            arranging ? (
              <Pressable
                testID="loyalty-card-reorder-done"
                accessibilityRole="button"
                accessibilityLabel={words.index.reorderDone}
                hitSlop={12}
                onPress={() => setReordering(false)}
              >
                <Text style={[styles.headerDone, { color: tokens.accentText }]}>
                  {words.index.reorderDone}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.headerButtons}>
                {canReorder && !needle ? (
                  <MenuView
                    testID="loyalty-card-list-menu"
                    actions={[
                      {
                        id: 'reorder',
                        title: words.index.reorder,
                        image: 'arrow.up.arrow.down',
                      },
                    ]}
                    onPressAction={(event) => {
                      if (event.nativeEvent.event === 'reorder') startReorder()
                    }}
                  >
                    <View style={styles.headerButton}>
                      <UI_ICONS.Ellipsis
                        size={22}
                        color={tokens.ink}
                        strokeWidth={2.2}
                      />
                    </View>
                  </MenuView>
                ) : null}
                <HeaderIconButton
                  label={words.index.add}
                  testID="loyalty-card-add"
                  onPress={add}
                >
                  <UI_ICONS.Plus size={22} color={tokens.ink} strokeWidth={2.2} />
                </HeaderIconButton>
              </View>
            ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        scrollEnabled={!dragging}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {tile && cards !== undefined ? (
          <WashHeader
            group={tile.group}
            glyph={tile.glyph}
            summary={{
              count: plural(locale, cards.length, words.index.count),
              scope: group.name,
            }}
          />
        ) : null}
        <View style={styles.content}>
          {cards === undefined ? (
            <LoadingSkeleton rows={4} label={t.actions.loading} />
          ) : cards.length === 0 ? (
            <View testID="loyalty-card-empty" style={styles.empty}>
              <Text
                accessibilityRole="header"
                style={[TYPE.title2, styles.center, { color: tokens.ink }]}
              >
                {words.index.emptyTitle}
              </Text>
              <Text style={[TYPE.body, styles.center, { color: tokens.muted }]}>
                {fmt(words.index.emptyBody, { group: group.name })}
              </Text>
              <Button
                label={words.index.emptyAction}
                group="home"
                onPress={add}
                testID="loyalty-card-add-first"
              />
            </View>
          ) : arranging ? (
            <>
              <View style={[styles.hint, { backgroundColor: tokens.surface2 }]}>
                <UI_ICONS.GripVertical
                  size={17}
                  color={tokens.ink}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text style={[styles.hintText, { color: tokens.ink }]}>
                  {`${words.index.reorderHint} ${fmt(words.index.reorderShared, { group: group.name })}`}
                </Text>
              </View>
              {problem ? (
                <Text
                  accessibilityRole="alert"
                  style={[TYPE.subhead, { color: tokens.danger }]}
                >
                  {problem}
                </Text>
              ) : null}
              <DragList
                key={dragKey}
                testID="loyalty-card-reorder"
                rowTestID="loyalty-card"
                items={cards.map((card) => ({
                  id: card._id,
                  label: card.storeName,
                  detail: card.holder,
                }))}
                leading={(item) => {
                  const card = cards.find((each) => each._id === item.id)
                  return card ? (
                    <StoreTile
                      name={card.storeName}
                      color={card.brandColor}
                      catalogKey={card.catalogKey}
                      size="medium"
                    />
                  ) : null
                }}
                scrollRef={scrollRef}
                onDragging={setDragging}
                onCommit={saveOrder}
                dragLabel={(label) => fmt(words.index.reorderDrag, { store: label })}
              />
            </>
          ) : (
            <>
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder={words.index.filter}
                clearAccessibilityLabel={words.index.clearFilter}
                testID="loyalty-card-filter"
              />
              {problem ? (
                <Text
                  accessibilityRole="alert"
                  style={[TYPE.subhead, { color: tokens.danger }]}
                >
                  {problem}
                </Text>
              ) : null}
              {matching.length === 0 ? (
                <View style={styles.notFound}>
                  <Text
                    style={[TYPE.body, styles.center, { color: tokens.muted }]}
                  >
                    {words.index.filterEmpty}
                  </Text>
                  <Button
                    label={t.actions.showAll}
                    variant="secondary"
                    onPress={() => setQuery('')}
                    testID="loyalty-card-clear-filter"
                  />
                </View>
              ) : (
                <InsetList>
                  {matching.map((card) => (
                    <CardRow
                      key={card._id}
                      card={card}
                      used={
                        card.lastUsedAt
                          ? fmt(words.index.usedAt, {
                              when: cardLastUsed(
                                card.lastUsedAt,
                                words.list.when,
                                locale,
                              ),
                            })
                          : words.index.neverUsed
                      }
                      onPress={() => open(card)}
                      menu={{
                        actions: [
                          {
                            id: 'edit',
                            title: words.till.edit,
                            image: 'pencil',
                          },
                          ...(canReorder && !needle
                            ? [
                                {
                                  id: 'reorder',
                                  title: words.index.reorder,
                                  image: 'arrow.up.arrow.down' as const,
                                },
                              ]
                            : []),
                          {
                            id: 'delete',
                            title: words.till.delete,
                            image: 'trash',
                            attributes: { destructive: true },
                          },
                        ],
                        onAction: (action) => {
                          if (action === 'edit') {
                            router.push(
                              moduleHref('/all/loyalty-cards/edit', {
                                cardId: card._id,
                              }),
                            )
                          }
                          if (action === 'reorder') startReorder()
                          if (action === 'delete') {
                            setProblem(null)
                            deleteCard(card, { onFailed: setProblem })
                          }
                        },
                      }}
                    />
                  ))}
                </InsetList>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </>
  )
}

function CardRow({
  card,
  used,
  onPress,
  menu,
}: {
  card: ListedCard
  used: string
  onPress: () => void
  menu: ComponentProps<typeof InsetRow>['menu']
}) {
  const detail = [card.holder, used].filter(Boolean).join(' · ')
  return (
    <InsetRow
      testID={`loyalty-card-${card._id}`}
      accessibilityLabel={`${card.storeName}, ${detail}`}
      onPress={onPress}
      menu={menu}
      chevron
      leading={
        <StoreTile
          name={card.storeName}
          color={card.brandColor}
          catalogKey={card.catalogKey}
          size="medium"
        />
      }
      title={card.storeName}
      subtitle={detail}
    />
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[4] },
  empty: { gap: 14, paddingTop: 48, paddingHorizontal: 8 },
  notFound: { gap: 14, paddingVertical: 20 },
  center: { textAlign: 'center' },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  headerButton: { paddingHorizontal: 6, paddingVertical: 6 },
  /** The confirming action of a mode, as the task list's Done. */
  headerDone: { ...TYPE.bodyStrong },
  hint: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    padding: 11,
    borderRadius: RADIUS.card,
  },
  hintText: { ...TYPE.footnote, flex: 1 },
})
