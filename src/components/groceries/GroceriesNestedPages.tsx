import {
  groceryListsOf,
  openGroceryList,
  recentWeeks,
} from '@gather/core/grocery-list'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import { plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { Breadcrumbs, type Crumb } from '../app/Breadcrumbs'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { WashHeader } from '../app/WashHeader'
import { GroceryItemEditor, GroceryItemNotice } from './GroceryItemEditor'
import { InStockPanel } from './InStockPanel'
import { readLastGroceryList } from './preferences'
import { RecentPanel } from './RecentPanel'
import { useGroceryItem } from './useGroceryItem'

/**
 * Nested `/groceries/recent` page (used below `lg` and directly linkable):
 * carries `<Breadcrumbs>` back to Groceries per `docs/contracts/navigation.md`.
 */
export function GroceriesRecentPage({ listId }: { listId?: string }) {
  const { slug: groupSlug, timeZone } = useRequiredCurrentGroup()
  const { locale, messages } = useI18n()
  const g = messages.tasks.grocery
  const allLists = useQuery(api.taskLists.list, { groupSlug })
  const recent = useQuery(api.tasks.recentGroceries, { groupSlug })

  const groceryLists = useMemo(
    () => groceryListsOf(allLists ?? []),
    [allLists],
  )
  const activeList = useMemo(
    () => openGroceryList(groceryLists, listId ?? readLastGroceryList(groupSlug)),
    [groceryLists, listId, groupSlug],
  )
  const tasks = useQuery(
    api.tasks.listByList,
    activeList && activeList.provider === 'local'
      ? { listId: activeList._id, groupSlug }
      : 'skip',
  )
  const openTitles = useMemo(
    () => (tasks ?? []).filter((task) => !task.done).map((task) => task.title),
    [tasks],
  )

  const trail: Crumb[] = [
    {
      label: messages.modules.byId.groceries.label,
      link: linkTo('groceries'),
    },
    { label: g.recent.title },
  ]

  const now = Date.now()
  return (
    <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <Breadcrumbs trail={trail} className="-mb-1" backInHeader />
      <WashHeader
        group="kitchen"
        icon="Clock"
        title={g.recent.title}
        back={{
          label: messages.modules.byId.groceries.label,
          link: linkTo('groceries'),
        }}
        summary={
          recent
            ? {
                count: plural(locale, recent.length, g.recent.count),
                scope:
                  recent.length > 0
                    ? plural(locale, recentWeeks(recent, now), g.recent.weeks)
                    : undefined,
              }
            : undefined
        }
      />
      <RecentPanel
        groupSlug={groupSlug}
        timeZone={timeZone}
        listId={activeList?.writable ? activeList._id : undefined}
        openTitles={openTitles}
        mode="page"
      />
    </div>
  )
}

/**
 * Nested `/groceries/in-stock` page (used below `lg` and directly linkable):
 * carries `<Breadcrumbs>` back to Groceries per `docs/contracts/navigation.md`.
 */
export function GroceriesInStockPage() {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const { locale, messages } = useI18n()
  const g = messages.tasks.grocery
  const data = useQuery(api.groceryStaples.list, { groupSlug })

  const staples = data?.staples ?? []
  const lowCount = staples.filter((staple) => staple.low).length

  const trail: Crumb[] = [
    {
      label: messages.modules.byId.groceries.label,
      link: linkTo('groceries'),
    },
    { label: g.inStock.title },
  ]

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <Breadcrumbs trail={trail} className="-mb-1" backInHeader />
      <WashHeader
        group="kitchen"
        icon="Home"
        title={g.inStock.title}
        back={{
          label: messages.modules.byId.groceries.label,
          link: linkTo('groceries'),
        }}
        summary={
          data
            ? {
                count: plural(locale, lowCount, g.inStock.running),
                scope: plural(locale, staples.length, g.inStock.staples),
              }
            : undefined
        }
      />
      <InStockPanel groupSlug={groupSlug} mode="page" />
    </div>
  )
}

/**
 * Nested `/groceries/item/$itemId` page (where a row goes below `lg`, and
 * linkable): the item editor with `<Breadcrumbs>` back to Groceries.
 */
export function GroceriesItemPage({ itemId }: { itemId: string }) {
  const { slug: groupSlug } = useRequiredCurrentGroup()
  const { messages } = useI18n()
  const navigate = useNavigate()

  const allLists = useQuery(api.taskLists.list, { groupSlug })
  const groceryLists = useMemo(
    () => (allLists ? groceryListsOf(allLists) : undefined),
    [allLists],
  )
  const item = useGroceryItem(groupSlug, itemId, groceryLists)

  const trail: Crumb[] = [
    {
      label: messages.modules.byId.groceries.label,
      link: linkTo('groceries'),
    },
    {
      label:
        item.status === 'ready'
          ? item.task.title
          : messages.tasks.grocery.web.itemTitle,
    },
  ]

  return (
    <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-4">
      <Breadcrumbs trail={trail} className="-mb-1" />
      <div className="rounded-[var(--radius-card)] bg-[var(--surface)]">
        {item.status === 'ready' ? (
          <GroceryItemEditor
            key={itemId}
            groupSlug={groupSlug}
            task={item.task}
            lists={groceryLists ?? []}
            onDone={() => void navigate(linkTo('groceries'))}
          />
        ) : (
          <GroceryItemNotice
            loading={item.status === 'loading'}
            deleted={item.status === 'missing' && item.deleted}
          />
        )}
      </div>
    </div>
  )
}
