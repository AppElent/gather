
import { useMutation } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { plural, useI18n } from '../../i18n'
import { SPACE, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { WashHeader, type WashSummary } from '../../ui/wash-header'
import { moduleHref } from '../moduleDestination'
import { useTaskLists } from '../tasks/store'
import { TaskList } from '../tasks/TaskListScreen'

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

export function GroceriesScreen() {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const tokens = useTokens('kitchen')
  const data = useQuery(api.kitchen.groceries, { groupSlug: group.slug })
  const set = useMutation(api.kitchen.setGroceryList)
  const lists = useTaskLists()
  const router = useRouter()
  const selected = data?.groceryListId
  if (selected)
    return (
      <TaskList
        listId={selected}
        moduleId="groceries"
        addPlaceholder={t.kitchen.addGroceryItem}
        menuExtras={[
          {
            // A recipe's ingredients are added from the recipe (APP-312): the
            // list leads there; the week menu joins with APP-321.
            id: 'groceries-from-recipe',
            title: t.tasks.grocery.addLines.fromRecipe,
            image: 'book',
            onPress: () => router.push(moduleHref('/all/recipes')),
          },
          {
            // What the house keeps (APP-314). The design's action-row pill
            // arrives with the aisle list (APP-310); until then, the menu.
            id: 'groceries-in-stock',
            title: t.kitchen.inStock.title,
            image: 'house',
            onPress: () => router.push(moduleHref('/all/groceries/in-stock')),
          },
          {
            // Unlinking is not destructive — the list stays in Tasks — and it
            // lands on the picker below, so it needs no confirmation.
            id: 'change-grocery-list',
            title: t.kitchen.changeList,
            image: 'arrow.left.arrow.right',
            onPress: () => set({ groupSlug: group.slug, listId: null }),
          },
        ]}
      />
    )
  return (
    <KitchenShell
      title={t.modules.byId.groceries.label}
      wash={{
        moduleId: 'groceries',
        summary: {
          count: plural(locale, lists?.length ?? 0, t.tasks.count.lists),
          scope: group.name,
        },
      }}
    >
      <Text style={[TYPE.subhead, { color: tokens.muted }]}>
        {t.kitchen.noGroceryList}
      </Text>
      {lists && lists.length > 0 ? (
        <InsetList>
          {lists.map((list) => (
            <InsetRow
              key={list._id}
              title={list.name}
              onPress={() =>
                set({ groupSlug: group.slug, listId: list._id }).then(() =>
                  haptics.selectionChanged(),
                )
              }
            />
          ))}
        </InsetList>
      ) : null}
    </KitchenShell>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  washContent: { paddingHorizontal: SPACE[4], gap: SPACE[3] },
})
