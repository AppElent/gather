/**
 * The grocery list's "From recipe or week menu" (APP-421): a small sheet that
 * asks where the lines come from. Recipes leads to the Recipes list, where a
 * recipe opens APP-312's sheet; the week menu opens APP-321's sheet for the
 * current week, right here.
 */
import { addDays, mondayStart, todayIn } from '@gather/core/civil-date'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { NativeSheet } from '../../../components/NativeSheet'
import { api } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'
import { useGroup } from '../../../group/GroupProvider'
import { useI18n } from '../../../i18n'
import { SPACE } from '../../../theme/tokens'
import { InsetList, InsetRow } from '../../../ui/inset-list'
import { ModuleTile, moduleTile } from '../../../ui/module-tile'
import { WeekGroceriesSheet } from '../meal-planner/week-groceries-sheet'

export function GroceriesSourceSheet({
  listId,
  onRecipes,
  onClose,
}: {
  /** The grocery list it was opened from: the sheets open on it. */
  listId: string
  onRecipes: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const { group } = useGroup()
  const [weekStart] = useState(() =>
    mondayStart(todayIn(group.timeZone)),
  )
  const [week, setWeek] = useState(false)
  const data = useQuery(
    api.mealPlan.week,
    week
      ? {
          groupSlug: group.slug,
          from: weekStart,
          to: addDays(weekStart, 6),
        }
      : 'skip',
  )

  if (week) {
    // The week is loading: nothing to show for a moment.
    if (!data) return null
    return (
      <WeekGroceriesSheet
        data={data}
        weekStart={weekStart}
        listId={listId}
        onClose={onClose}
      />
    )
  }

  const recipes = moduleTile('recipes')
  const planner = moduleTile('meal-planner')
  return (
    <NativeSheet
      title={t.tasks.grocery.addLines.fromRecipe}
      onClose={onClose}
      background="ground"
    >
      <View style={styles.body}>
        <InsetList>
          <InsetRow
            testID="groceries-source-recipes"
            title={t.modules.byId.recipes.label}
            leading={
              recipes ? (
                <ModuleTile group={recipes.group} glyph={recipes.glyph} size="s" />
              ) : undefined
            }
            chevron
            onPress={() => {
              onClose()
              onRecipes()
            }}
          />
          <InsetRow
            testID="groceries-source-week"
            title={t.tasks.grocery.addLines.weekMenu}
            leading={
              planner ? (
                <ModuleTile group={planner.group} glyph={planner.glyph} size="s" />
              ) : undefined
            }
            chevron
            onPress={() => setWeek(true)}
          />
        </InsetList>
      </View>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  body: { paddingBottom: SPACE[4] },
})
