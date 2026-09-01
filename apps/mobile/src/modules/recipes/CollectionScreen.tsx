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
 * - **The search is here, not in the Search tab.** `recipes.list` is a live
 *   query that already holds the whole collection, so filtering it costs
 *   nothing and asking the server again would cost a spinner. The Search tab
 *   stays a stub on purpose: it should be designed against several Modules
 *   rather than reverse-engineered from this one.
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
import { Image } from 'expo-image'
import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeContextMenu } from '../../components/NativeContextMenu'
import { SearchField } from '../../components/SearchField'
import { SwipeableRow } from '../../components/SwipeableRow'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { AddRecipeSheet } from './AddRecipeSheet'
import { RECIPE_UI_ICONS } from './icons'
import { type RecipeBase, recipeHref } from './paths'
import { recipeCollection } from './recipeFilter'
import { StarRating } from './StarRating'
import { type ListedRecipe, useRecipes } from './useRecipes'

export interface CollectionScreenProps {
  /** Which tab stack this instance is mounted in (ADR-0023). */
  base: RecipeBase
}

export function CollectionScreen({ base }: CollectionScreenProps) {
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useI18n()
  const { recipes, loading } = useRecipes()
  const remove = useMutation(api.recipes.remove)

  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  const shown = useMemo(
    () => recipeCollection(recipes ?? [], query),
    [recipes, query],
  )

  const text = t.recipes.list

  function confirmDelete(recipe: ListedRecipe) {
    Alert.alert(
      t.recipes.detail.deleteTitle,
      fmt(t.recipes.detail.deleteBody, { title: recipe.title }),
      [
        { text: t.actions.cancel, style: 'cancel' },
        {
          text: t.actions.delete,
          style: 'destructive',
          onPress: () =>
            remove({ id: recipe._id as Id<'recipes'> }).catch(() =>
              haptics.actionFailed(),
            ),
        },
      ],
    )
  }

  const openAdd = () => setAdding(true)
  const goImport = () => {
    setAdding(false)
    router.push(recipeHref(base, '/import'))
  }
  const goBlank = () => {
    setAdding(false)
    router.push(recipeHref(base, '/new'))
  }

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: t.modules.byId.recipes.label,
        headerRight: () => (
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
              color={tokens.fg}
              strokeWidth={2.1}
            />
          </Pressable>
        ),
      }}
    />
  )

  if (loading)
    return (
      <>
        {header}
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={5} label={t.actions.loading} />
        </View>
      </>
    )

  const collectionIsEmpty = (recipes ?? []).length === 0

  return (
    <>
      {header}
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        data={shown}
        keyExtractor={(item) => item._id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          // Hidden while the collection is empty: a search field over nothing
          // is a control that cannot do anything, and the empty state below
          // already says what to do instead.
          collectionIsEmpty ? null : (
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={text.search}
              clearAccessibilityLabel={text.clearSearch}
              testID="recipes-search"
              style={styles.search}
            />
          )
        }
        ListEmptyComponent={
          collectionIsEmpty ? (
            // *Nothing yet*: a Module with nothing in it is empty, not off, so
            // it invites you to make its first thing (ADR-0022).
            <View style={styles.empty} testID="recipes-empty">
              <Text style={[styles.emptyTitle, { color: tokens.fg }]}>
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
          ) : (
            // *Nothing found*: about the words somebody typed, and it offers
            // the way back out of them.
            <View style={styles.empty} testID="recipes-no-results">
              <Text style={[styles.emptyTitle, { color: tokens.fg }]}>
                {text.noResultsTitle}
              </Text>
              <Text style={[styles.emptyBody, { color: tokens.muted }]}>
                {fmt(text.noResultsBody, { query: query.trim() })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.clearSearch}
                testID="recipes-clear-search"
                onPress={() => setQuery('')}
                style={({ pressed }) => [
                  styles.emptyButton,
                  { backgroundColor: tokens.accent },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.emptyButtonLabel, { color: tokens.onAccent }]}
                >
                  {text.clearSearch}
                </Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <RecipeRow
            recipe={item}
            onOpen={() =>
              router.push(recipeHref(base, '/recipe', { recipeId: item._id }))
            }
            onEdit={() =>
              router.push(recipeHref(base, '/edit', { recipeId: item._id }))
            }
            onDelete={() => confirmDelete(item)}
          />
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
  const tint = tokens.tintOf('kitchen')
  const { t } = useI18n()

  const row = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fmt(t.recipes.list.openRecipe, {
        title: recipe.title,
      })}
      testID={`recipe-row-${recipe._id}`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: tokens.bg, borderBottomColor: tokens.border },
        pressed && styles.pressed,
      ]}
    >
      {recipe.imageUrl ? (
        <Image
          source={{ uri: recipe.imageUrl }}
          style={[styles.thumb, { backgroundColor: tokens.tile }]}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        // #114: a recipe with no picture gets the Module's glyph rather than
        // an empty block, so a row is never a hole in the list.
        <View
          style={[
            styles.thumb,
            styles.thumbEmpty,
            { backgroundColor: tint.bg },
          ]}
        >
          <RECIPE_UI_ICONS.ChefHat
            size={22}
            color={tint.fg}
            strokeWidth={1.6}
          />
        </View>
      )}
      <View style={styles.rowText}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: tokens.fg }]}>
          {recipe.title}
        </Text>
        {recipe.rating != null ? (
          <StarRating value={recipe.rating} size={14} />
        ) : null}
        <View style={styles.rowMeta}>
          {/* Whose collection this came from, said only when it is not this
              one — the cue an ambient Group takes away (ADR-0015). */}
          {recipe.homeGroupName ? (
            <Text
              numberOfLines={1}
              testID="recipe-row-shared-in"
              style={[
                styles.badge,
                { color: tint.fg, backgroundColor: tint.bg },
              ]}
            >
              {fmt(t.recipes.list.livesIn, { group: recipe.homeGroupName })}
            </Text>
          ) : null}
          {recipe.tags.slice(0, 3).map((tag) => (
            <Text
              key={tag}
              numberOfLines={1}
              style={[
                styles.badge,
                { color: tokens.muted, backgroundColor: tokens.tile },
              ]}
            >
              {tag}
            </Text>
          ))}
        </View>
      </View>
      <UI_ICONS.ChevronRight size={17} color={tokens.muted} strokeWidth={2.2} />
    </Pressable>
  )

  // A recipe you may only read has neither gesture: both of them end in a
  // write, and offering one that can only be refused is worse than not.
  if (!recipe.canEdit) return row

  return (
    <SwipeableRow deleteLabel={t.actions.delete} onDelete={onDelete}>
      <NativeContextMenu
        actions={[
          { id: 'edit', title: t.actions.edit },
          {
            id: 'delete',
            title: t.actions.delete,
            attributes: { destructive: true },
          },
        ]}
        onAction={(action) => {
          if (action === 'edit') onEdit()
          if (action === 'delete') onDelete()
        }}
      >
        {row}
      </NativeContextMenu>
    </SwipeableRow>
  )
}

const styles = StyleSheet.create({
  content: { paddingTop: 8 },
  headerButton: { padding: 6 },
  search: { marginHorizontal: 16, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 56, height: 56, borderRadius: RADIUS.tile },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge: {
    fontSize: 11.5,
    fontWeight: '600',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  empty: { paddingHorizontal: 24, paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  emptyBody: { fontSize: 14, lineHeight: 20 },
  emptyButton: {
    marginTop: 8,
    borderRadius: RADIUS.control,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonLabel: { fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.6 },
})
