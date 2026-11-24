import {
  type GroceryAisle,
  readIngredientLine,
  recogniseGroceryLine,
} from '@gather/core/groceries'
import {
  type AiCount,
  type CachedRead,
  readInBatches,
} from '@gather/core/grocery-ai-batches'
import {
  ingredientKeys,
  ingredientsDigest,
  type LineRead,
  type SourceLine,
} from '@gather/core/grocery-pick'
import { useAction, useQuery } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  type CachedLine,
  cacheRecipeLines,
  readCachedRecipeLines,
} from './preferences'

export interface IngredientSource {
  id: string
  ingredients: readonly string[]
  servings?: number
}

interface AiAnswer {
  reads: Record<string, CachedRead>
  answered: ReadonlySet<string>
  done: boolean
  count: AiCount | null
  run: string | null
}

const INITIAL_AI: AiAnswer = {
  reads: {},
  answered: new Set(),
  done: false,
  count: null,
  run: null,
}

type OwnRead =
  | { kind: 'local'; read: CachedRead }
  | { kind: 'earlier'; read: CachedRead }
  | { kind: 'text' }
  | { kind: 'unread' }

/** Read one recipe's ingredients locally, from localStorage cache, and via AI fallback. */
export function useRecipeLines(recipe: IngredientSource): {
  lines: SourceLine[]
  aiCount: AiCount | null
  readingAsText: boolean
} {
  const { id, ingredients, servings } = recipe
  const readLines = useAction(api.groceryLines.read)

  const local = useMemo(() => {
    const digest = ingredientsDigest(ingredients)
    const cached = readCachedRecipeLines(id, digest)
    const reads = ingredients.map((text): OwnRead => {
      const parsed = readIngredientLine(text)
      if (parsed) return { kind: 'local', read: parsed }
      const earlier = cached[text.trim()]
      if (earlier === null) return { kind: 'text' }
      if (earlier) return { kind: 'earlier', read: earlier }
      return { kind: 'unread' }
    })
    return { digest, reads }
  }, [id, ingredients])

  const unread = useMemo(
    () =>
      Array.from(
        new Set(
          ingredients
            .filter((_, index) => local.reads[index].kind === 'unread')
            .map((text) => text.trim())
            .filter(Boolean),
        ),
      ),
    [ingredients, local.reads],
  )
  const unreadKey = unread.join('\n')
  const unreadSet = useMemo(() => new Set(unread), [unread])

  const [ai, setAi] = useState<AiAnswer>(INITIAL_AI)
  const answered = useRef<Set<string>>(new Set())
  const turn = useRef<Promise<unknown>>(Promise.resolve())
  const capped = useRef(false)

  useEffect(() => {
    if (!unreadKey) return
    let live = true
    setAi((current) => ({ ...current, done: false }))
    const run = async () => {
      if (capped.current) {
        if (live) setAi((current) => ({ ...current, done: true }))
        return
      }
      const todo = unreadKey
        .split('\n')
        .filter((text) => !answered.current.has(text))
      const end = await readInBatches(
        todo,
        (batch) => readLines({ lines: batch }),
        ({ texts, lines, count }) => {
          for (const text of texts) answered.current.add(text)
          const seen: Record<string, CachedLine> = {}
          texts.forEach((text, index) => {
            seen[text] = lines[index]
          })
          cacheRecipeLines(id, local.digest, seen)
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
            run: unreadKey,
          }))
        },
        () => live,
      ).catch(() => 'unavailable' as const)
      if (end === 'limit') capped.current = true
      if (live) setAi((current) => ({ ...current, done: true }))
    }
    turn.current = turn.current
      .then(() => (live ? run() : undefined))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [id, local.digest, unreadKey, readLines])

  const lines = useMemo(() => {
    const keys = ingredientKeys(ingredients)
    return (
      ingredients
        .map((text, index): SourceLine => {
          const mine = local.reads[index]
          const trimmed = text.trim()
          let read: LineRead
          if (mine.kind === 'local')
            read = { kind: 'read', via: 'local', ...mine.read }
          else if (mine.kind === 'earlier')
            read = { kind: 'read', via: 'ai-earlier', ...mine.read }
          else if (mine.kind === 'text' || !trimmed || !unreadSet.has(trimmed))
            read = { kind: 'text' }
          else {
            const answer = ai.reads[trimmed]
            if (answer) read = { kind: 'read', via: 'ai', ...answer }
            else if (ai.done || ai.answered.has(trimmed))
              read = { kind: 'text' }
            else read = { kind: 'reading' }
          }
          return {
            key: keys[index],
            text,
            read,
            ...(servings ? { servings } : {}),
          }
        })
        .filter((line) => line.text.trim())
    )
  }, [ingredients, local.reads, unreadSet, ai, servings])

  return {
    lines,
    aiCount: ai.count,
    readingAsText: ai.run === unreadKey,
  }
}

/**
 * Ask Convex (`groceryLines.aisles`) for the aisle of a typed grocery line
 * after a short pause, falling back instantly to `@gather/core`'s local
 * dictionary so the preview chip never stalls.
 */
export function useRecognisedAisle(
  groupSlug: string,
  listId: Id<'taskLists'> | undefined,
  line: string,
): GroceryAisle {
  const trimmed = line.trim()
  const [debounced, setDebounced] = useState(trimmed)

  useEffect(() => {
    if (!trimmed) {
      setDebounced('')
      return
    }
    const timer = setTimeout(() => setDebounced(trimmed), 250)
    return () => clearTimeout(timer)
  }, [trimmed])

  const serverAisles = useQuery(
    api.groceryLines.aisles,
    listId && debounced
      ? { groupSlug, listId, titles: [debounced] }
      : 'skip',
  )

  const localAisle = useMemo(
    () => (trimmed ? recogniseGroceryLine(trimmed).aisle : 'other'),
    [trimmed],
  )

  if (debounced === trimmed && serverAisles?.[0]) return serverAisles[0]
  return localAisle
}
