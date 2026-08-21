/**
 * The Settings tab: a grouped list, with a field above it.
 *
 * The list is the platform's own shape, and it is the one that survives being
 * added to — a new setting is a new row, and the person reading it already
 * knows how the screen works. What a growing list loses is the person who knows
 * the word and not the group, which is what the field is for. It is the escape
 * hatch rather than the front door: a query replaces the whole list, identity
 * card included, with flat results that each name the group they came from.
 *
 * There is no profile destination any more. The profile is the card at the top,
 * and it goes to Account like every other row goes somewhere.
 *
 * The rows are drawn from `settings/sections.ts` rather than written here, so
 * the field searches exactly what the screen shows.
 */
import { useUser } from '@clerk/expo'
import { router } from 'expo-router'
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

import { useGroup } from '../../../../src/group/GroupProvider'
import { fmt, useI18n } from '../../../../src/i18n'
import {
  type SettingsEntry,
  type SettingsSectionId,
  searchSettings,
  settingsSections,
} from '../../../../src/settings/sections'
import { useAppearance } from '../../../../src/theme/appearance'
import type { Glyph } from '../../../../src/theme/glyph'
import { UI_ICONS } from '../../../../src/theme/icons'
import { RADIUS, useTokens } from '../../../../src/theme/tokens'

/** Decorative, and only ever next to the group's own title. */
const SECTION_ICONS = {
  account: UI_ICONS.User,
  phone: UI_ICONS.Smartphone,
  modules: UI_ICONS.Grid,
} satisfies Record<SettingsSectionId, Glyph>

export default function Settings() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const { preference } = useAppearance()
  const [query, setQuery] = useState('')

  const { group } = useGroup()
  const sections = settingsSections(t, {
    appearance: preference,
    locale,
    groupName: group.name,
  })
  const searching = query.trim().length > 0
  const hits = searchSettings(sections, query)
  const Search = UI_ICONS.Search

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 44,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.screenTitle, { color: tokens.fg }]}
      >
        {t.settings.title}
      </Text>

      <View
        style={[
          styles.search,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        <Search
          size={18}
          color={tokens.muted}
          strokeWidth={2}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.settings.search.placeholder}
          placeholderTextColor={tokens.muted}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          accessibilityLabel={t.settings.search.placeholder}
          style={[styles.searchInput, { color: tokens.fg }]}
        />
      </View>

      {searching ? (
        hits.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {fmt(t.settings.search.empty, { query: query.trim() })}
          </Text>
        ) : (
          <View
            style={[
              styles.card,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
            ]}
          >
            {hits.map(({ section, entry }, index) => (
              <Row
                key={entry.id}
                entry={entry}
                first={index === 0}
                within={section.title}
              />
            ))}
          </View>
        )
      ) : (
        <>
          <Identity />
          {sections.map((section) => {
            const Glyph = SECTION_ICONS[section.id]
            return (
              <View key={section.id} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Glyph
                    size={15}
                    color={tokens.muted}
                    strokeWidth={2}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text style={[styles.groupTitle, { color: tokens.muted }]}>
                    {section.title.toUpperCase()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: tokens.surface,
                      borderColor: tokens.border,
                    },
                  ]}
                >
                  {section.entries.map((entry, index) => (
                    <Row key={entry.id} entry={entry} first={index === 0} />
                  ))}
                </View>
              </View>
            )
          })}

          {/*
           * The sheet lab is not a setting, which is why it is not in
           * `sections.ts`: it compares the five ways the Add launcher could be
           * presented, and it goes away with the decision it exists to settle.
           * Keeping it out of that file keeps it out of the search field too,
           * where a row nobody outside a dev build can reach would be noise.
           */}
          {__DEV__ ? (
            <View style={styles.group}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: tokens.surface,
                    borderColor: tokens.border,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open the sheet lab"
                  onPress={() => router.push('/lab/sheets')}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.rowText}>
                    <Text
                      numberOfLines={1}
                      style={[styles.rowLabel, { color: tokens.fg }]}
                    >
                      Open the sheet lab
                    </Text>
                  </View>
                  <UI_ICONS.ChevronRight
                    size={18}
                    color={tokens.muted}
                    strokeWidth={1.8}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  )
}

/**
 * Who you are, at the top of the list rather than behind a tab of its own.
 *
 * It names the person and not the Group: Home names the current Group and is
 * the way out of it, in one control, and a second Group line here would be a
 * second place to look for a switch that is not here (ADR-0015).
 */
function Identity() {
  const tokens = useTokens()
  const { user } = useUser()
  const { t } = useI18n()
  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  const name = user?.fullName?.trim() ?? email
  const initials = name.slice(0, 1).toUpperCase()
  const ChevronRight = UI_ICONS.ChevronRight

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fmt(t.settings.identity, { name })}
      onPress={() => router.push('/settings/account')}
      style={({ pressed }) => [
        styles.identity,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: tokens.tile }]}>
        <Text style={[styles.initials, { color: tokens.fg }]}>{initials}</Text>
      </View>
      <View style={styles.identityText}>
        <Text
          numberOfLines={1}
          selectable
          style={[styles.name, { color: tokens.fg }]}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          selectable
          style={[styles.email, { color: tokens.muted }]}
        >
          {email}
        </Text>
      </View>
      <ChevronRight
        size={20}
        color={tokens.muted}
        strokeWidth={1.8}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  )
}

/**
 * Label, current value, chevron — and no second line, because the grouped list
 * trusts the label and a hint under every row is what turns a list into a
 * document. `within` is the one exception: in a result the group is the only
 * thing that says which setting this is.
 */
function Row({
  entry,
  first,
  within,
}: {
  entry: SettingsEntry
  first: boolean
  within?: string
}) {
  const tokens = useTokens()
  const ChevronRight = UI_ICONS.ChevronRight

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[entry.label, within, entry.value]
        .filter(Boolean)
        .join(', ')}
      onPress={() => router.push(entry.href)}
      style={({ pressed }) => [
        styles.row,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: tokens.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowLabel, { color: tokens.fg }]}>
          {entry.label}
        </Text>
        {within ? (
          <Text
            numberOfLines={1}
            style={[styles.rowWithin, { color: tokens.muted }]}
          >
            {within}
          </Text>
        ) : null}
      </View>
      {entry.value ? (
        <Text
          numberOfLines={1}
          style={[styles.rowValue, { color: tokens.muted }]}
        >
          {entry.value}
        </Text>
      ) : null}
      <ChevronRight
        size={18}
        color={tokens.muted}
        strokeWidth={1.8}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  screenTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 9 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 19, fontWeight: '700' },
  identityText: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  email: { fontSize: 13 },
  group: { marginTop: 22 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: 7,
  },
  groupTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingVertical: 4,
  },
  rowText: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 16 },
  rowWithin: { fontSize: 12 },
  rowValue: { fontSize: 15, maxWidth: 150 },
  empty: { fontSize: 15, paddingVertical: 24, textAlign: 'center' },
  pressed: { opacity: 0.6 },
})
