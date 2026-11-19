/**
 * Recipes' ingredients as the add-to-groceries sheet's lines (APP-312; a
 * week of recipes for APP-321).
 *
 * Each line is read by the local parser first (`readIngredientLine`, the
 * composer's parser with the cook's notes taken off). What it cannot read
 * comes from this phone's cache of earlier AI readings of the same
 * ingredients, and only what is still left goes to the AI, in one call for
 * all the recipes together that counts against the person's daily cap. Over
 * the cap, offline, or without an answer, those lines are added as plain text.
 */
import { readIngredientLine } from '@gather/core/groceries'
import { useAction } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/api'
import {
  type CachedLine,
  type CachedRead,
  cacheLines,
  readCachedLines,
} from './line-cache'
import { ingredientsDigest, type LineRead, type SourceLine } from './pick'

export interface AiCount {
  used: number
  limit: number
}

export interface IngredientSource {
  id: string
  ingredients: readonly string[]
  servings?: number
}

/** The lines one call may carry (`convex/lib/groceryLinesAi.ts`). */
const AI_LINES_MAX = 40

type AiAnswer =
  | { state: 'reading' }
  | { state: 'done'; reads: Record<string, CachedRead>; count: AiCount | null }

type OwnRead =
  | { kind: 'local'; read: CachedRead }
  | { kind: 'earlier'; read: CachedRead }
  | { kind: 'text' }
  | { kind: 'unread' }

/** One recipe's ingredients as sheet lines. */
export function useRecipeLines(recipe: IngredientSource): {
  lines: SourceLine[]
  aiCount: AiCount | null
} {
  const { id, ingredients, servings } = recipe
  // A new array per render would read again; the fields are what matter.
  const recipes = useMemo(
    () => [{ id, ingredients, servings }],
    [id, ingredients, servings],
  )
  const { lines, aiCount } = useIngredientLines(recipes)
  return { lines: lines.get(recipe.id) ?? [], aiCount }
}

/** Several recipes' ingredients as sheet lines, by recipe id. */
export function useIngredientLines(recipes: readonly IngredientSource[]): {
  lines: Map<string, SourceLine[]>
  aiCount: AiCount | null
} {
  const readLines = useAction(api.groceryLines.read)

  // What the phone reads by itself, and what it read with the AI before.
  const local = useMemo(
    () =>
      recipes.map((recipe) => {
        const digest = ingredientsDigest(recipe.ingredients)
        const cached = readCachedLines(recipe.id, digest)
        const reads = recipe.ingredients.map((text): OwnRead => {
          const read = readIngredientLine(text)
          if (read) return { kind: 'local', read }
          const earlier = cached[text.trim()]
          // The AI read it before; null means it read the line as plain text.
          if (earlier === null) return { kind: 'text' }
          if (earlier) return { kind: 'earlier', read: earlier }
          return { kind: 'unread' }
        })
        return { recipe, digest, reads }
      }),
    [recipes],
  )

  const unread = useMemo(
    () =>
      Array.from(
        new Set(
          local.flatMap(({ recipe, reads }) =>
            recipe.ingredients
              .filter((_, index) => reads[index].kind === 'unread')
              .map((text) => text.trim())
              .filter(Boolean),
          ),
        ),
      ).slice(0, AI_LINES_MAX),
    [local],
  )
  const unreadKey = unread.join('\n')

  const [ai, setAi] = useState<AiAnswer>({ state: 'reading' })
  useEffect(() => {
    if (!unreadKey) return
    let live = true
    const texts = unreadKey.split('\n')
    setAi({ state: 'reading' })
    readLines({ lines: texts })
      .then((answer) => {
        if (!live) return
        if (answer.status !== 'read') {
          setAi({ state: 'done', reads: {}, count: null })
          return
        }
        const reads: Record<string, CachedRead> = {}
        const seen: Record<string, CachedLine> = {}
        answer.lines.forEach((read, index) => {
          if (read) reads[texts[index]] = read
          seen[texts[index]] = read ?? null
        })
        // Plain-text answers are kept too, so the line is not asked again.
        for (const { recipe, digest } of local) {
          const own: Record<string, CachedLine> = {}
          for (const text of recipe.ingredients)
            if (text.trim() in seen) own[text.trim()] = seen[text.trim()]
          if (Object.keys(own).length > 0) cacheLines(recipe.id, digest, own)
        }
        setAi({
          state: 'done',
          reads,
          count: { used: answer.used, limit: answer.limit },
        })
      })
      .catch(() => {
        if (live) setAi({ state: 'done', reads: {}, count: null })
      })
    return () => {
      live = false
    }
  }, [unreadKey, readLines, local])

  const lines = new Map<string, SourceLine[]>()
  for (const { recipe, reads } of local) {
    const own = recipe.ingredients.map((text, index): SourceLine => {
      const mine = reads[index]
      let read: LineRead
      if (mine.kind === 'local') read = { kind: 'read', via: 'local', ...mine.read }
      else if (mine.kind === 'earlier')
        read = { kind: 'read', via: 'ai-earlier', ...mine.read }
      else if (mine.kind === 'text' || !text.trim()) read = { kind: 'text' }
      else if (!unread.includes(text.trim())) read = { kind: 'text' }
      else if (ai.state === 'reading') read = { kind: 'reading' }
      else {
        const answer = ai.reads[text.trim()]
        read = answer ? { kind: 'read', via: 'ai', ...answer } : { kind: 'text' }
      }
      return {
        key: String(index),
        text,
        read,
        ...(recipe.servings ? { servings: recipe.servings } : {}),
      }
    })
    lines.set(
      recipe.id,
      own.filter((line) => line.text.trim()),
    )
  }
  return {
    lines,
    aiCount: ai.state === 'done' ? ai.count : null,
  }
}
