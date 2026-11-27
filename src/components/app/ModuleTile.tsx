import type { ModuleGroup } from '@gather/core/modules'
import { Icon } from './Icon'

/**
 * A Module's glyph in a squircle filled with its group colour: one of the few
 * places a group's `fill` may go (DESIGN_SYSTEM.md, Web). Four sizes and
 * nothing between them, the phone's scale (`apps/mobile/src/ui/module-tile`).
 *
 * Without a group it is the quiet tile of the shell's own destinations (Add,
 * Settings): `ink` on `surface-2`.
 *
 * Always decoration: it sits beside the Module's or record's name, which is
 * what assistive technology reads.
 */
export type TileSize = 'xs' | 's' | 'm' | 'l'

/** Written out so Tailwind sees every class it has to generate. */
const SIZE: Record<TileSize, { box: string; glyph: string }> = {
  xs: {
    box: 'size-[var(--size-tile-xs)] rounded-[var(--radius-tile-xs)]',
    glyph: 'size-3',
  },
  s: {
    box: 'size-[var(--size-tile-s)] rounded-[var(--radius-tile-s)]',
    glyph: 'size-4',
  },
  m: {
    box: 'size-[var(--size-tile-m)] rounded-[var(--radius-tile-m)]',
    glyph: 'size-5',
  },
  l: {
    box: 'size-[var(--size-tile-l)] rounded-[var(--radius-tile-l)]',
    glyph: 'size-[30px]',
  },
}


export function ModuleTile({
  group,
  icon,
  size = 's',
  className = '',
}: {
  group?: ModuleGroup
  /** The lucide name the Module declares (`ModuleDef.icon`). */
  icon: string
  size?: TileSize
  className?: string
}) {
  const { box, glyph } = SIZE[size]
  return (
    <span
      aria-hidden="true"
      data-tile={size}
      // The group's `[data-group]` rule (styles.css) points `--accent` at its
      // fill and `--on-accent` at its glyph colour, whatever page it is on.
      data-group={group}
      className={`inline-flex shrink-0 items-center justify-center ${group ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--surface-2)] text-[var(--ink)]'} ${box} ${className}`.trim()}
    >
      <Icon name={icon} className={glyph} />
    </span>
  )
}
