/**
 * Groceries settings (APP-611): the standing choices of the grocery list the
 * Module opens on this phone — its aisle order and whether it suggests what
 * might be needed. Both are the list's own, shared with the Group; the store
 * pill on the Module still switches lists, and this page follows it.
 */
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { lastGroceryListKey, readPreference } from '../../prefs/localPreference'
import type { ModuleSettingsDoor } from '../../settings/module-pages'
import { useTokens } from '../../theme/tokens'
import { InsetRow } from '../../ui/inset-list'
import {
  SettingsGroup,
  SettingsNote,
  SettingsPage,
  SettingsSwitchRow,
} from '../../ui/settings-page'
import { groceryListsOf, openGroceryList } from '../tasks/groceryList'
import { useTaskActions, useTaskLists } from '../tasks/store'

export function GroceriesSettingsScreen({
  door,
  listId,
}: {
  door: ModuleSettingsDoor
  /**
   * The list the gear was pressed on. Absent from Settings › Modules, which
   * opens the list the Module would open.
   */
  listId?: string
}) {
  const { t } = useI18n()
  const tokens = useTokens('kitchen')
  const router = useRouter()
  const { group } = useGroup()
  const lists = useTaskLists()
  const actions = useTaskActions()
  // What the switch shows while its write is in flight, so a controlled
  // Switch does not flick back before the server agrees.
  const [intended, setIntended] = useState<boolean | null>(null)

  const title = fmt(t.settings.modulePage.title, {
    module: t.modules.byId.groceries.label,
  })

  if (lists === undefined)
    return <View style={{ flex: 1, backgroundColor: tokens.ground }} />

  const groceryLists = groceryListsOf(lists)
  const list =
    groceryLists.find((each) => each._id === listId) ??
    openGroceryList(groceryLists, readPreference(lastGroceryListKey(group.slug)))

  if (!list)
    return (
      <SettingsPage title={title} testID="groceries-settings">
        <SettingsNote>{t.tasks.grocery.lists.none}</SettingsNote>
      </SettingsPage>
    )

  const suggesting = intended ?? !list.suggestionsOff
  const local = list.provider === 'local'

  return (
    <SettingsPage title={title} testID="groceries-settings">
      <SettingsGroup
        title={list.name}
        footer={fmt(t.settings.modulePage.sharedList, {
          list: list.name,
          group: group.name,
        })}
      >
        {local ? (
          <InsetRow
            testID="groceries-settings-aisles"
            title={t.tasks.grocery.aisleOrder.title}
            chevron
            onPress={() =>
              router.push({
                pathname:
                  door === 'all'
                    ? '/all/groceries/aisles'
                    : '/settings/groceries/aisles',
                params: { listId: list._id },
              })
            }
          />
        ) : null}
        <SettingsSwitchRow
          testID="groceries-settings-suggestions"
          title={t.tasks.grocery.suggestions.title}
          value={suggesting}
          // One write at a time: a second toggle before the first settles
          // would have its pending value cleared by the first one's answer.
          disabled={!list.writable || intended !== null}
          onValueChange={(on) => {
            setIntended(on)
            actions
              .setSuggestions(list._id, on)
              .then(() => haptics.selectionChanged())
              .catch(() => haptics.actionFailed())
              .finally(() => setIntended(null))
          }}
        />
      </SettingsGroup>
    </SettingsPage>
  )
}
