import { X } from 'lucide-react'
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
} from 'react'
import { useMessages } from '../../lib/i18n'
import { buttonClass } from './buttons'

/**
 * The shared web Module list-and-detail layout (APP-300), under the Module's
 * `WashHeader`: a list column beside a 22 px `surface` panel that shows either
 * its default content (tabs) or the open record.
 *
 * - At `lg` (1024 px) and up the two columns sit side by side, 20 px apart.
 *   The panel is `width` wide and the list takes the rest; `wide: 'panel'`
 *   turns that around (Notes: a fixed list beside a wide editor).
 * - Below `lg` there is one column: the list, or the open record instead of
 *   it, so an address with a selection works at every width. Rows may also go
 *   to a page of their own there, which carries `<Breadcrumbs>`
 *   (`docs/contracts/navigation.md`).
 *
 * The page owns the selection and keeps it in the URL; `recordKey` tells the
 * layout which record that is. Opening one moves focus into the panel, Escape
 * closes it, and closing it returns focus to the row it was opened from. Arrow
 * up and down move between rows, in document order (also in a card grid).
 */
export interface ListDetailLayoutProps {
  /** Typically `<WashHeader />`. */
  header: ReactNode
  /** Main list column: toolbar, add form, sections, completed, empty state. */
  list: ReactNode
  panel?: ReactNode
  /** Names the panel for assistive technology. */
  panelLabel?: string
  /** The open record's id; absent while the panel shows its default content. */
  recordKey?: string
  /** Closes the open record: Escape. */
  onCloseRecord?: () => void
  /** Width of the fixed column, in pixels. */
  width?: number
  /** Which column takes the space left. */
  wide?: 'list' | 'panel'
  /** The page's `max-w-*` utility. Replaces the default: two would conflict. */
  maxWidth?: string
}

export function ListDetailLayout({
  header,
  list,
  panel,
  panelLabel,
  recordKey,
  onCloseRecord,
  width = 380,
  wide = 'list',
  maxWidth = 'max-w-6xl',
}: ListDetailLayoutProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const openKey = useRef(recordKey)

  useEffect(() => {
    if (openKey.current === recordKey) return
    openKey.current = recordKey
    const active = document.activeElement
    if (recordKey) {
      if (active instanceof HTMLElement && listRef.current?.contains(active))
        opener.current = active
      panelRef.current?.focus({ preventScroll: true })
      return
    }
    // Only focus the closing took away: not focus already somewhere else.
    if (
      active &&
      active !== document.body &&
      !panelRef.current?.contains(active)
    )
      return
    const row = opener.current?.isConnected ? opener.current : listRef.current
    opener.current = null
    row?.focus({ preventScroll: true })
  }, [recordKey])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    if (!recordKey || !onCloseRecord) return
    event.preventDefault()
    onCloseRecord()
  }

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return
    const step =
      event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    // A row's own target is its first link or button; its menu comes after.
    const rows = Array.from(event.currentTarget.querySelectorAll('li')).flatMap(
      (row) => row.querySelector<HTMLElement>('a[href], button') ?? [],
    )
    const at = rows.indexOf(event.target as HTMLElement)
    const next = at < 0 ? undefined : rows[at + step]
    if (!next) return
    event.preventDefault()
    next.focus()
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape bubbling from the list or the panel closes the open record; the controls themselves are inside
    <div
      className={`mx-auto grid ${maxWidth} grid-cols-[minmax(0,1fr)] gap-4`}
      onKeyDown={onKeyDown}
    >
      {header}
      <div
        data-layout="list-detail"
        style={{ '--fixed-column': `${width}px` } as CSSProperties}
        className={`grid grid-cols-[minmax(0,1fr)] items-start gap-5 ${
          !panel
            ? ''
            : wide === 'panel'
              ? 'lg:grid-cols-[var(--fixed-column)_minmax(0,1fr)]'
              : 'lg:grid-cols-[minmax(0,1fr)_var(--fixed-column)]'
        }`.trim()}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow keys move between the rows inside, which are the controls */}
        <div
          ref={listRef}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 outline-none ${
            panel && recordKey ? 'max-lg:hidden' : ''
          }`.trim()}
        >
          {list}
        </div>
        {panel ? (
          <aside
            ref={panelRef}
            tabIndex={-1}
            aria-label={panelLabel}
            className={`min-w-0 rounded-[var(--radius-card)] bg-[var(--surface)] outline-none lg:sticky lg:top-5 lg:max-h-[calc(100dvh-40px)] lg:overflow-y-auto ${
              recordKey ? '' : 'max-lg:hidden'
            }`.trim()}
          >
            {panel}
          </aside>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Toolbar above a Module's list: record switcher on the left, responsive
 * action buttons and overflow menu on the right.
 */
export function ModuleToolbar({
  leading,
  trailing,
}: {
  leading?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">{leading}</div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">{trailing}</div>
      ) : null}
    </div>
  )
}

/**
 * Header of a record shown inside the detail panel (or a nested detail page).
 * Includes a Close panel button when `onClose` is given.
 */
export function DetailPanelHeader({
  title,
  subtitle,
  level = 2,
  onClose,
}: {
  title: string
  /** 1 on a page of its own, whose only h1 this is; 2 in the panel. */
  level?: 1 | 2
  subtitle?: ReactNode
  onClose?: () => void
}) {
  const closePanel = useMessages().shell.modulePage.closePanel
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <Heading className="m-0 font-rounded text-title-2 font-bold break-words text-[var(--ink)]">
          {title}
        </Heading>
        {subtitle ? (
          <p className="m-0 mt-1 text-footnote text-[var(--muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={closePanel}
          title={closePanel}
          className="grid size-9 pointer-coarse:size-[var(--size-control-min)] shrink-0 place-items-center rounded-[var(--radius-pill)] bg-[var(--surface-2)] text-[var(--ink)] hover:opacity-80"
        >
          <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

export interface DetailPanelTab<T extends string = string> {
  id: T
  label: string
  icon?: ReactNode
  badge?: string
}

/**
 * Accessible tablist for a detail panel's default view (`role="tablist"` with
 * roving arrow-key navigation). Selection stays neutral (`surface-2`) per the
 * shared colour rule in `DESIGN_SYSTEM.md`.
 */
export function DetailPanelTabs<T extends string>({
  label,
  tabs,
  activeId,
  onSelect,
  panelId,
}: {
  label: string
  tabs: readonly DetailPanelTab<T>[]
  activeId: T
  onSelect: (id: T) => void
  panelId?: string
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === activeId)
    if (index < 0) return
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft')
      next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    if (next === null) return
    event.preventDefault()
    onSelect(tabs[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-1 border-b-[0.5px] border-[var(--hair)] p-2"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === activeId
        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[index] = node
            }}
            type="button"
            role="tab"
            id={`panel-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-subhead font-semibold transition-colors ${
              selected
                ? 'bg-[var(--surface-2)] text-[var(--ink)]'
                : 'bg-transparent text-[var(--muted)] hover:bg-[var(--surface-2)]/60 hover:text-[var(--ink)]'
            }`}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
            {tab.badge ? (
              <span className="shrink-0 text-footnote font-semibold text-[var(--accent-text)] tabular-nums">
                {tab.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Loading skeleton for a Module's list column: 22 px `surface` cards with
 * pulsing `surface-2` bars (`aria-busy="true"`).
 */
export function ListLoadingState({
  label,
  sections = 2,
}: {
  label: string
  sections?: number
}) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="grid gap-4"
      data-testid="list-loading"
    >
      {Array.from({ length: sections }, (_, sectionIndex) => (
        <div
          key={sectionIndex}
          className="grid gap-2"
        >
          <span className="mx-1 h-3.5 w-28 animate-pulse rounded-[var(--radius-pill)] bg-[var(--surface-2)] motion-reduce:animate-none" />
          <div className="rounded-[var(--radius-card)] bg-[var(--surface)] px-4">
            {[0, 1, 2].map((rowIndex) => (
              <div
                key={rowIndex}
                className="flex min-h-[var(--size-row-min)] items-center justify-between gap-3 py-3 [&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]"
              >
                <span className="h-4 w-44 animate-pulse rounded-[var(--radius-pill)] bg-[var(--surface-2)] motion-reduce:animate-none" />
                <span className="h-4 w-12 animate-pulse rounded-[var(--radius-pill)] bg-[var(--surface-2)] motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Recoverable error card (`role="alert"`) for a Module's list column.
 */
export function ListErrorState({
  title,
  body,
  onRetry,
}: {
  title: string
  body: string
  onRetry?: () => void
}) {
  const retry = useMessages().common.actions.retry
  return (
    <section
      role="alert"
      className="grid gap-3 rounded-[var(--radius-card)] bg-[var(--surface)] p-5 text-[var(--ink)]"
    >
      <h2 className="m-0 font-rounded text-title-2 font-bold">{title}</h2>
      <p className="m-0 text-subhead text-[var(--muted)]">{body}</p>
      {onRetry ? (
        <div>
          <button
            type="button"
            onClick={onRetry}
            className={buttonClass.primary}
          >
            {retry}
          </button>
        </div>
      ) : null}
    </section>
  )
}
