
import { useMutation } from 'convex/react'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../../convex/api'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { plural, useI18n } from '../../i18n'
import {
  lastGroceryListKey,
  readPreference,
  writePreference,
} from '../../prefs/localPreference'
import { moduleSettingsHref } from '../../settings/module-pages'
import { SPACE, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { ModuleHeaderButtons } from '../../ui/module-header-buttons'
import { moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { WashHeader, type WashSummary } from '../../ui/wash-header'
import { moduleHref } from '../moduleDestination'
import { GroceryListsSheet, StorePill } from '../tasks/GroceryListsSheet'
import { groceryListsOf, openGroceryList } from '../tasks/groceryList'
import { NewListSheet } from '../tasks/NewListSheet'
import { useTaskLists } from '../tasks/store'
import { TaskList } from '../tasks/TaskListScreen'
import { GroceriesSourceSheet } from './add-to-groceries/source-sheet'

function KitchenShell({
  title,
  wash,
  children,
}: {
  title: string
  /** The group's wash, the Module's tile and a summary line on top. */
  wash?: { moduleId: string; summary: WashSummary }
  children: React.ReactNode
}) {
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  const tile = wash ? moduleTile(wash.moduleId) : null
  if (wash && tile) {
    return (
      <>
        <Stack.Screen options={washScreenOptions(title)} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: tokens.ground }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          <WashHeader
            group={tile.group}
            glyph={tile.glyph}
            summary={wash.summary}
          />
          <View style={styles.washContent}>{children}</View>
        </ScrollView>
      </>
    )
  }
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {children}
      </ScrollView>
    </>
  )
}

/**
 * The Groceries Module: the grocery list last used on this phone, one of the
 * Group's grocery lists (APP-313), with the store pill that switches between
 * them. A Group with none is offered a new one, or one of its lists.
 */
export function GroceriesScreen() {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const tokens = useTokens('kitchen')
  const set = useMutation(api.kitchen.setGroceryList)
  const lists = useTaskLists()
  const router = useRouter()
  const words = t.tasks.grocery.lists
  const lastKey = lastGroceryListKey(group.slug)
  const [remembered, setRemembered] = useState(() => readPreference(lastKey))
  const [sheet, setSheet] = useState<'lists' | 'new' | 'source' | null>(null)
  const groceryLists = useMemo(() => groceryListsOf(lists ?? []), [lists])
  const selected = openGroceryList(groceryLists, remembered)

  const remember = (listId: string) => {
    writePreference(lastKey, listId)
    setRemembered(listId)
  }
  // A list named by the address is the one to open: a Drop or a new list
  // that just landed on it, even when this screen was already mounted.
  const { listId: named } = useLocalSearchParams<{ listId?: string }>()
  useEffect(() => {
    if (!named) return
    writePreference(lastKey, named)
    setRemembered(named)
  }, [named, lastKey])
  const openAisles = (listId: string) =>
    router.push({ pathname: '/all/groceries/aisles', params: { listId } })

  const newListSheet =
    sheet === 'new' ? (
      <NewListSheet
        initialKind="groceries"
        onClose={() => setSheet(null)}
        onCreated={(list) => remember(list.id)}
      />
    ) : null

  if (lists === undefined)
    return <View style={{ flex: 1, backgroundColor: tokens.ground }} />

  if (selected)
    return (
      <>
        <TaskList
          // A new list is a new screen: its reorder mode and sheets start over.
          key={selected._id}
          listId={selected._id}
          moduleId="groceries"
          addPlaceholder={t.kitchen.addGroceryItem}
          washAccessory={
            <StorePill name={selected.name} onPress={() => setSheet('lists')} />
          }
          headerAfter={
            <ModuleHeaderButtons
              testID="groceries"
              moduleLabel={t.modules.byId.groceries.label}
              // The list on screen, not the last-used one in storage: a
              // recipe's add sheet can have written another list there.
              settingsHref={{
                pathname: moduleSettingsHref('groceries', 'all'),
                params: { listId: selected._id },
              }}
            />
          }
          menuExtras={[
            {
              // A recipe's ingredients are added from the recipe (APP-312), the
              // week's from the week menu (APP-321): the list asks which.
              id: 'groceries-from-recipe',
              title: t.tasks.grocery.addLines.fromRecipe,
              image: 'book',
              onPress: () => setSheet('source'),
            },
            {
              // What the house keeps (APP-314); also the action row's pill.
              id: 'groceries-in-stock',
              title: t.kitchen.inStock.title,
              image: 'house',
              onPress: () => router.push(moduleHref('/all/groceries/in-stock')),
            },
            ...(selected.provider === 'local'
              ? [
                  {
                    id: 'grocery-aisle-order',
                    title: t.tasks.grocery.aisleOrder.menu,
                    image: 'arrow.up.arrow.down' as const,
                    onPress: () => openAisles(selected._id),
                  },
                ]
              : []),
          ]}
        />
        {sheet === 'lists' ? (
          <GroceryListsSheet
            lists={groceryLists}
            selectedId={selected._id}
            onChoose={remember}
            onAisleOrder={() => {
              setSheet(null)
              openAisles(selected._id)
            }}
            onNewList={() => setSheet('new')}
            onClose={() => setSheet((open) => (open === 'lists' ? null : open))}
          />
        ) : null}
        {sheet === 'source' ? (
          <GroceriesSourceSheet
            listId={selected._id}
            onRecipes={() => router.push(moduleHref('/all/recipes'))}
            onClose={() => setSheet(null)}
          />
        ) : null}
        {newListSheet}
      </>
    )

  return (
    <>
      <KitchenShell
        title={t.modules.byId.groceries.label}
        wash={{
          moduleId: 'groceries',
          summary: {
            count: plural(locale, lists.length, t.tasks.count.lists),
            scope: group.name,
          },
        }}
      >
        <Text style={[TYPE.subhead, { color: tokens.muted }]}>
          {words.none}
        </Text>
        <InsetList>
          <InsetRow
            testID="groceries-new-list"
            title={words.newList}
            onPress={() => setSheet('new')}
          />
        </InsetList>
        {lists.length > 0 ? (
          <InsetList>
            {lists.map((list) => (
              <InsetRow
                key={list._id}
                title={list.name}
                onPress={() =>
                  // The list becomes a grocery list (kind `groceries`).
                  set({ groupSlug: group.slug, listId: list._id }).then(() => {
                    haptics.selectionChanged()
                    remember(list._id)
                  })
                }
              />
            ))}
          </InsetList>
        ) : null}
      </KitchenShell>
      {newListSheet}
    </>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  washContent: { paddingHorizontal: SPACE[4], gap: SPACE[3] },
})
