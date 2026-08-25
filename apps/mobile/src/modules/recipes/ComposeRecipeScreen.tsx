/**
 * Making a recipe — from a link, or from nothing.
 *
 * One screen for both, because the only difference is a text field at the top.
 * The form underneath is the same form, the destination notice is the same
 * notice, and the save is the same save; splitting them would be two files that
 * have to be kept identical.
 *
 * ## An import is a reading, not a recipe
 *
 * Pasting a link runs `recipeImport.importFromUrl`, which fetches the page and
 * either finds structured recipe data in it or asks a model to read it. What
 * comes back is partly parsed and partly guessed, so it fills the form and
 * stops there. Nothing is written to the Group until somebody presses Save,
 * which means a bad parse is rejected by walking away and costs the household
 * nothing.
 *
 * The exception, and it is a real one: the *picture* is already stored by the
 * time the form appears, because the import action has to fetch it server-side
 * to get it into Convex storage at all. Abandoning an import therefore leaves
 * an orphaned blob — issue #41 — and review-before-save makes abandoning the
 * expected way to reject a bad parse rather than a rare accident. This screen
 * does not fix that; it makes it worth fixing.
 *
 * ## Saving lands you on what you made
 *
 * `docs/mobile-interaction.md` says a `handoff` returns you where you started,
 * and that rule is right for a quick capture: you pressed Add from the Baby
 * log, so saving a task should not strand you in Tasks. It is wrong for a
 * review-and-save, where the screen changing *is* the confirmation and the
 * thing you want next is the recipe you just made — to check the importer got
 * the oven temperature right. The doc has been amended rather than excepted,
 * which is what the doc itself asks for.
 *
 * The form itself is never left on the stack: it has done its job, and Back
 * from the new recipe must not return to something that would save a second
 * copy. What replaces it is the *collection*, not the tab root the form was
 * launched from — see `save` for why one call covers both doors.
 */
import { useAction, useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import type { RecipeBase } from './paths'
import { recipeHref } from './paths'
import { RecipeFields } from './RecipeFields'
import {
  blankRecipeForm,
  recipeFieldsFrom,
  recipeFormFromImport,
  recipeFormProblem,
} from './recipeForm'
import { useRecipes } from './useRecipes'

export interface ComposeRecipeScreenProps {
  /** Which tab stack this instance is mounted in (ADR-0023). */
  base: RecipeBase
  /** `import` shows the link bar; `new` is the blank page behind it. */
  mode: 'import' | 'new'
}

export function ComposeRecipeScreen({ base, mode }: ComposeRecipeScreenProps) {
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useI18n()
  const { groupSlug, groupName } = useRecipes()

  const create = useMutation(api.recipes.create)
  const generateUploadUrl = useMutation(api.recipes.generateUploadUrl)
  const importFromUrl = useAction(api.recipeImport.importFromUrl)
  const aiConfigured = useQuery(api.recipes.aiConfigured)
  const estimateNutrition = useAction(api.recipeNutrition.estimateNutrition)

  const [values, setValues] = useState(blankRecipeForm)
  const [photoId, setPhotoId] = useState<string | null | undefined>()
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  // Kept beside the form rather than in it: it is provenance, not something
  // anybody types, and a failed re-import must be able to drop it on its own.
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)

  const [link, setLink] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProblem, setImportProblem] = useState<string | null>(null)
  const [imported, setImported] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveProblem, setSaveProblem] = useState<string | null>(null)

  const problem = recipeFormProblem(values)
  const text = t.recipes

  async function runImport() {
    const url = link.trim()
    if (!url) return
    setImporting(true)
    setImportProblem(null)
    setImported(false)
    // Dropped the moment a new attempt starts: if this one fails, saving must
    // not quietly attach the address of an earlier, unrelated import.
    setSourceUrl(null)
    try {
      const result = await importFromUrl({ url, groupSlug })
      setValues(recipeFormFromImport(result))
      setPhotoId(result.imageId ?? undefined)
      setPhotoUrl(result.imageUrl)
      setSourceUrl(result.sourceUrl)
      setImported(true)
      haptics.itemSaved()
    } catch (error) {
      haptics.actionFailed()
      setImportProblem(messageFrom(error, text.create.importFailed))
    } finally {
      setImporting(false)
    }
  }

  async function save() {
    if (problem || saving) return
    setSaving(true)
    setSaveProblem(null)
    try {
      const id = await create({
        ...recipeFieldsFrom(values),
        groupSlug,
        sourceUrl: sourceUrl ?? undefined,
        // The bytes are already up; only the id crosses (ADR-0010).
        imageId: (photoId ?? undefined) as Id<'_storage'> | undefined,
      })
      haptics.itemSaved()
      // Land on the recipe, with the collection underneath it — never with
      // whatever happened to be there when the form was pushed.
      //
      // `dismissTo` is what makes one line serve both doors. Opened from the
      // collection, the stack is [Recipes, form] and this pops back to
      // Recipes; opened from the Add tab it is [Home, form], the collection is
      // not in it, and `dismissTo` replaces the form with it instead. Either
      // way the recipe is pushed onto the collection, so Back from a recipe
      // you just made goes where a recipe lives rather than to the tab root
      // you happened to launch from.
      router.dismissTo(recipeHref(base, ''))
      router.push(recipeHref(base, '/recipe', { recipeId: id }))
    } catch (error) {
      haptics.actionFailed()
      setSaveProblem(messageFrom(error, text.form.saveFailed))
      setSaving(false)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title:
            mode === 'import' ? text.create.chooseImport : text.create.title,
        }}
      />
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
          {mode === 'import' ? (
            <View style={styles.field}>
              <Text style={[styles.label, { color: tokens.muted }]}>
                {text.create.linkLabel.toUpperCase()}
              </Text>
              <View style={styles.linkRow}>
                <TextInput
                  value={link}
                  onChangeText={setLink}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  inputMode="url"
                  returnKeyType="go"
                  onSubmitEditing={runImport}
                  editable={!importing}
                  placeholder={text.create.importPlaceholder}
                  placeholderTextColor={tokens.muted}
                  testID="recipe-import-url"
                  style={[
                    styles.input,
                    styles.linkInput,
                    {
                      color: tokens.fg,
                      backgroundColor: tokens.surface,
                      borderColor: tokens.border,
                    },
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={text.create.import}
                  testID="recipe-import-run"
                  disabled={importing || !link.trim()}
                  onPress={runImport}
                  style={({ pressed }) => [
                    styles.importButton,
                    { backgroundColor: tokens.accent },
                    (pressed || importing || !link.trim()) && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.importLabel, { color: tokens.onAccent }]}
                  >
                    {importing ? text.create.importing : text.create.import}
                  </Text>
                </Pressable>
              </View>
              {importProblem ? (
                <Text
                  testID="recipe-import-problem"
                  style={[styles.problem, { color: tokens.danger }]}
                >
                  {importProblem}
                </Text>
              ) : null}
              {imported && !importProblem ? (
                <Text
                  testID="recipe-import-done"
                  style={[styles.note, { color: tokens.muted }]}
                >
                  {text.create.review}
                </Text>
              ) : null}
            </View>
          ) : null}

          <RecipeFields
            values={values}
            onChange={setValues}
            photoUrl={photoUrl}
            photoId={photoId}
            onPhotoChange={(id) => {
              setPhotoId(id)
              if (id === null) setPhotoUrl(null)
            }}
            generateUploadUrl={generateUploadUrl}
            onEstimate={
              aiConfigured ? (args) => estimateNutrition(args) : undefined
            }
            disabled={saving || importing}
          />

          {/* The Group a save lands in, named on the screen that does it —
              the same job the web's destination notice does, for an ambient
              Group that has no URL to give it away (ADR-0015). */}
          <Text
            testID="recipe-destination"
            style={[styles.note, { color: tokens.muted }]}
          >
            {fmt(text.form.destination, { group: groupName })}
          </Text>

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

/**
 * What went wrong, in words somebody can read.
 *
 * A `ConvexError` carries a message the server chose — "That address could not
 * be fetched" — and is worth showing. Anything else is a network or a bug, and
 * the Module's own sentence is a better answer than its stack.
 */
export function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof ConvexError && typeof error.data === 'string')
    return error.data
  return fallback
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  linkRow: { flexDirection: 'row', gap: 8 },
  linkInput: { flex: 1 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 46,
  },
  importButton: {
    borderRadius: RADIUS.control,
    paddingHorizontal: 16,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importLabel: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 13, lineHeight: 19 },
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
