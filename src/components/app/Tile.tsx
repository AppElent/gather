import type { ModuleGroup } from '@gather/core/modules'
import { Icon } from './Icon'

/**
 * A Module's tile (`tile-s`, or `tile-xs` in a dense list): its icon on its
 * group's fill. Without a group it is the quiet tile the shell's own
 * destinations wear — Start, Add, All modules, Settings.
 *
 * The colours come from `.tile[data-tile]` in `styles.css`, so no component
 * names a group fill (`styles.test.ts`).
 */
export function Tile({
  icon,
  group,
  size = 's',
}: {
  icon: string
  group?: ModuleGroup
  size?: 's' | 'xs'
}) {
  return (
    <span className="tile" data-tile={group} data-size={size} aria-hidden="true">
      <Icon name={icon} className={size === 'xs' ? 'h-3 w-3' : 'h-4 w-4'} />
    </span>
  )
}
