/**
 * A recipe's ingredients as the add-to-groceries sheet's lines (APP-312).
 *
 * Each line is read by the local parser first (`readIngredientLine`, the
 * composer's parser with the cook's notes taken off). What it cannot read
 * comes from this phone's cache of earlier AI readings of the same
 * ingredients, and only what is still left goes to the AI, in one call that
 * counts against the person's daily cap. Over the cap, offline, or without an
 * answer, those lines are added as plain text.
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

type AiAnswer =
  | { state: 'reading' }
  | { state: 'done'; reads: Record<string, CachedRead>; count: AiCount | null }

export function useRecipeLines(recipe: {
  id: string
  ingredients: readonly string[]
  servings?: number
}): { lines: SourceLine[]; aiCount: AiCount | null } {
  const readLines = useAction(api.groceryLines.read)
  const digest = ingredientsDigest(recipe.ingredients)

  // What the phone reads by itself, and what it read with the AI before.
  const local = useMemo(() => {
    const cached = readCachedLines(recipe.id, digest)
    const reads = recipe.ingredients.map((text) => {
      const read = readIngredientLine(text)
      if (read) return { kind: 'local' as const, read }
      const earlier = cached[text.trim()]
      // The AI read it before; null means it read the line as plain text.
      if (earlier === null) return { kind: 'text' as const }
      if (earlier) return { kind: 'earlier' as const, read: earlier }
      return { kind: 'unread' as const }
    })
    return reads
  }, [recipe.id, recipe.ingredients, digest])

  const unread = useMemo(
    () =>
      Array.from(
        new Set(
          recipe.ingredients
            .filter((_, index) => local[index].kind === 'unread')
            .map((text) => text.trim())
            .filter(Boolean),
        ),
      ),
    [recipe.ingredients, local],
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
        cacheLines(recipe.id, digest, seen)
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
  }, [unreadKey, readLines, recipe.id, digest])

  const lines = recipe.ingredients.map((text, index): SourceLine => {
    const own = local[index]
    let read: LineRead
    if (own.kind === 'local') read = { kind: 'read', via: 'local', ...own.read }
    else if (own.kind === 'earlier')
      read = { kind: 'read', via: 'ai-earlier', ...own.read }
    else if (own.kind === 'text' || !text.trim()) read = { kind: 'text' }
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
  return {
    lines: lines.filter((line) => line.text.trim()),
    aiCount: ai.state === 'done' ? ai.count : null,
  }
}
