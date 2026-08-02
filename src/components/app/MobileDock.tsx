import { Link } from '@tanstack/react-router'
import { dockNavItems } from '../../lib/appNavigation'
import { Icon } from './Icon'
import { useNavigation } from './useNavigation'

/**
 * The same navigation as the sidebar, cut to what a phone has room for.
 *
 * Home and All keep their ends and the pins in between lose their tail, so the
 * shape is recognisably the same on both devices. Which item is active is
 * decided against the *full* list, not this one — a pin the dock had no room
 * for must not make the two surfaces disagree.
 *
 * Off a Group route the dock keeps pointing at the Group you were last in, so
 * a trip to Groups or Settings does not take the bottom of the phone away and
 * give it back. With no Group visited at all there is no navigation to show and
 * the dock is not there — a bar of nothing pinned to the bottom of a phone is a
 * bar that still takes the space. Settings, Groups and Account are reached from
 * the topbar either way, through its navigation button and its user menu, which
 * do not depend on a Group.
 */
export function MobileDock() {
  const { items, activeId } = useNavigation()
  const shown = dockNavItems(items, activeId)

  if (shown.length === 0) return null

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-2 bottom-2 z-30 grid gap-1 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-1 md:hidden"
      // Someone who has pinned nothing gets two items, not four empty columns.
      style={{
        gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`,
      }}
    >
      {shown.map((item) => (
        <Link
          key={item.id}
          {...item.link}
          aria-current={item.id === activeId ? 'page' : undefined}
          className="grid min-h-11 place-items-center rounded-[7px] text-xs text-[var(--app-muted)] no-underline aria-[current=page]:bg-[var(--app-surface-muted)] aria-[current=page]:text-[var(--app-fg)]"
        >
          <Icon name={item.icon} className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
