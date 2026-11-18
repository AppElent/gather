
import { useMutation } from 'convex/react'
import { Stack } from 'expo-router'
import { useState } from 'react'
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
import { RADIUS, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { WashHeader, type WashSummary } from '../../ui/wash-header'
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

export function GroceriesScreen() {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const tokens = useTokens('kitchen')
  const data = useQuery(api.kitchen.groceries, { groupSlug: group.slug })
  const set = useMutation(api.kitchen.setGroceryList)
  const lists = useTaskLists()
  const selected = data?.groceryListId
  if (selected)
    return (
      <TaskList
        listId={selected}
        moduleId="groceries"
        addPlaceholder={t.kitchen.addGroceryItem}
        menuExtras={[
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
