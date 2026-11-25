import {
  formatGroceryAmount,
  isDefaultAisleOrder,
} from '@gather/core/groceries'
import {
  aisleSections,
  checkedOncePerName,
  groceryListsOf,
  inCheckedSection,
  openGroceryList,
} from '@gather/core/grocery-list'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowDownUp,
  ArrowRightLeft,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  Home,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { useErrorMessage } from '../../lib/errorMessage'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { buttonClass } from '../app/buttons'
import { CompletedSection } from '../app/CompletedSection'
import { useConfirmAction } from '../app/ConfirmAction'
import { EmptyState } from '../app/EmptyState'
import { InsetList, InsetRow, SectionLabel } from '../app/InsetList'
import {
  DetailPanelTabs,
  ListDetailLayout,
  ListLoadingState,
  ModuleToolbar,
} from '../app/ListDetailLayout'
import { ModuleTile } from '../app/ModuleTile'
import { RowMenu } from '../app/RowMenu'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { useIsDesktop } from '../app/useMediaQuery'
import { useMenu } from '../app/useMenu'
import { WashHeader } from '../app/WashHeader'
import { FromRecipeDialog } from './AddToGroceriesDialog'
import { GroceryAddForm } from './GroceryAddForm'
import {
  AisleOrderDialog,
  MoveToListDialog,
  NewGroceryListDialog,
} from './GroceryDialogs'
import { GroceryItemEditor, GroceryItemNotice } from './GroceryItemEditor'
import { InStockPanel } from './InStockPanel'
import { readLastGroceryList, writeLastGroceryList } from './preferences'
import { RecentPanel } from './RecentPanel'
import { SuggestionStrip } from './SuggestionStrip'
import { useGroceryItem } from './useGroceryItem'
import { useHourClock } from './useHourClock'

export type GroceriesPanelTab = 'recent' | 'stock'

export interface GroceriesPageProps {
  selectedItemId?: string
  selectedListId?: string
  /** The panel's tab while no item is open. */
  tab?: GroceriesPanelTab
}

/**
 * Groceries on the web (APP-316) built on the shared list-and-detail layout
 * (APP-300): store list switcher, inline add with live amount/aisle
 * recognition and autocomplete, Maybe needed strip, aisle sections in custom
 * store order, Checked with Put back / Clear checked, and the 340 px right
 * panel (Recent, In stock, or selected item editor via `?item=<id>`).
 */
export function GroceriesPage({
  selectedItemId,
  selectedListId,
  tab = 'recent',
}: GroceriesPageProps) {
  const group = useRequiredCurrentGroup()
  const groupSlug = group.slug
  const { locale, messages } = useI18n()
  const g = messages.tasks.grocery
  const moduleName = messages.modules.byId.groceries.label
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const { confirm, dialog: confirmDialog } = useConfirmAction()
  const errorText = useErrorMessage()

  const allLists = useQuery(api.taskLists.list, { groupSlug })
  const openCounts = useQuery(api.tasks.openCounts, { groupSlug })
  const staples = useQuery(api.groceryStaples.list, { groupSlug })

  const toggleDone = useMutation(api.tasks.toggleDone)
  const putBack = useMutation(api.tasks.putBack)
  const removeTask = useMutation(api.tasks.remove)
  const clearChecked = useMutation(api.taskLists.clearCheckedUndoable)
  const restoreCleared = useMutation(api.taskLists.restoreCheckedCleared)
  const setSuggestions = useMutation(api.taskLists.setSuggestions)

  const groceryLists = useMemo(
    () => groceryListsOf(allLists ?? []),
    [allLists],
  )
  const item = useGroceryItem(
    groupSlug,
    selectedItemId,
    allLists ? groceryLists : undefined,
  )
  // An address that names an item and no list opens on the item's own list.
  const itemListId = item.status === 'ready' ? item.task.listId : undefined
  const activeList = openGroceryList(
    groceryLists,
    selectedListId ?? itemListId ?? readLastGroceryList(groupSlug),
  )

  useEffect(() => {
    if (activeList) writeLastGroceryList(groupSlug, activeList._id)
  }, [groupSlug, activeList])

  const activeListId = activeList?._id
  const tasks = useQuery(
    api.tasks.listByList,
    activeListId && activeList.provider === 'local'
      ? { listId: activeListId, groupSlug }
      : 'skip',
  )

  const hour = useHourClock()
  const habitsData = useQuery(
    api.tasks.groceryHabits,
    activeListId && activeList.provider === 'local'
      ? { groupSlug, listId: activeListId, now: hour }
      : 'skip',
  )

  const listMenu = useMenu()
  const [aislesOpen, setAislesOpen] = useState(false)
  const [newListOpen, setNewListOpen] = useState(false)
  const [fromRecipeOpen, setFromRecipeOpen] = useState(false)
  const [movingTask, setMovingTask] = useState<Doc<'tasks'> | null>(null)
  const [statusNotice, setStatusNotice] = useState<{
    message: string
    undo?: () => void
  } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const tabPanelId = useId()

  useEffect(() => {
    if (!statusNotice) return
    const timer = setTimeout(() => setStatusNotice(null), 8000)
    return () => clearTimeout(timer)
  }, [statusNotice])

  const openCountByList = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of openCounts ?? []) map.set(row.listId, row.open)
    return map
  }, [openCounts])

  const openTasks = useMemo(
    () => (tasks ?? []).filter((task) => !task.done),
    [tasks],
  )
  const checkedTasks = useMemo(() => {
    if (!tasks || !activeList) return []
    return checkedOncePerName(
      tasks,
      tasks.filter((task) => inCheckedSection(task, activeList.checkedClearedAt)),
    )
  }, [tasks, activeList])

  const sections = useMemo(
    () => aisleSections(openTasks, activeList?.aisleOrder),
    [openTasks, activeList?.aisleOrder],
  )

  const lowCount = useMemo(
    () => (staples?.staples ?? []).filter((staple) => staple.low).length,
    [staples],
  )

  const writableLists = useMemo(
    () => groceryLists.filter((list) => list.writable),
    [groceryLists],
  )

  const show = (
    to: { list?: string; item?: string; tab?: GroceriesPanelTab },
    replace = false,
  ) =>
    void navigate({
      ...linkTo('groceries'),
      search: {
        ...((to.list ?? activeListId) ? { list: to.list ?? activeListId } : {}),
        ...(to.item ? { item: to.item } : {}),
        ...((to.tab ?? tab) === 'stock' ? { tab: 'stock' as const } : {}),
      },
      replace,
    })

  const closeItem = () => show({})

  const selectItem = (task: Doc<'tasks'>) => {
    if (!isDesktop) {
      void navigate(linkTo('groceriesItem', { itemId: task._id }))
      return
    }
    if (selectedItemId !== task._id) show({ item: task._id })
  }

  const switchList = (listId: Id<'taskLists'>) => show({ list: listId }, true)

  const handleClearChecked = () => {
    if (!activeList || checkedTasks.length === 0) return
    const count = checkedTasks.length
    confirm({
      title: g.web.clearCheckedTitle,
      body: g.web.clearCheckedBody,
      confirmLabel: g.clearChecked,
      run: async () => {
        const result = await clearChecked({
          listId: activeList._id,
          groupSlug,
        })
        setStatusNotice({
          message: plural(locale, count, g.cleared),
          undo: () => {
            void restoreCleared({
              listId: activeList._id,
              groupSlug,
              checkedClearedAt: result.previous,
              clearedAt: result.clearedAt,
            }).catch((caught) => {
              setActionError(errorText(caught, g.undoSuperseded))
            })
          },
        })
      },
    })
  }

  const handleToggleSuggestions = async () => {
    if (!activeList) return
    const nextOn = activeList.suggestionsOff
    try {
      await setSuggestions({
        listId: activeList._id,
        groupSlug,
        on: nextOn,
      })
      setStatusNotice({
        message: nextOn ? g.suggestions.on : g.suggestions.off,
      })
    } catch (caught) {
      setActionError(errorText(caught, messages.common.errors.didNotWork))
    }
  }

  const confirmDeleteItem = (task: Doc<'tasks'>) =>
    confirm({
      title: fmt(g.web.deleteConfirmTitle, { name: task.title }),
      body: g.web.deleteConfirmBody,
      confirmLabel: messages.common.actions.delete,
      run: async () => {
        await removeTask({ taskId: task._id, groupSlug })
        if (selectedItemId === task._id) closeItem()
      },
    })

  const showUndoable = useCallback((message: string, undo: () => void) => {
    setStatusNotice({ message, undo })
  }, [])

  const openTitles = useMemo(
    () => openTasks.map((task) => task.title),
    [openTasks],
  )

  const loadingLists = allLists === undefined
  const loadingTasks =
    Boolean(activeList && activeList.provider === 'local') && tasks === undefined

  const header = (
    <WashHeader
      group="kitchen"
      icon="ShoppingCart"
      title={moduleName}
      summary={
        activeList && !loadingTasks
          ? {
              count: fmt(
                plural(locale, openTasks.length, g.web.summaryItemsOn),
                { list: activeList.name },
              ),
              scope: g.web.summaryScope,
            }
          : undefined
      }
      // The list on screen, as the phone's gear passes it.
      settings={
        loadingLists
          ? linkTo('groceriesSettings')
          : activeList && {
              ...linkTo('groceriesSettings'),
              search: { list: activeList._id },
            }
      }
    />
  )

  const panelContent = !selectedItemId ? null : item.status !== 'ready' ? (
    <GroceryItemNotice
      loading={item.status === 'loading'}
      deleted={item.status === 'missing' && item.deleted}
      onClose={closeItem}
    />
  ) : (
    <GroceryItemEditor
      key={selectedItemId}
      groupSlug={groupSlug}
      task={item.task}
      lists={groceryLists}
      onClose={closeItem}
      onDone={closeItem}
    />
  )
  const panelDefault = (
    <div>
      <DetailPanelTabs
        label={g.web.panelTabsLabel}
        panelId={tabPanelId}
        activeId={tab}
        onSelect={(next) => show({ tab: next }, true)}
        tabs={[
          {
            id: 'recent',
            label: g.recent.title,
            icon: <Clock className="size-4" aria-hidden="true" />,
          },
          {
            id: 'stock',
            label: g.inStock.title,
            icon: <Home className="size-4" aria-hidden="true" />,
            badge:
              lowCount > 0
                ? plural(locale, lowCount, g.inStock.running)
                : undefined,
          },
        ]}
      />
      <div
        id={tabPanelId}
        role="tabpanel"
        aria-labelledby={`panel-tab-${tab}`}
      >
        {tab === 'recent' ? (
          <RecentPanel
            groupSlug={groupSlug}
            timeZone={group.timeZone}
            listId={activeList?.writable ? activeList._id : undefined}
            openTitles={openTitles}
            mode="panel"
          />
        ) : (
          <InStockPanel groupSlug={groupSlug} mode="panel" />
        )}
      </div>
    </div>
  )

  const listColumn = loadingLists ? (
    <ListLoadingState label={messages.common.errors.loading} />
  ) : !activeList ? (
    <EmptyState
      kind="nothing-yet"
      tile={{ group: 'kitchen', icon: 'ShoppingCart' }}
      title={g.web.noListTitle}
      body={g.web.noListBody}
      action={{
        label: g.lists.newList,
        onClick: () => setNewListOpen(true),
      }}
    />
  ) : (
    <>
      <ModuleToolbar
        leading={
          <div className="relative min-w-0">
            <button
              {...listMenu.button}
              aria-label={fmt(g.lists.switchLabel, { list: activeList.name })}
              className="inline-flex min-h-[var(--size-control-min)] max-w-full items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface)] pr-3.5 pl-2.5 text-subhead font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]"
            >
              <ModuleTile group="kitchen" icon="Store" size="xs" />
              <span className="min-w-0 max-w-[18ch] truncate">{activeList.name}</span>
              <ChevronDown
                className="size-4 shrink-0 text-[var(--muted)]"
                aria-hidden="true"
              />
            </button>

            {listMenu.open ? (
              <div
                {...listMenu.menu}
                aria-label={g.lists.title}
                className="absolute top-full left-0 z-30 mt-1.5 grid w-[min(320px,calc(100vw-24px))] gap-1 rounded-[var(--radius-card)] border border-[var(--hair)] bg-[var(--surface)] p-2 shadow-lg"
              >
                <p className="m-0 px-2.5 pt-1 pb-1 text-footnote font-semibold text-[var(--muted)]">
                  {g.lists.title}
                </p>
                {groceryLists.map((candidate) => {
                  const isCurrent = candidate._id === activeList._id
                  const count = openCountByList.get(candidate._id)
                  const subtitle = isDefaultAisleOrder(candidate.aisleOrder)
                    ? g.lists.defaultOrder
                    : g.lists.customOrder
                  return (
                    <button
                      key={candidate._id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isCurrent}
                      onClick={() => {
                        listMenu.close()
                        switchList(candidate._id)
                      }}
                      className={`flex min-h-12 items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-1.5 text-left ${
                        isCurrent
                          ? 'bg-[var(--surface-2)]'
                          : 'hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      <ModuleTile group="kitchen" icon="Store" size="s" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-semibold text-[var(--ink)]">
                          {candidate.name}
                        </span>
                        <span className="block truncate text-footnote text-[var(--muted)]">
                          {subtitle}
                        </span>
                      </span>
                      {count !== undefined ? (
                        <span className="text-subhead text-[var(--muted)] tabular-nums">
                          {count}
                        </span>
                      ) : null}
                      <span className="grid size-5 shrink-0 place-items-center text-[var(--accent-text)]">
                        {isCurrent ? (
                          <Check
                            className="size-4"
                            strokeWidth={2.6}
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                    </button>
                  )
                })}

                <div className="my-1 border-t-[0.5px] border-[var(--hair)]" />

                {activeList.writable ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      listMenu.close()
                      setAislesOpen(true)
                    }}
                    className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-left text-subhead font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]"
                  >
                    <ArrowDownUp
                      className="size-4 text-[var(--muted)]"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {fmt(g.lists.aisleOrderOf, { list: activeList.name })}
                    </span>
                  </button>
                ) : null}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    listMenu.close()
                    setNewListOpen(true)
                  }}
                  className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-left text-subhead font-semibold text-[var(--accent-text)] hover:bg-[var(--surface-2)]"
                >
                  <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
                  <span>{g.lists.newList}</span>
                </button>

                <p className="m-0 px-2.5 pt-1 pb-1 text-footnote text-[var(--muted)]">
                  {g.lists.footnote}
                </p>
              </div>
            ) : null}
          </div>
        }
        trailing={
          <>
            {activeList.writable ? (
              <button
                type="button"
                aria-label={g.web.fromRecipe}
                title={g.web.fromRecipe}
                onClick={() => setFromRecipeOpen(true)}
                className={`${buttonClass.onWash} max-lg:w-[var(--size-control-min)] max-lg:px-0`}
              >
                <BookOpen className="size-[18px]" aria-hidden="true" />
                <span className="hidden text-subhead lg:inline">
                  {g.web.fromRecipe}
                </span>
              </button>
            ) : null}

            <Link
              {...linkTo('groceriesRecent')}
              search={{ list: activeList._id }}
              aria-label={g.recent.title}
              title={g.recent.title}
              className={`${buttonClass.round} lg:hidden`}
            >
              <Clock className="size-[18px]" aria-hidden="true" />
            </Link>

            <Link
              {...linkTo('groceriesInStock')}
              aria-label={g.inStock.title}
              title={g.inStock.title}
              className={`${buttonClass.round} relative lg:hidden`}
            >
              <Home className="size-[18px]" aria-hidden="true" />
              {lowCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[var(--accent)]"
                />
              ) : null}
            </Link>

            {activeList.writable ? (
              <span className="grid size-[var(--size-control-min)] place-items-center rounded-[var(--radius-pill)] bg-[var(--surface)]">
                <RowMenu
                  item={activeList.name}
                  alwaysVisible
                  actions={[
                    {
                      id: 'aisles',
                      label: g.aisleOrder.menu,
                      icon: (
                        <ArrowDownUp className="size-4" aria-hidden="true" />
                      ),
                      onSelect: () => setAislesOpen(true),
                    },
                    ...(checkedTasks.length > 0
                      ? [
                          {
                            id: 'clear',
                            label: g.clearChecked,
                            icon: (
                              <Check className="size-4" aria-hidden="true" />
                            ),
                            onSelect: handleClearChecked,
                          },
                        ]
                      : []),
                    {
                      id: 'suggestions',
                      label: activeList.suggestionsOff
                        ? g.suggestions.turnOn
                        : g.suggestions.turnOff,
                      icon: activeList.suggestionsOff ? (
                        <Eye className="size-4" aria-hidden="true" />
                      ) : (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ),
                      onSelect: () => void handleToggleSuggestions(),
                    },
                  ]}
                />
              </span>
            ) : null}
          </>
        }
      />

      {activeList.writable ? (
        <GroceryAddForm
          groupSlug={groupSlug}
          listId={activeList._id}
          tasks={tasks ?? []}
          habits={habitsData?.habits ?? []}
        />
      ) : (
        <p className="m-0 rounded-[var(--radius-card)] bg-[var(--surface)] px-4 py-3 text-subhead text-[var(--muted)]">
          {g.web.readOnlyList}
        </p>
      )}

      {actionError ? (
        <p
          role="alert"
          className="m-0 rounded-[var(--radius-control)] bg-[var(--surface)] px-4 py-3 text-subhead font-semibold text-[var(--danger)]"
        >
          {actionError}
        </p>
      ) : null}

      {statusNotice ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-card)] bg-[var(--surface)] px-4 py-2.5 text-subhead text-[var(--ink)]"
        >
          <span>{statusNotice.message}</span>
          {statusNotice.undo ? (
            <button
              type="button"
              onClick={() => {
                const undo = statusNotice.undo
                setStatusNotice(null)
                undo?.()
              }}
              className={buttonClass.small}
            >
              {g.undo}
            </button>
          ) : null}
        </div>
      ) : null}

      <SuggestionStrip
        groupSlug={groupSlug}
        listId={activeList._id}
        writable={activeList.writable}
        suggestionsOff={activeList.suggestionsOff}
        suggestions={habitsData?.suggestions ?? []}
        onUndoable={showUndoable}
      />

      {loadingTasks ? (
        <ListLoadingState label={messages.common.errors.loading} />
      ) : openTasks.length === 0 && checkedTasks.length === 0 ? (
        <EmptyState
          kind="nothing-yet"
          tile={{ group: 'kitchen', icon: 'ShoppingCart' }}
          title={fmt(g.web.emptyTitle, { list: activeList.name })}
          body={g.web.emptyBody}
          action={
            activeList.writable
              ? {
                  label: g.web.fromRecipe,
                  onClick: () => setFromRecipeOpen(true),
                }
              : undefined
          }
        />
      ) : (
        <>
          {sections.map(({ aisle, tasks: rows }) => (
            <section
              key={aisle}
              aria-labelledby={`aisle-heading-${aisle}`}
              data-testid={`aisle-${aisle}`}
            >
              <SectionLabel
                id={`aisle-heading-${aisle}`}
                action={
                  <span className="text-footnote text-[var(--muted)] tabular-nums">
                    {rows.length}
                  </span>
                }
              >
                {g.aisles[aisle]}
              </SectionLabel>
              <InsetList>
                {rows.map((row) => {
                  const amount = formatGroceryAmount(
                    row.quantity,
                    row.unit,
                    locale,
                    g.units,
                  )
                  const isSelected = isDesktop && selectedItemId === row._id
                  return (
                    <InsetRow
                      key={row._id}
                      title={
                        <span className="font-semibold text-[var(--ink)]">
                          {row.title}
                        </span>
                      }
                      footnote={
                        row.notes ? (
                          <span className="inline-flex items-center gap-1">
                            <BookOpen
                              className="size-3 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{row.notes}</span>
                          </span>
                        ) : undefined
                      }
                      selected={isSelected}
                      chevron={false}
                      onClick={() => selectItem(row)}
                      accessibleName={[row.title, amount]
                        .filter(Boolean)
                        .join(', ')}
                      leading={
                        <label className="relative z-[1] -my-2 -ml-3 -mr-3 grid size-[var(--size-control-min)] cursor-pointer place-items-center">
                          <input
                            type="checkbox"
                            checked={row.done}
                            disabled={!activeList.writable}
                            aria-label={fmt(g.web.checkItem, {
                              name: row.title,
                            })}
                            onChange={() => {
                              setActionError(null)
                              void toggleDone({
                                taskId: row._id,
                                groupSlug,
                              }).catch((caught) =>
                                setActionError(
                                  errorText(
                                    caught,
                                    messages.common.errors.didNotWork,
                                  ),
                                ),
                              )
                            }}
                            className="size-5 cursor-pointer accent-[var(--accent-text)]"
                          />
                        </label>
                      }
                      trailing={
                        amount ? (
                          <span className="font-bold text-[var(--ink)] tabular-nums">
                            {amount}
                          </span>
                        ) : undefined
                      }
                      menu={
                        activeList.writable && isDesktop ? (
                          <RowMenu
                            item={row.title}
                            actions={[
                              {
                                id: 'edit',
                                label: messages.common.actions.edit,
                                icon: (
                                  <Pencil
                                    className="size-4"
                                    aria-hidden="true"
                                  />
                                ),
                                onSelect: () => selectItem(row),
                              },
                              ...(writableLists.length > 1
                                ? [
                                    {
                                      id: 'move',
                                      label: g.web.moveToList,
                                      icon: (
                                        <ArrowRightLeft
                                          className="size-4"
                                          aria-hidden="true"
                                        />
                                      ),
                                      onSelect: () => setMovingTask(row),
                                    },
                                  ]
                                : []),
                              {
                                id: 'delete',
                                label: messages.common.actions.delete,
                                danger: true,
                                icon: (
                                  <Trash2
                                    className="size-4"
                                    aria-hidden="true"
                                  />
                                ),
                                onSelect: () => confirmDeleteItem(row),
                              },
                            ]}
                          />
                        ) : undefined
                      }
                    />
                  )
                })}
              </InsetList>
            </section>
          ))}

          <CompletedSection count={checkedTasks.length}>
            <div className="grid gap-2">
              {activeList.writable ? (
                <div className="flex justify-end px-1">
                  <button
                    type="button"
                    onClick={handleClearChecked}
                    className="pointer-coarse:min-h-[var(--size-control-min)] text-footnote font-semibold text-[var(--accent-text)] hover:underline"
                  >
                    {g.clearChecked}
                  </button>
                </div>
              ) : null}
              <InsetList label={g.checked}>
                {checkedTasks.map((row) => (
                  <InsetRow
                    key={row._id}
                    title={
                      <span className="text-[var(--muted)] line-through">
                        {row.title}
                      </span>
                    }
                    controls={
                      activeList.writable ? (
                        <button
                          type="button"
                          aria-label={fmt(g.web.uncheckItem, {
                            name: row.title,
                          })}
                          onClick={() => {
                            setActionError(null)
                            void putBack({
                              taskId: row._id,
                              groupSlug,
                              listId: activeList._id,
                            }).catch((caught) =>
                              setActionError(
                                errorText(
                                  caught,
                                  messages.common.errors.didNotWork,
                                ),
                              ),
                            )
                          }}
                          className={`${buttonClass.small} pointer-coarse:min-h-[var(--size-control-min)] text-[var(--accent-text)]`}
                        >
                          <RotateCcw className="size-3.5" aria-hidden="true" />
                          <span>{g.web.putBackItem}</span>
                        </button>
                      ) : undefined
                    }
                  />
                ))}
              </InsetList>
            </div>
          </CompletedSection>

          {activeList.writable ? (
            <InsetList>
              <InsetRow
                title={
                  <span className="font-semibold text-[var(--ink)]">
                    {g.web.fromRecipe}
                  </span>
                }
                footnote={g.web.fromRecipeSub}
                leading={
                  <BookOpen
                    className="size-5 text-[var(--accent-text)]"
                    aria-hidden="true"
                  />
                }
                chevron
                onClick={() => setFromRecipeOpen(true)}
              />
            </InsetList>
          ) : null}
        </>
      )}
    </>
  )

  return (
    <>
      <ListDetailLayout
        header={header}
        list={listColumn}
        panel={activeList ? (panelContent ?? panelDefault) : undefined}
        recordKey={activeList ? selectedItemId : undefined}
        onCloseRecord={closeItem}
        width={340}
        panelLabel={selectedItemId ? g.web.itemTitle : g.web.panelLabel}
      />

      {aislesOpen && activeList ? (
        <AisleOrderDialog
          groupSlug={groupSlug}
          listId={activeList._id}
          listName={activeList.name}
          savedOrder={activeList.aisleOrder}
          tasks={tasks ?? []}
          onClose={() => setAislesOpen(false)}
        />
      ) : null}

      {newListOpen ? (
        <NewGroceryListDialog
          groupSlug={groupSlug}
          onCreated={(listId) => switchList(listId)}
          onClose={() => setNewListOpen(false)}
        />
      ) : null}

      {fromRecipeOpen && activeList ? (
        <FromRecipeDialog
          preferredListId={activeList._id}
          onAdded={(listName) =>
            setStatusNotice({
              message: fmt(g.web.addedFromRecipe, { list: listName }),
            })
          }
          onClose={() => setFromRecipeOpen(false)}
        />
      ) : null}

      {movingTask ? (
        <MoveToListDialog
          groupSlug={groupSlug}
          task={movingTask}
          lists={groceryLists}
          onMoved={() => {
            if (selectedItemId === movingTask._id) closeItem()
          }}
          onClose={() => setMovingTask(null)}
        />
      ) : null}

      {confirmDialog}
    </>
  )
}
