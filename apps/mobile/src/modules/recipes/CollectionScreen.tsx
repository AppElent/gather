/**
 * The Group's recipes — the Module's root, and the screen that has to survive
 * a household with eighty of them.
 *
 * Three decisions, and each one is a thing the web does differently:
 *
 * - **One presentation.** The web offers grid, banner and compact and remembers
 *   which; a phone is one column wide, so the choice does not exist and the
 *   toggle would be chrome that only ever says the same thing. Full-width rows
 *   carrying a thumbnail, the title, its stars and its tags.
 * - **Search is the header's magnifying glass**, not a field over the list:
 *   the one search screen with Recipes preset (APP-613), the same one the
 *   Search tab and every other Module open.
 * - **The Group is ambient.** No Group chrome anywhere on this screen; the
 *   Group is what the shell already says it is (ADR-0015), and the only place
 *   it is named is the screen a save happens on.
 *
 * ## Getting a recipe out of the list
 *
 * Swipe-left reveals a Delete that must be *tapped*, and the tap then asks.
 * A full swipe does nothing, because a full swipe is reserved for Archive and
 * gather has no Archive — deleting is permanent, with no `deletedAt` anywhere
 * in the schema, so it gets a confirmation rather than an undo. Press-and-hold
 * opens the system menu with the same two verbs, which is what the gesture
 * means on every other row in this app.
 *
 * Neither is offered on a recipe the caller may only read: `recipes.list`
 * answers `canEdit` per row, so a Group that was merely shared a recipe is
 * never handed a Delete that could only be refused.
 */
import { useMutation } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { api, type Id } from '../../convex/api'
import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, plural, useI18n } from '../../i18n'
import { RADIUS, TYPE, useTokens } from '../../theme/tokens'
import { InsetListItem, InsetRow } from '../../ui/inset-list'
import { ModuleHeaderButtons } from '../../ui/module-header-buttons'
import { moduleTile } from '../../ui/module-tile'
import { RecordThumb } from '../../ui/record-thumb'
import { washScreenOptions } from '../../ui/screen-header'
import { WashHeader } from '../../ui/wash-header'
import { moduleHref } from '../moduleDestination'
import { AddRecipeSheet } from './AddRecipeSheet'
import { RECIPE_UI_ICONS } from './icons'
import { StarRating } from './StarRating'
import { type ListedRecipe, useRecipes } from './useRecipes'

export function CollectionScreen() {
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const { recipes, loading } = useRecipes()
  const remove = useMutation(api.recipes.remove)

  const [adding, setAdding] = useState(false)

  const shown = useMemo(
    () =>
      [...(recipes ?? [])].sort((a, b) => a.title.localeCompare(b.title)),
    [recipes],
  )

  const text = t.recipes.list

  function confirmDelete(recipe: ListedRecipe) {
    confirmDestructive({
      title: t.recipes.detail.deleteTitle,
      message: fmt(t.recipes.detail.deleteBody, { title: recipe.title }),
      confirm: t.common.actions.delete,
      cancel: t.common.actions.cancel,
      onConfirm: () =>
        remove({ id: recipe._id as Id<'recipes'> }).catch(() =>
          haptics.actionFailed(),
        ),
    })
  }

  const openAdd = () => setAdding(true)
  const goImport = () => {
    setAdding(false)
    router.push(moduleHref('/all/recipes/import'))
  }
  const goBlank = () => {
    setAdding(false)
    router.push(moduleHref('/all/recipes/new'))
  }

  const header = (
    <Stack.Screen
      options={{
        ...washScreenOptions(t.modules.byId.recipes.label),
        headerRight: () => (
          <ModuleHeaderButtons
            testID="recipes"
            moduleLabel={t.modules.byId.recipes.label}
            search="recipes"
            before={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={text.add}
                  testID="recipes-add"
                  hitSlop={12}
                  onPress={openAdd}
                  style={({ pressed }) => [
                    styles.headerButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <RECIPE_UI_ICONS.Plus
                    size={22}
                    color={tokens.ink}
                    strokeWidth={2.1}
                  />
                </Pressable>
            }
          />
        ),
      }}
    />
  )

  if (loading)
    return (
      <>
        {header}
        <View style={{ flex: 1, backgroundColor: tokens.ground }}>
          <LoadingSkeleton rows={5} label={t.actions.loading} />
        </View>
      </>
    )

  const collectionIsEmpty = (recipes ?? []).length === 0
  const tile = moduleTile('recipes')

  return (
    <>
      {header}
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        data={shown}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={
          tile ? (
            <WashHeader
              group={tile.group}
              glyph={tile.glyph}
              summary={{
                count: plural(locale, (recipes ?? []).length, text.count),
                scope: group.name,
              }}
            />
          ) : undefined
        }
        ListEmptyComponent={
          collectionIsEmpty ? (
            // *Nothing yet*: a Module with nothing in it is empty, not off, so
            // it invites you to make its first thing (ADR-0022).
            <View style={styles.empty} testID="recipes-empty">
              <Text style={[styles.emptyTitle, { color: tokens.ink }]}>
                {text.emptyTitle}
              </Text>
              <Text style={[styles.emptyBody, { color: tokens.muted }]}>
                {text.emptyBody}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.emptyAction}
                testID="recipes-empty-add"
                onPress={openAdd}
                style={({ pressed }) => [
                  styles.emptyButton,
                  { backgroundColor: tokens.accent },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.emptyButtonLabel, { color: tokens.onAccent }]}
                >
                  {text.emptyAction}
                </Text>
              </Pressable>
            </View>
          ) : undefined
        }
        renderItem={({ item, index }) => (
          <InsetListItem index={index} count={shown.length}>
            <RecipeRow
              recipe={item}
              onOpen={() =>
                router.push(
                  moduleHref('/all/recipes/recipe', { recipeId: item._id }),
                )
              }
              onEdit={() =>
                router.push(
                  moduleHref('/all/recipes/edit', { recipeId: item._id }),
                )
              }
              onDelete={() => confirmDelete(item)}
            />
          </InsetListItem>
        )}
      />

      {adding ? (
        <AddRecipeSheet
          onImport={goImport}
          onBlank={goBlank}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  )
}

function RecipeRow({
  recipe,
  onOpen,
  onEdit,
  onDelete,
}: {
  recipe: ListedRecipe
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const tile = moduleTile('recipes')

  // A recipe you may only read has neither gesture: both of them end in a
  // write, and offering one that can only be refused is worse than not.
  const writes = recipe.canEdit
    ? {
        onDelete,
        deleteLabel: t.common.actions.delete,
        menu: {
          actions: [
            { id: 'edit', title: t.common.actions.edit },
            {
              id: 'delete',
              title: t.common.actions.delete,
              attributes: { destructive: true },
            },
          ],
          onAction: (action: string) => {
            if (action === 'edit') onEdit()
            if (action === 'delete') onDelete()
          },
        },
      }
    : {}

  return (
    <InsetRow
      testID={`recipe-row-${recipe._id}`}
      accessibilityLabel={fmt(t.recipes.list.openRecipe, {
        title: recipe.title,
      })}
      onPress={onOpen}
      chevron
      // #114: a recipe with no picture gets the Module's tile rather than an
      // empty block, so a row is never a hole in the list.
      leading={
        tile ? (
          <RecordThumb
            uri={recipe.imageUrl}
            group={tile.group}
            glyph={tile.glyph}
          />
        ) : null
      }
      title={recipe.title}
      {...writes}
    >
      {recipe.rating != null ? (
        <StarRating value={recipe.rating} size={14} />
      ) : null}
      {recipe.homeGroupName || recipe.tags.length ? (
        <View style={styles.rowMeta}>
          {/* Whose collection this came from, said only when it is not this
              one — the cue an ambient Group takes away (ADR-0015). */}
          {recipe.homeGroupName ? (
            <Text
              testID="recipe-row-shared-in"
              style={[
                styles.badge,
                { color: tokens.ink, backgroundColor: tokens.surface2 },
              ]}
            >
              {fmt(t.recipes.list.livesIn, { group: recipe.homeGroupName })}
            </Text>
          ) : null}
          {recipe.tags.slice(0, 3).map((tag) => (
            <Text
              key={tag}
              style={[
                styles.badge,
                { color: tokens.muted, backgroundColor: tokens.surface2 },
              ]}
            >
              {tag}
            </Text>
          ))}
        </View>
      ) : null}
    </InsetRow>
  )
}

const styles = StyleSheet.create({
  content: {},
  headerButton: { padding: 6 },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge: {
    ...TYPE.footnoteStrong,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  empty: { paddingHorizontal: 24, paddingVertical: 48, gap: 10 },
  emptyTitle: { ...TYPE.title2, letterSpacing: -0.3 },
  emptyBody: { ...TYPE.subhead },
  emptyButton: {
    marginTop: 8,
    borderRadius: RADIUS.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonLabel: { ...TYPE.bodyStrong },
  pressed: { opacity: 0.6 },
})
