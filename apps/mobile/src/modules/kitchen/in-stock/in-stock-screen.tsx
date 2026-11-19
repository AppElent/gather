/**
 * Groceries' In stock (APP-314, `designs/groceries/README.md` section 7): the
 * staples the household keeps, by aisle, each in stock or running low. Running
 * low puts it on the grocery list; checking it off there puts it back in stock
 * (the server does both, so every client agrees). It replaced the Pantry.
 */
import type { GroceryAisle } from '@gather/core/groceries'
import { useMutation } from 'convex/react'
import { Stack } from 'expo-router'
import { useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { confirmDestructive } from '../../../feedback/confirmDestructive'
import { haptics } from '../../../feedback/haptics'
import { useGroup } from '../../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import { RADIUS, SPACE, TYPE, useTokens } from '../../../theme/tokens'
import { InsetAddRow, InsetList, InsetRow } from '../../../ui/inset-list'
import { washScreenOptions } from '../../../ui/screen-header'
import { SectionLabel } from '../../../ui/section-label'
import { WashHeader } from '../../../ui/wash-header'

interface Staple {
  _id: Id<'groceryStaples'>
  name: string
  aisle: GroceryAisle
  low: boolean
  note?: string
  onList: boolean
}

export function InStockScreen() {
  const { group } = useGroup()
  const { t, locale } = useI18n()
  const words = t.kitchen.inStock
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  const data = useQuery(api.groceryStaples.list, { groupSlug: group.slug })
  const setLow = useMutation(api.groceryStaples.setLow)
  const add = useMutation(api.groceryStaples.add)
  const remove = useMutation(api.groceryStaples.remove)

  const staples = data?.staples ?? []
  const lowCount = staples.filter((staple) => staple.low).length
  const sections: { aisle: GroceryAisle; rows: Staple[] }[] = []
  for (const staple of staples) {
    const last = sections.at(-1)
    if (last?.aisle === staple.aisle) last.rows.push(staple)
    else sections.push({ aisle: staple.aisle, rows: [staple] })
  }

  const toggle = (staple: Staple) =>
    setLow({ groupSlug: group.slug, id: staple._id, low: !staple.low })
      .then(() => haptics.selectionChanged())
      .catch(() => haptics.actionFailed())

  const confirmRemove = (staple: Staple) =>
    confirmDestructive({
      title: fmt(t.kitchen.deleteTitle, { title: staple.name }),
      message: t.kitchen.deleteBody,
      confirm: t.common.actions.delete,
      cancel: t.common.actions.cancel,
      onConfirm: () => remove({ groupSlug: group.slug, id: staple._id }),
    })

  const meta = (staple: Staple): string | undefined => {
    if (!staple.low) return staple.note
    if (staple.onList && data?.list)
      return fmt(words.onList, { list: data.list.name })
    return data?.list ? undefined : words.noList
  }

  return (
    <>
      <Stack.Screen options={washScreenOptions(words.title)} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACE[6] }}
      >
        <WashHeader
          group="kitchen"
          glyph={UI_ICONS.House}
          // Blank while loading, rather than a false "0 staples".
          summary={
            data
              ? {
                  count: plural(locale, lowCount, words.running),
                  scope: plural(locale, staples.length, words.staples),
                }
              : { count: '' }
          }
        />
        <View style={styles.content}>
          <Text style={[TYPE.subhead, styles.sub, { color: tokens.muted }]}>
            {words.sub}
          </Text>
          {sections.map(({ aisle, rows }) => (
            <View key={aisle} style={styles.section}>
              <SectionLabel>{t.tasks.grocery.aisles[aisle]}</SectionLabel>
              <InsetList>
                {rows.map((staple) => (
                  <InsetRow
                    key={staple._id}
                    testID={`staple-${staple.name}`}
                    title={staple.name}
                    subtitle={meta(staple)}
                    trailing={
                      <StockPill
                        low={staple.low}
                        label={fmt(staple.low ? words.toInStock : words.toLow, {
                          name: staple.name,
                        })}
                        onPress={() => toggle(staple)}
                      />
                    }
                    deleteLabel={t.common.actions.delete}
                    onDelete={() => confirmRemove(staple)}
                    menu={{
                      actions: [
                        {
                          id: 'delete',
                          title: t.common.actions.delete,
                          attributes: { destructive: true },
                        },
                      ],
                      onAction: () => confirmRemove(staple),
                    }}
                  />
                ))}
              </InsetList>
            </View>
          ))}
          <InsetList>
            <AddStaple
              label={words.add}
              onAdd={(name) => add({ groupSlug: group.slug, name })}
            />
          </InsetList>
          <Text style={[styles.footnote, { color: tokens.muted }]}>
            {words.footnote}
          </Text>
        </View>
      </ScrollView>
    </>
  )
}

/**
 * The trailing toggle: `In stock` on `surface-2` in ink, or `Running low` on
 * the Kitchen fill. One tap flips it.
 */
function StockPill({
  low,
  label,
  onPress,
}: {
  low: boolean
  label: string
  onPress: () => void
}) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const words = t.kitchen.inStock
  const fg = low ? tokens.onAccent : tokens.ink
  const Glyph = low ? UI_ICONS.TriangleAlert : UI_ICONS.Check
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6 }}
      onPress={onPress}
      style={styles.pillHit}
    >
      <View
        style={[
          styles.pill,
          { backgroundColor: low ? tokens.accent : tokens.surface2 },
        ]}
      >
        <Glyph
          size={14}
          color={fg}
          strokeWidth={2.6}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={[styles.pillText, { color: fg }]}>
          {low ? words.low : words.inStock}
        </Text>
      </View>
    </Pressable>
  )
}

/** The last row: `Add a staple`, which becomes a field when tapped. */
function AddStaple({
  label,
  onAdd,
}: {
  label: string
  onAdd: (name: string) => Promise<unknown>
}) {
  const tokens = useTokens('kitchen')
  const [typing, setTyping] = useState(false)
  const [name, setName] = useState('')
  if (!typing)
    return (
      <InsetAddRow
        group="kitchen"
        label={label}
        testID="add-staple"
        onPress={() => setTyping(true)}
      />
    )
  const submit = () => {
    const typed = name.trim()
    if (!typed) return setTyping(false)
    onAdd(typed)
      .then(() => {
        setName('')
        haptics.itemSaved()
      })
      .catch(() => haptics.actionFailed())
  }
  return (
    <InsetRow
      leading={
        <UI_ICONS.Plus
          size={20}
          color={tokens.accentText}
          strokeWidth={2.2}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      }
    >
      <TextInput
        testID="add-staple-field"
        autoFocus
        value={name}
        onChangeText={setName}
        placeholder={label}
        placeholderTextColor={tokens.muted}
        accessibilityLabel={label}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={submit}
        onBlur={() => {
          if (!name.trim()) setTyping(false)
        }}
        style={[styles.field, { color: tokens.ink }]}
      />
    </InsetRow>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[5] },
  sub: { paddingHorizontal: 4, marginTop: -SPACE[3] },
  section: { gap: SPACE[2] },
  pillHit: { minHeight: 44, justifyContent: 'center' },
  pill: {
    minHeight: 32,
    paddingHorizontal: SPACE[3],
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: { ...TYPE.subhead, fontWeight: '600' },
  field: { ...TYPE.body, paddingVertical: SPACE[2] },
  footnote: { ...TYPE.footnote, paddingHorizontal: 4 },
})
