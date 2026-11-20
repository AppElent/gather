/**
 * The aisle of each row on the week sheet (APP-423): what the list itself
 * would give the item, the Group's own choice first, then the list's history,
 * then the dictionary (`groceryLines.aisles`, which runs the list's own
 * recogniser). Until the answer is in, and offline, the phone's built-in
 * recogniser answers, so rows do not wait; what an earlier answer said is kept
 * while a new question is out, so rows do not jump between aisles.
 */
import {
  type GroceryAisle,
  recogniseGroceryLine,
} from '@gather/core/groceries'
import { useEffect, useMemo, useState } from 'react'

import { api, type Id } from '../../../convex/api'
import { useQuery } from '../../../convex/queries'

/** Titles one question carries (`convex/groceryLines.ts`). */
const TITLES_MAX = 200

interface Known {
  listId: string | undefined
  aisles: ReadonlyMap<string, GroceryAisle>
}

export function useAisleOf(
  groupSlug: string,
  listId: string | undefined,
  titles: readonly string[],
): (title: string) => GroceryAisle {
  // The rows are new objects every render; what they ask is the same.
  const key = JSON.stringify(
    Array.from(new Set(titles)).sort().slice(0, TITLES_MAX),
  )
  const asked = useMemo<string[]>(() => JSON.parse(key), [key])
  const answer = useQuery(
    api.groceryLines.aisles,
    listId && asked.length > 0
      ? { groupSlug, listId: listId as Id<'taskLists'>, titles: asked }
      : 'skip',
  )
  const [known, setKnown] = useState<Known>({
    listId: undefined,
    aisles: new Map(),
  })
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
