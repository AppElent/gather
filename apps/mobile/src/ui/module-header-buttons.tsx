/**
 * The buttons at the right of a Module root's native bar: search, then the
 * gear that opens the Module's settings page (APP-611, APP-613).
 *
 * One component so the order is decided once. A Module root passes it as its
 * `headerRight`; a Module with nothing to set passes no `settingsHref` and
 * gets no gear, and one whose root has buttons of its own puts them first.
 */
import type { Href } from 'expo-router'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { fmt, useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { useTokens } from '../theme/tokens'
import { HeaderIconButton } from './header-icon-button'

export function ModuleHeaderButtons({
  moduleLabel,
  settingsHref,
  testID,
  before,
}: {
  /** The Module's name, as its title shows it; it goes in the labels. */
  moduleLabel: string
  /** The Module's settings page. Absent: no gear. */
  settingsHref?: Href
  /** Prefix for the buttons' test ids, usually the Module id. */
  testID: string
  /** The root's own buttons, drawn before search and the gear. */
  before?: ReactNode
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const router = useRouter()

  if (!before && !settingsHref) return null

  return (
    <View style={styles.row}>
      {before}
      {settingsHref ? (
        <HeaderIconButton
          testID={`${testID}-settings`}
          label={fmt(t.settings.modulePage.open, { module: moduleLabel })}
          onPress={() => router.push(settingsHref)}
        >
          <UI_ICONS.Settings size={22} color={tokens.ink} strokeWidth={2} />
        </HeaderIconButton>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
