import { Link } from '@tanstack/react-router'
import { NAV_ACTIVE_OPTIONS } from '../../lib/appNavigation'
import { GroupSwitcher } from './GroupSwitcher'
import { Icon } from './Icon'
import { Pill } from './ShellPrimitives'
import { useNavigation } from './useNavigation'

export interface SidebarProps {
  variant?: 'desktop' | 'drawer'
  onNavigate?: () => void
}

const FOOTER_LINK =
  'grid min-h-9 items-center rounded-[var(--app-radius)] px-2 text-sm text-[var(--app-muted)] no-underline'

/**
 * Home, your pins, All — and nothing else.
 *
 * The full Module catalog used to live here, grouped into four headed blocks,
 * which is why a household with fourteen Modules had to scroll past ten it
 * never opens. That was never a reason to let a Group switch Modules off:
 * everything stays available, and All is one click away at the bottom of this
 * same list.
 *
 * Off a Group route — Settings, Account, the Groups list — the list is drawn
 * for the Group you were last in, so stepping out to pick a Group does not
 * blank the shell on the way. Only somebody who has not been in one yet gets
 * the sentence instead, and the switcher above it says the same thing.
 *
 * At the bottom, the pages that are not a Module: Groups and your own Settings,
 * which are about you and read the same from everywhere. A Group's own settings
 * are reached through the Group, on Groups, and not from here.
 */
export function Sidebar({ variant = 'desktop', onNavigate }: SidebarProps) {
  const isDrawer = variant === 'drawer'
  const { items, activeId } = useNavigation()

  return (
    <aside
      className={
        isDrawer
          ? 'flex min-h-full flex-col gap-6 overflow-y-auto p-4'
          : 'hidden h-svh w-66 shrink-0 flex-col gap-6 overflow-y-auto border-r border-[var(--app-border)] bg-[color-mix(in_oklch,var(--app-surface)_86%,transparent)] p-4 md:flex'
      }
      aria-label="Gather navigation"
    >
      <GroupSwitcher onNavigate={onNavigate} />

      {items.length === 0 ? (
        <p className="m-0 px-2 text-sm leading-6 text-[var(--app-muted)]">
          Pick a group to see its modules.
        </p>
      ) : (
        <nav className="grid gap-1" aria-label="Primary">
          {items.map((item) => (
            <Link
              key={item.id}
              {...item.link}
              onClick={onNavigate}
              // Colouring here comes from `activeId` below rather than from
              // `aria-current`, which is why the dock showed the router's
              // prefix-matching bug and this did not. The attribute was just as
              // wrong, and a screen reader had no second opinion to fall back
              // on — see `NAV_ACTIVE_OPTIONS`.
              activeOptions={NAV_ACTIVE_OPTIONS}
              aria-current={item.id === activeId ? 'page' : undefined}
              className={`grid min-h-10 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--app-radius)] border border-transparent px-2 text-sm font-semibold text-[var(--app-fg)] no-underline ${
                item.id === activeId
                  ? 'border-[var(--app-fg)] bg-[var(--app-surface)]'
                  : ''
              }`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-[7px] border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)]">
                <Icon name={item.icon} className="h-4 w-4" />
              </span>
              <span className="truncate">{item.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {item.placeholder ? <Pill>Soon</Pill> : null}
                {item.personal ? (
                  <span title="Only you can see this. It is the same in every group.">
                    <Pill>Only you</Pill>
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
        </nav>
      )}

      {/* The pages that are not a Module. This used to be a card headed
          "Preview group" over a sentence promising that group and member
          details would appear once connected — a promise Home now keeps, on a
          page, with real names on it. What was worth keeping is the links,
          which are the only way to leave a Group from the sidebar.

          A Group's own settings are no longer among them. A link that changes
          destination depending on where you are standing, sitting a row above
          one that never does and is called almost the same word, is two
          meanings of "settings" in the same two inches. The Group's settings
          hang off the Group instead: clicking it on Groups opens them. */}
      <nav className="mt-auto grid gap-1" aria-label="Settings and groups">
        <Link to="/groups" onClick={onNavigate} className={FOOTER_LINK}>
          Groups
        </Link>
        <Link to="/settings" onClick={onNavigate} className={FOOTER_LINK}>
          Settings
        </Link>
      </nav>
    </aside>
  )
}
