import { useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { createActions } from '../../lib/createActions'
import { useMessages } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { MenuLink, ShellMenu } from './ShellMenu'
import { Tile } from './Tile'
import { useCurrentGroup } from './useCurrentGroup'

/**
 * Add: the web's counterpart of the phone's Add tab. A menu of create actions
 * for the Current Group's pinned Modules, each going to that Module's own
 * create flow (`src/lib/createActions.ts`). With nothing pinned that can be
 * added to, it says so and offers All modules, where pins are made.
 */
export function AddMenu({
  variant,
}: {
  /** `sidebar`: a row under Start. `tab`: a destination on the phone's bar. */
  variant: 'sidebar' | 'tab'
}) {
  const messages = useMessages()
  const { addMenu, nav } = messages.shell
  const { current: group } = useCurrentGroup()
  const pins = useQuery(
    api.users.myPins,
    group ? { groupSlug: group.slug } : 'skip',
  )
  const actions = createActions(pins ?? undefined, messages)

  return (
    <ShellMenu
      label={addMenu.label}
      labelFromContent
      trigger={
        variant === 'sidebar' ? (
          <>
            <span className="tile" aria-hidden="true">
              <Plus className="h-4 w-4" />
            </span>
            <span className="flex-1">{nav.add}</span>
          </>
        ) : (
          <>
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] leading-3 font-semibold">
              {nav.add}
            </span>
          </>
        )
      }
      triggerClassName={
        variant === 'sidebar'
          ? 'flex h-11 w-full items-center gap-3 rounded-[var(--radius-control)] px-2.5 text-left text-[15px] text-[var(--ink)] hover:bg-[var(--surface)] aria-expanded:bg-[var(--surface)]'
          : 'flex h-[50px] w-full flex-col items-center justify-center gap-0.5 rounded-full text-[var(--ink)] aria-expanded:bg-[var(--surface-2)]'
      }
      opens={variant === 'sidebar' ? 'down' : 'up'}
      // On the bar the menu hangs from the bar, not from the Add slot, so it
      // keeps inside a 320 px screen: the slot starts a quarter of the way in.
      anchor={variant === 'sidebar' ? 'button' : 'parent'}
      // No wider than its row: the sidebar scrolls, so it cuts off what sticks out.
      menuClassName={
        variant === 'sidebar'
          ? 'top-full left-0 mt-1 w-full'
          : 'bottom-full left-0 mb-4 w-72 max-w-full'
      }
    >
      {actions.length === 0 ? (
        // A menu owns only menu items, so the reason sits inside the one item
        // there is, where a screen reader reads it with the item's name.
        <MenuLink link={linkTo('all')}>
          <span className="tile" aria-hidden="true" />
          <span className="grid min-w-0">
            <span>{nav.allModules}</span>
            <span className="text-[13px] text-[var(--muted)]">
              {addMenu.empty}
            </span>
          </span>
        </MenuLink>
      ) : (
        actions.map((action) => (
          <MenuLink key={action.module} link={action.link}>
            <Tile icon={action.icon} group={action.group} />
            <span className="grid min-w-0">
              <span className="truncate">{action.label}</span>
              <span className="truncate text-[13px] text-[var(--muted)]">
                {action.moduleLabel}
              </span>
            </span>
          </MenuLink>
        ))
      )}
    </ShellMenu>
  )
}
