
import { useMutation } from 'convex/react'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { NativeContextMenu } from '../../components/NativeContextMenu'
import { SwipeableRow } from '../../components/SwipeableRow'
import { api, type Id } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../i18n'
import {
  lastGroceryListKey,
  readPreference,
  writePreference,
} from '../../prefs/localPreference'
import { RADIUS, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { WashHeader, type WashSummary } from '../../ui/wash-header'
import { moduleHref } from '../moduleDestination'
import { GroceryListsSheet, StorePill } from '../tasks/GroceryListsSheet'
import { groceryListsOf, openGroceryList } from '../tasks/groceryList'
import { NewListSheet } from '../tasks/NewListSheet'
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

function Composer({
  labels,
  onSave,
  initial,
}: {
  labels: { name: string; extra?: string; add: string }
  onSave: (name: string, extra?: string) => Promise<unknown>
  initial?: { name: string; extra?: string }
}) {
  const tokens = useTokens('kitchen')
  const [name, setName] = useState(initial?.name ?? '')
  const [extra, setExtra] = useState(initial?.extra ?? '')
  return (
    <View
      style={[
        styles.composer,
        { borderColor: tokens.hair, backgroundColor: tokens.surface },
      ]}
    >
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={labels.name}
        placeholderTextColor={tokens.muted}
        style={[
          styles.input,
          { color: tokens.ink, borderBottomColor: tokens.hair },
        ]}
      />
      {labels.extra ? (
        <TextInput
          value={extra}
          onChangeText={setExtra}
          placeholder={labels.extra}
          placeholderTextColor={tokens.muted}
          keyboardType="numeric"
          style={[
            styles.input,
            { color: tokens.ink, borderBottomColor: tokens.hair },
          ]}
        />
      ) : null}
      <Pressable
        disabled={!name.trim()}
        onPress={() =>
          onSave(name, extra)
            .then(() => {
              setName('')
              setExtra('')
              haptics.itemSaved()
            })
            .catch(() => haptics.actionFailed())
        }
        style={[styles.add, { backgroundColor: tokens.accent }]}
      >
        <Text style={{ ...TYPE.bodyStrong, color: tokens.onAccent }}>
          {labels.add}
        </Text>
      </Pressable>
    </View>
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
  const [sheet, setSheet] = useState<'lists' | 'new' | null>(null)
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
          menuExtras={[
            {
              // A recipe's ingredients are added from the recipe (APP-312):
              // the list leads there; the week menu joins with APP-321.
              id: 'groceries-from-recipe',
              title: t.tasks.grocery.addLines.fromRecipe,
              image: 'book',
              onPress: () => router.push(moduleHref('/all/recipes')),
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

export function PantryScreen() {
  const { group } = useGroup()
  const { t } = useI18n()
  const tokens = useTokens('kitchen')
  const pantry = useQuery(api.kitchen.pantry, { groupSlug: group.slug })
  const add = useMutation(api.kitchen.addPantryEntry)
  const update = useMutation(api.kitchen.updatePantryEntry)
  const remove = useMutation(api.kitchen.removePantryEntry)
  const confirmRemove = (item: { _id: Id<'pantryEntries'>; title: string }) =>
    confirmDestructive({
      title: fmt(t.kitchen.deleteTitle, { title: item.title }),
      message: t.kitchen.deleteBody,
      confirm: t.common.actions.delete,
      cancel: t.common.actions.cancel,
      onConfirm: () => remove({ groupSlug: group.slug, id: item._id }),
    })
  const [editing, setEditing] = useState<Id<'pantryEntries'> | null>(null)
  const entry = pantry?.find((item) => item._id === editing)
  return (
    <KitchenShell title={t.modules.byId.pantry.label}>
      <Composer
        labels={{
          name: t.kitchen.name,
          extra: t.kitchen.quantity,
          add: t.common.actions.add,
        }}
        onSave={(title, quantity) =>
          add({ groupSlug: group.slug, title, quantity })
        }
      />
      {pantry?.length === 0 ? (
        <Text style={{ color: tokens.muted }}>{t.kitchen.noPantry}</Text>
      ) : (
        pantry?.map((item) => (
          <NativeContextMenu
            key={item._id}
            actions={[
              { id: 'edit', title: t.common.actions.edit },
              {
                id: 'delete',
                title: t.common.actions.delete,
                attributes: { destructive: true },
              },
            ]}
            onAction={(action) =>
              action === 'edit' ? setEditing(item._id) : confirmRemove(item)
            }
          >
            <SwipeableRow
              deleteLabel={t.common.actions.delete}
              onDelete={() => confirmRemove(item)}
            >
              <Pressable
                onPress={() => setEditing(item._id)}
                style={[
                  styles.row,
                  {
                    borderColor: tokens.hair,
                    backgroundColor: tokens.surface,
                  },
                ]}
              >
                <Text style={[styles.title, { color: tokens.ink }]}>
                  {item.title}
                </Text>
                <Text style={{ color: tokens.muted }}>{item.quantity}</Text>
              </Pressable>
            </SwipeableRow>
          </NativeContextMenu>
        ))
      )}
      <Modal
        visible={editing !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        {entry ? (
          <PantryEditor
            entry={entry}
            onSave={(title, quantity) =>
              update({
                groupSlug: group.slug,
                id: entry._id,
                title,
                quantity,
              }).then(() => setEditing(null))
            }
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </KitchenShell>
  )
}

function PantryEditor({
  entry,
  onSave,
  onClose,
}: {
  entry: { title: string; quantity?: string }
  onSave: (title: string, quantity?: string) => Promise<unknown>
  onClose: () => void
}) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const [title, setTitle] = useState(entry.title)
  const [quantity, setQuantity] = useState(entry.quantity ?? '')
  return (
    <View style={styles.modal}>
      <View style={[styles.sheet, { backgroundColor: tokens.surface }]}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={[
            styles.input,
            { color: tokens.ink, borderBottomColor: tokens.hair },
          ]}
        />
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          style={[
            styles.input,
            { color: tokens.ink, borderBottomColor: tokens.hair },
          ]}
        />
        <Pressable onPress={() => onSave(title, quantity)}>
          <Text style={{ color: tokens.accentText }}>
            {t.common.actions.save}
          </Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text>{t.common.actions.cancel}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  washContent: { paddingHorizontal: SPACE[4], gap: SPACE[3] },
  composer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 10,
    gap: 8,
  },
  input: {
    ...TYPE.body,
    minHeight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  add: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
  },
  row: {
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: { ...TYPE.bodyStrong, flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navButton: { padding: 8 },
  weekTitle: { ...TYPE.bodyStrong, textAlign: 'center', flex: 1 },
  limitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  clear: { padding: 6 },
  dayMain: { flex: 1, gap: 2, paddingVertical: 10 },
  dayName: { ...TYPE.footnoteStrong },
  pickerList: { paddingBottom: 40 },
  pickerEmpty: { padding: 24, textAlign: 'center' },
  pickerRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  section: { ...TYPE.bodyStrong, marginTop: 8 },
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  sheet: {
    padding: 20,
    gap: 12,
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: {
    width: '14.2857%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.card,
  },
})
