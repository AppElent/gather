import type { TaskListIcon } from '@gather/core/task-lists'
import type { TaskList } from '@gather/core/task-model'
import { Link2 } from 'lucide-react'
import { ModuleTile, type TileSize } from '../app/ModuleTile'

/** A list's own icon, as the lucide name the web draws it with. */
export const LIST_GLYPHS: Record<TaskListIcon, string> = {
  list: 'List',
  sparkles: 'Sparkles',
  suitcase: 'Luggage',
  cart: 'ShoppingCart',
  gift: 'Gift',
  house: 'House',
  papers: 'Files',
}

/** A list's tile: its own face, or the neutral link tile of a linked one. */
export function ListTile({
  list,
  size = 's',
}: {
  list: Pick<TaskList, 'provider' | 'icon' | 'color'>
  size?: TileSize
}) {
  if (list.provider === 'local') {
    return (
      <ModuleTile group={list.color} icon={LIST_GLYPHS[list.icon]} size={size} />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-[var(--size-tile-s)] shrink-0 items-center justify-center rounded-[var(--radius-tile-s)] bg-[var(--surface-2)] text-[var(--ink)]"
    >
      <Link2 className="size-4" />
    </span>
  )
}

/** A Member's initial in a round coin. */
export function Coin({ initial, label }: { initial: string; label?: string }) {
  return (
    <span
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className="grid size-[26px] shrink-0 place-items-center rounded-[var(--radius-pill)] bg-[var(--surface-2)] text-[11px] font-bold text-[var(--ink)]"
    >
      {initial}
    </span>
  )
}
