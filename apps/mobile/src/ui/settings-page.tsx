/**
 * The frame of a Module's settings page (APP-611): the native large title,
 * then grouped inset lists, each with a label above and an optional footnote
 * below, the shape of the Settings tab itself.
 *
 * The scroll view is the screen's first subview so the large title collapses
 * (mobile design system, Titles).
 */
import { Stack } from 'expo-router'
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SPACE, TYPE, useTokens } from '../theme/tokens'
import { InsetList, InsetRow } from './inset-list'
import { washScreenOptions } from './screen-header'
import { SectionLabel } from './section-label'

export function SettingsPage({
  title,
  testID,
  children,
}: {
  title: string
  testID?: string
  children: ReactNode
}) {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      testID={testID}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: tokens.ground }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + SPACE[6] },
      ]}
    >
      <Stack.Screen options={washScreenOptions(title)} />
      {children}
    </ScrollView>
  )
}

/** One grouped list: its label, its rows, and what to know about them. */
export function SettingsGroup({
  title,
  footer,
  children,
}: {
  title?: string
  footer?: string
  children: ReactNode
}) {
  const tokens = useTokens()
  return (
    <View style={styles.group}>
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <InsetList>{children}</InsetList>
      {footer ? (
        <Text style={[styles.footer, { color: tokens.muted }]}>{footer}</Text>
      ) : null}
    </View>
  )
}

/** A row that is an on/off choice. The whole row is the switch's label. */
export function SettingsSwitchRow({
  title,
  value,
  onValueChange,
  disabled = false,
  testID,
}: {
  title: string
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
  testID?: string
}) {
  const tokens = useTokens()
  return (
    <InsetRow
      title={title}
      accessibilityRole="none"
      trailing={
        <Switch
          testID={testID}
          value={value}
          disabled={disabled}
          accessibilityLabel={title}
          onValueChange={onValueChange}
          trackColor={{ false: tokens.surface2 }}
        />
      }
    />
  )
}

/** Something said under the page's last group, not tied to one of them. */
export function SettingsNote({ children }: { children: string }) {
  const tokens = useTokens()
  return (
    <Text style={[styles.footer, { color: tokens.muted }]}>{children}</Text>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], paddingTop: SPACE[3], gap: SPACE[5] },
  group: { gap: SPACE[2] },
  footer: { ...TYPE.footnote, paddingHorizontal: 4 },
})
