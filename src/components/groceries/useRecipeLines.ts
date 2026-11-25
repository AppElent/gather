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
import {
  type RequestForQueries,
  useAction,
  useQueries,
  useQuery,
} from 'convex/react'
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

/** One recipe's ingredients as dialog lines, read locally and by the AI. */
export function useRecipeLines(recipe: IngredientSource): {
  lines: SourceLine[]
  aiCount: AiCount | null
  readingAsText: boolean
} {
  const { id, ingredients, servings } = recipe
  // A new array per render would read again; the fields are what matter.
  const recipes = useMemo(
    () => [{ id, ingredients, servings }],
    [id, ingredients, servings],
  )
  const { lines, aiCount, readingAsText } = useIngredientLines(recipes)
  return { lines: lines.get(recipe.id) ?? [], aiCount, readingAsText }
}

/** Several recipes' ingredients as sheet lines, by recipe id. */
export function useIngredientLines(recipes: readonly IngredientSource[]): {
  lines: Map<string, SourceLine[]>
  aiCount: AiCount | null
  /**
   * Whether the lines still being read may be added as text: the run reading
   * them has answered a batch, so the rest of a long week need not hold up
   * the button (APP-479). A line that started a new run waits (APP-590).
   */
  readingAsText: boolean
} {
  const readLines = useAction(api.groceryLines.read)

  // What the browser reads by itself, and what it read with the AI before.
  const local = useMemo(
    () =>
      recipes.map((recipe) => {
        const digest = ingredientsDigest(recipe.ingredients)
        const cached = readCachedRecipeLines(recipe.id, digest)
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

  const [ai, setAi] = useState<AiAnswer>(INITIAL_AI)
  // What the AI has answered, whichever run of the effect asked: an answer
  // that arrives after the lines changed is kept, not asked for again.
  const answered = useRef<Set<string>>(new Set())
  // Runs take turns, so a run starts after the call a former run left out.
  const turn = useRef<Promise<unknown>>(Promise.resolve())
  // Over the daily cap: a later run (a servings change, another day) does not
  // ask again, and what it would have asked is plain text (APP-590).
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
      // Only what no run has answered; when the former run's last call comes
      // back it is in there, so it is not asked a second time.
      const todo = unreadKey
        .split('\n')
        .filter((text) => !answered.current.has(text))
      const end = await readInBatches(
        todo,
        (lines) => readLines({ lines }),
        ({ texts, lines, count }) => {
          for (const text of texts) answered.current.add(text)
          const seen: Record<string, CachedLine> = {}
          texts.forEach((text, index) => {
            seen[text] = lines[index]
          })
          // Plain-text answers are kept too, so the line is not asked again.
          for (const { recipe, digest } of local) {
            const own: Record<string, CachedLine> = {}
            for (const text of recipe.ingredients)
              if (text.trim() in seen) own[text.trim()] = seen[text.trim()]
            if (Object.keys(own).length > 0) cacheRecipeLines(recipe.id, digest, own)
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
            run: unreadKey,
          }))
        },
        () => live,
      ).catch(() => 'unavailable' as const)
      if (end === 'limit') capped.current = true
      // Whatever is still unanswered (over the cap, offline) is plain text.
      if (live) setAi((current) => ({ ...current, done: true }))
    }
    turn.current = turn.current
      .then(() => (live ? run() : undefined))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [unreadKey, readLines, local])

  const lines = new Map<string, SourceLine[]>()
  for (const { recipe, reads } of local) {
    const keys = ingredientKeys(recipe.ingredients)
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
        key: keys[index],
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
    // As soon as a batch has answered, not only once all have (APP-479).
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

/** Titles one question carries (`convex/groceryLines.ts`). */
const TITLES_MAX = 200

/**
 * The aisle of each row of the week's groceries: what the list itself would
 * give the item. Until that answer is in, or when it is refused, the
 * browser's own recogniser answers, and what an earlier answer said is kept
 * while a new question is out, so rows do not jump between aisles.
 */
export function useAisleOf(
  groupSlug: string,
  listId: Id<'taskLists'> | undefined,
  titles: readonly string[],
): (title: string) => GroceryAisle {
  // The rows are new objects every render; what they ask is the same.
  const key = JSON.stringify(
    Array.from(new Set(titles)).sort().slice(0, TITLES_MAX),
  )
  const asked = useMemo<string[]>(() => JSON.parse(key), [key])
  // Batched rather than `useQuery`: a refused question comes back as its
  // Error instead of being thrown at the page.
  const queries = useMemo(
    (): RequestForQueries =>
      listId && asked.length > 0
        ? {
            aisles: {
              query: api.groceryLines.aisles,
              args: { groupSlug, listId, titles: asked },
            },
          }
        : {},
    [groupSlug, listId, asked],
  )
  const reply: unknown = (
    useQueries(queries) as Record<string, unknown>
  ).aisles
  const answer = Array.isArray(reply) ? (reply as GroceryAisle[]) : undefined
  const [known, setKnown] = useState<{
    listId: string | undefined
    aisles: ReadonlyMap<string, GroceryAisle>
  }>({ listId: undefined, aisles: new Map() })
  useEffect(() => {
    if (!answer) return
    setKnown((previous) => {
      const aisles = new Map(previous.listId === listId ? previous.aisles : [])
      asked.forEach((title, index) => {
        aisles.set(title, answer[index])
      })
      return { listId, aisles }
    })
  }, [answer, asked, listId])

  return useMemo(() => {
    const aisles = known.listId === listId ? known.aisles : undefined
    return (title) => aisles?.get(title) ?? recogniseGroceryLine(title).aisle
  }, [known, listId])
}
