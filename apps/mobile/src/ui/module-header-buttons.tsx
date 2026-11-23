/**
 * The buttons at the right of a Module root's native bar (APP-611, APP-613):
 * the root's own buttons, then search, then the gear that opens the Module's
 * settings page.
 *
 * The one place that order lives. A Module root passes it as its
 * `headerRight`, naming what it has: a Module search can be narrowed to gets
 * the glass, a Module with settings gets the gear, and one with neither and
 * no buttons of its own draws nothing. Calendar draws its own toolbar and
 * uses `useModuleSearch` instead.
 */
import type { Href } from 'expo-router'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { fmt, useI18n } from '../i18n'
import { ModuleSearchButton } from '../search/ModuleSearchButton'
import type { SearchModuleId } from '../search/searchFilters'
import { UI_ICONS } from '../theme/icons'
import { useTokens } from '../theme/tokens'
import { HeaderIconButton } from './header-icon-button'

export function ModuleHeaderButtons({
  moduleLabel,
  search,
  settingsHref,
  testID,
  before,
}: {
  /** The Module's name, as its title shows it; it goes in the gear's label. */
  moduleLabel: string
  /** The Module search is narrowed to. Absent: no glass. */
  search?: SearchModuleId
  /** The Module's settings page. Absent: no gear. */
  settingsHref?: Href
  /** Prefix for the gear's test id, usually the Module id. */
  testID: string
  /** The root's own buttons, drawn first. */
  before?: ReactNode
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const router = useRouter()

  if (!before && !search && !settingsHref) return null

  return (
    <View style={styles.row}>
      {before}
      {search ? <ModuleSearchButton module={search} /> : null}
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
