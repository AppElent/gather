/**
 * Correcting a recipe the Group owns.
 *
 * Every Member of the Group a recipe lives in may edit it — a fellow Member's
 * recipe is the household's, not theirs (CONTEXT.md's **Attribution**: it
 * records who, and confers nothing). A recipe reached through a Share comes
 * back with `canEdit` false and this screen never opens on it, because the
 * control that would open it is not drawn.
 *
 * Saving goes back rather than forward: you were already looking at this
 * recipe, and the change is visible the moment the screen behind reappears —
 * `recipes.get` is live, so there is nothing to reload and nothing to say.
 */
import { useAction, useMutation, useQuery } from 'convex/react'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import { messageFrom } from './ComposeRecipeScreen'
import { RecipeFields } from './RecipeFields'
import {
  type RecipeFormValues,
  recipeFieldsFrom,
  recipeFormFromRecipe,
  recipeFormProblem,
} from './recipeForm'
import { useRecipes } from './useRecipes'

export function EditRecipeScreen() {
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useI18n()
  const { groupSlug } = useRecipes()
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>()

  const recipe = useQuery(
    api.recipes.get,
    recipeId ? { id: recipeId as Id<'recipes'>, groupSlug } : 'skip',
  )
  const update = useMutation(api.recipes.update)
  const generateUploadUrl = useMutation(api.recipes.generateUploadUrl)
  const aiConfigured = useQuery(api.recipes.aiConfigured)
  const estimateNutrition = useAction(api.recipeNutrition.estimateNutrition)

  const [values, setValues] = useState<RecipeFormValues | null>(null)
  const [photoId, setPhotoId] = useState<string | null | undefined>()
  const [saving, setSaving] = useState(false)
  const [saveProblem, setSaveProblem] = useState<string | null>(null)

  // Filled once, when the recipe first arrives. `recipes.get` is live, so
  // re-seeding on every push would wipe out whatever is being typed the moment
  // anybody else in the household touched the row.
  const loaded = values !== null
  useEffect(() => {
    if (!loaded && recipe) setValues(recipeFormFromRecipe(recipe))
  }, [loaded, recipe])

  const text = t.recipes

  if (recipe === undefined || !values)
    return <LoadingSkeleton rows={5} label={t.actions.loading} />
  if (recipe === null)
    return (
      <Text style={[styles.missing, { color: tokens.muted }]}>
        {text.detail.notFound}
      </Text>
    )

  const problem = recipeFormProblem(values)

  async function save() {
    if (!values || problem || saving) return
    setSaving(true)
    setSaveProblem(null)
    const fields = recipeFieldsFrom(values)
    try {
      await update({
        id: recipeId as Id<'recipes'>,
        ...fields,
        // `undefined` leaves the picture alone; `null` takes it off. The
        // mutation replaces the stored file behind the access check.
        imageId:
          photoId === undefined
            ? undefined
            : ((photoId ?? null) as Id<'_storage'> | null),
        // An edit that cleared a field has to say so. `update` reads
        // `undefined` as "leave what is stored", so emptying the servings box
        // or unrating in the form would otherwise do nothing at all — `null`
        // is the only way to say *remove this*.
        rating: fields.rating ?? null,
        servings: fields.servings ?? null,
        nutrition: fields.nutrition ?? null,
        nutritionSource: fields.nutritionSource ?? null,
      })
      haptics.itemSaved()
      router.back()
    } catch (error) {
      haptics.actionFailed()
      setSaveProblem(messageFrom(error, text.form.saveFailed))
      setSaving(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: text.edit.title }} />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: tokens.bg }}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <RecipeFields
            values={values}
            onChange={setValues}
            photoUrl={recipe.imageUrl}
            photoId={photoId}
            onPhotoChange={setPhotoId}
            generateUploadUrl={generateUploadUrl}
            onEstimate={
              aiConfigured ? (args) => estimateNutrition(args) : undefined
            }
            disabled={saving}
          />

          {problem ? (
            <Text style={[styles.problem, { color: tokens.muted }]}>
              {text.form[problem]}
            </Text>
          ) : null}
          {saveProblem ? (
            <Text style={[styles.problem, { color: tokens.danger }]}>
              {saveProblem}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text.form.save}
            accessibilityState={{ disabled: Boolean(problem) || saving }}
            testID="recipe-save"
            disabled={Boolean(problem) || saving}
            onPress={save}
            style={({ pressed }) => [
              styles.save,
              {
                backgroundColor:
                  problem || saving ? tokens.tile : tokens.accent,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.saveLabel,
                { color: problem || saving ? tokens.muted : tokens.onAccent },
              ]}
            >
              {saving ? text.form.saving : text.form.save}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  missing: { fontSize: 15, textAlign: 'center', paddingVertical: 40 },
  problem: { fontSize: 13, lineHeight: 19 },
  save: {
    borderRadius: RADIUS.control,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveLabel: { fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
})
