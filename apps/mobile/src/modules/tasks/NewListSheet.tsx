/**
 * New list (APP-306): a name, a kind, a colour and an icon, then Maak.
 *
 * Drawn from the approved study (`designs/tasks`, screen `newList`): a form
 * sheet with Cancel and Create in its bar, the list's own tile previewing the
 * colour and icon beside the name, the five kinds as radio rows with what the
 * chosen one starts with underneath, and the colour and icon pickers last.
 *
 * Create is never disabled: every kind has a default name, which is the
 * name field's placeholder and what an empty field means. The name does not
 * take focus on open: the keyboard would cover the kinds, which is the choice
 * the sheet is opened to make, and the default name is usually fine. The kind's starter
 * items are resolved in the reader's language here, because the backend holds
 * no display strings; the list is then the Group's in that language.
 */
import {
  iconChoices,
  TASK_LIST_KINDS,
  TASK_LIST_TEMPLATES,
  type TaskListColor,
  type TaskListIcon,
  type TaskListKind,
} from '@gather/core/task-lists'
import { randomUUID } from 'expo-crypto'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { NativeSheet } from '../../components/NativeSheet'
import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, useInsetSeparator } from '../../ui/inset-list'
import { ModuleTile } from '../../ui/module-tile'
import { SectionLabel } from '../../ui/section-label'
import { TASK_LIST_GLYPHS } from './icons'
import { ColorSwatches, IconChoices } from './listFace'
import { useTaskActions } from './store'

/** The longest name the sheet takes: more never fits a row. */
const NAME_MAX = 100

export function NewListSheet({
  onClose,
  onCreated,
  initialKind = 'plain',
}: {
  onClose: () => void
  /** The kind already chosen: Groceries from the Grocery lists sheet (APP-313). */
  initialKind?: TaskListKind
  /** Called with the new list once it exists; the sheet is closed by then. */
  onCreated: (list: { id: string; kind: TaskListKind }) => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const actions = useTaskActions()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<TaskListKind>(initialKind)
  // `null` follows the kind: its colour until somebody picks one, its icon
  // until somebody picks one after choosing it.
  const [color, setColor] = useState<TaskListColor | null>(null)
  const [icon, setIcon] = useState<TaskListIcon | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  // One key per sheet: a retry after a dropped connection is the same list.
  const [idempotencyKey] = useState(() => randomUUID())

  const template = TASK_LIST_TEMPLATES[kind]
  const kindCopy = t.tasks.kinds[kind]
  const face = { icon: icon ?? template.icon, color: color ?? template.color }

  const chooseKind = (next: TaskListKind) => {
    if (next !== kind) haptics.selectionChanged()
    setKind(next)
    setIcon(null)
  }

  const create = async () => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      const listId = await actions.createList({
        name: name.trim().slice(0, NAME_MAX) || kindCopy.defaultName,
        kind,
        icon: face.icon,
        color: face.color,
        // Packing and chores starters arrive in their sections (APP-357).
        starterSections: template.sections.map(({ section, items }) => ({
          name: t.tasks.starterSections[section],
          tasks: items.map((key) => t.tasks.starters[key]),
        })),
        idempotencyKey,
      })
      haptics.itemSaved()
      onClose()
      onCreated({ id: listId, kind })
    } catch {
      haptics.actionFailed()
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <NativeSheet
      title={t.tasks.newList.title}
      onClose={onClose}
      background="ground"
      maxHeight={0.94}
      fill
      confirm={{
        label: t.tasks.newList.create,
        onPress: create,
        busy,
        group: 'home',
        testID: 'new-list-create',
      }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.body}
      >
        <View style={[styles.nameCard, { backgroundColor: tokens.surface }]}>
          <ModuleTile
            group={face.color}
            glyph={TASK_LIST_GLYPHS[face.icon]}
            size="l"
          />
          <TextInput
            testID="new-list-name"
            value={name}
            onChangeText={setName}
            maxLength={NAME_MAX}
            placeholder={kindCopy.defaultName}
            placeholderTextColor={tokens.muted}
            accessibilityLabel={t.tasks.newList.nameLabel}
            returnKeyType="done"
            onSubmitEditing={create}
            style={[styles.name, { color: tokens.ink }]}
          />
        </View>

        <View style={styles.group}>
          <SectionLabel>{t.tasks.newList.kind}</SectionLabel>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t.tasks.newList.kind}
          >
            <InsetList>
              {TASK_LIST_KINDS.map((option) => (
                <KindRow
                  key={option}
                  kind={option}
                  selected={option === kind}
                  onPress={() => chooseKind(option)}
                />
              ))}
            </InsetList>
          </View>
          <Text style={[styles.footnote, { color: tokens.muted }]}>
            {kindCopy.startsWith}
          </Text>
        </View>

        <View style={[styles.faceCard, { backgroundColor: tokens.surface }]}>
          <View style={styles.faceRow}>
            <Text style={[styles.faceLabel, { color: tokens.ink }]}>
              {t.tasks.newList.color}
            </Text>
            <ColorSwatches value={face.color} onChange={setColor} />
          </View>
          <View
            style={[
              styles.faceRow,
              styles.faceRowRule,
              { borderTopColor: tokens.hair },
            ]}
          >
            <Text style={[styles.faceLabel, { color: tokens.ink }]}>
              {t.tasks.newList.icon}
            </Text>
            <IconChoices
              icons={iconChoices(kind)}
              value={face.icon}
              onChange={setIcon}
              firstLabel={t.tasks.newList.kindIcon}
            />
          </View>
        </View>

        {failed ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.footnote, { color: tokens.danger }]}
          >
            {t.tasks.newList.failed}
          </Text>
        ) : null}
      </ScrollView>
    </NativeSheet>
  )
}

function KindRow({
  kind,
  selected,
  onPress,
}: {
  kind: TaskListKind
  selected: boolean
  onPress: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const separator = useInsetSeparator()
  const copy = t.tasks.kinds[kind]
  const Glyph = TASK_LIST_GLYPHS[TASK_LIST_TEMPLATES[kind].icon]
  const Check = UI_ICONS.Check
  return (
    <Pressable
      testID={`new-list-kind-${kind}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${copy.title}, ${copy.description}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.kindRow,
        pressed && { backgroundColor: tokens.surface2 },
      ]}
    >
      <View style={[styles.kindTile, { backgroundColor: tokens.surface2 }]}>
        <Glyph size={16} color={tokens.ink} strokeWidth={2} />
      </View>
      <View style={[styles.kindText, separator]}>
        <View style={styles.kindWords}>
          <Text style={[styles.kindTitle, { color: tokens.ink }]}>
            {copy.title}
          </Text>
          <Text style={[styles.footnote, { color: tokens.muted }]}>
            {copy.description}
          </Text>
        </View>
        {selected ? (
          <Check size={20} color={tokens.accentText} strokeWidth={2.4} />
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { gap: SPACE[4], paddingBottom: SPACE[6] },
  nameCard: {
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    paddingVertical: 12,
    paddingHorizontal: SPACE[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  name: { ...TYPE.title2, flex: 1, minHeight: 44 },
  group: { gap: SPACE[2] },
  footnote: { ...TYPE.footnote },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kindTile: {
    width: SIZE.tileS,
    height: SIZE.tileS,
    borderRadius: RADIUS.tileS,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindText: {
    flex: 1,
    minHeight: 56,
    paddingVertical: 6,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
  },
  kindWords: { flex: 1 },
  kindTitle: { ...TYPE.body },
  faceCard: {
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    paddingVertical: 4,
    paddingHorizontal: SPACE[4],
  },
  faceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  faceRowRule: { borderTopWidth: StyleSheet.hairlineWidth },
  faceLabel: { ...TYPE.body, flex: 1 },
})
