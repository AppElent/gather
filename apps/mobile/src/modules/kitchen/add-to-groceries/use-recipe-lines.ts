/**
 * Recipes' ingredients as the add-to-groceries sheet's lines (APP-312; a
 * week of recipes for APP-321).
 *
 * Each line is read by the local parser first (`readIngredientLine`, the
 * composer's parser with the cook's notes taken off). What it cannot read
 * comes from this phone's cache of earlier AI readings of the same
 * ingredients, and only what is still left goes to the AI, in one call for
 * all the recipes together (in batches when there are more than one call
 * carries, `readInBatches`) that counts against the person's daily cap. Over
 * the cap, offline, or without an answer, the lines not yet read are added as
 * plain text.
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
import { type AiCount, readInBatches } from './read-batches'

export interface IngredientSource {
  id: string
  ingredients: readonly string[]
  servings?: number
}

export type { AiCount }

/**
 * What the AI has answered so far, line text by line text. `done` once it
 * has answered all it will: what it did not answer is plain text.
 */
interface AiAnswer {
  reads: Record<string, CachedRead>
  answered: ReadonlySet<string>
  done: boolean
  count: AiCount | null
}

const READING: AiAnswer = {
  reads: {},
  answered: new Set(),
  done: false,
  count: null,
}

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
      ),
    [local],
  )
  const unreadKey = unread.join('\n')

  const unreadSet = useMemo(() => new Set(unread), [unread])

  const [ai, setAi] = useState<AiAnswer>(READING)
  useEffect(() => {
    if (!unreadKey) return
    let live = true
    setAi(READING)
    readInBatches(
      unreadKey.split('\n'),
      (lines) => readLines({ lines }),
      ({ texts, lines, count }) => {
        const seen: Record<string, CachedLine> = {}
        texts.forEach((text, index) => {
          seen[text] = lines[index]
        })
        // Plain-text answers are kept too, so the line is not asked again.
        for (const { recipe, digest } of local) {
          const own: Record<string, CachedLine> = {}
          for (const text of recipe.ingredients)
            if (text.trim() in seen) own[text.trim()] = seen[text.trim()]
          if (Object.keys(own).length > 0) cacheLines(recipe.id, digest, own)
        }
        setAi((current) => ({
          reads: {
            ...current.reads,
            ...Object.fromEntries(
              texts.flatMap((text, index) => {
                const read = lines[index]
                return read ? [[text, read] as const] : []
              }),
            ),
          },
          answered: new Set([...current.answered, ...texts]),
          done: false,
          count,
        }))
      },
      () => live,
    )
      .catch(() => undefined)
      .then(() => {
      // Whatever is still unanswered (over the cap, offline) is plain text.
      if (live) setAi((current) => ({ ...current, done: true }))
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
      else if (!unreadSet.has(text.trim())) read = { kind: 'text' }
      else {
        const answer = ai.reads[text.trim()]
        if (answer) read = { kind: 'read', via: 'ai', ...answer }
        else if (ai.done || ai.answered.has(text.trim())) read = { kind: 'text' }
        else read = { kind: 'reading' }
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
    aiCount: ai.done ? ai.count : null,
  }
}
