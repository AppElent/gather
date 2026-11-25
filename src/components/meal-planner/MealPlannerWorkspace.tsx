import { addDays } from '@gather/core/civil-date'
import type { MealSlot } from '@gather/core/meal-planner'
import { storedWishes } from '@gather/core/week-menu-plan'
import { useQuery } from 'convex/react'
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useMessages } from '../../lib/i18n'
import { useRequiredCurrentGroup } from '../app/useCurrentGroup'
import { type Draft, openDrafts, type WeekData, weekShown } from './data'
import { MealGroceriesDialog, WeekGroceriesDialog } from './GroceriesDialogs'
import { useMealPlannerNotices } from './MealPlannerNotices'
import { PickDialog } from './PickDialog'
import { PlanDialog } from './PlanDialog'
import { SwapDialog, type SwapTarget } from './SwapDialog'
import { useMealActions } from './useMealActions'

type OpenDialog =
  | {
      kind: 'pick'
      date: string
      slot: MealSlot
      replacing?: Id<'plannedDinners'>
    }
  | { kind: 'plan' }
  | ({ kind: 'swap' } & SwapTarget)
  | { kind: 'groceries' }
  | { kind: 'meal-groceries'; recipeId: Id<'recipes'>; servings: number }

interface Workspace {
  /** The week for a link to the week page: absent for the current one. */
  week: string | undefined
  from: string
  to: string
  today: string
  current: string
  data: WeekData | undefined
  /** Absent while loading. */
  drafts: Draft[] | undefined
  actions: ReturnType<typeof useMealActions>
  open: (dialog: OpenDialog) => void
  /** A dialog covers the page. */
  covered: boolean
}

const WorkspaceContext = createContext<Workspace | null>(null)

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) throw new Error('Meal planner workspace is missing')
  return workspace
}

/** The week's data and the dialogs, for the week page and a record's own page. */
export function MealPlannerWorkspace({
  week,
  children,
}: {
  week: string | undefined
  children: ReactNode
}) {
  const group = useRequiredCurrentGroup()
  // A Group switch starts over.
  return (
    <WorkspaceOf key={group.slug} week={week}>
      {children}
    </WorkspaceOf>
  )
}

function WorkspaceOf({
  week: asked,
  children,
}: {
  week: string | undefined
  children: ReactNode
}) {
  const group = useRequiredCurrentGroup()
  const words = useMessages().mealPlanner
  const { show } = useMealPlannerNotices()
  const { today, current, from, to } = weekShown(asked, group.timeZone)
  const week = from === current ? undefined : from
  const data = useQuery(api.mealPlan.week, { groupSlug: group.slug, from, to })
  const list = useQuery(api.mealPlanDrafts.list, {
    groupSlug: group.slug,
    weekStart: from,
  })
  const drafts = useMemo(
    () => (data && list ? openDrafts(data, list) : undefined),
    [data, list],
  )
  const actions = useMealActions(from)
  // A dialog belongs to its week: another week has none open.
  const [opened, setOpened] = useState<{
    from: string
    dialog: OpenDialog
  } | null>(null)
  const dialog = opened?.from === from ? opened.dialog : null
  const open = (next: OpenDialog) => setOpened({ from, dialog: next })
  const close = () => setOpened(null)

  return (
    <WorkspaceContext
      value={{ week, from, to, today, current, data, drafts, actions, open, covered: dialog !== null }}
    >
      {children}
      {data && dialog?.kind === 'pick' ? (
        <PickDialog
          date={dialog.date}
          slot={dialog.slot}
          replacing={dialog.replacing}
          week={data}
          onClose={close}
        />
      ) : null}
      {data && list && dialog?.kind === 'plan' ? (
        <PlanDialog
          weekStart={from}
          data={data}
          stored={storedWishes(list)}
          onClose={close}
          onPlanned={(outcome) => {
            close()
            if (outcome.status === 'empty') show({ message: words.plan.empty })
            // Nothing fitted: the open proposal, if any, stays as it was.
            else if (outcome.count === 0)
              show({ message: words.plan.nothingFits })
          }}
          onChooseYourself={(date, slot) => open({ kind: 'pick', date, slot })}
        />
      ) : null}
      {data && dialog?.kind === 'swap' ? (
        <SwapDialog
          {...dialog}
          data={data}
          onClose={close}
          onChooseYourself={(replacing) =>
            open({
              kind: 'pick',
              date: dialog.date,
              slot: dialog.slot,
              replacing,
            })
          }
        />
      ) : null}
      {data && dialog?.kind === 'groceries' ? (
        <WeekGroceriesDialog data={data} weekStart={from} onClose={close} />
      ) : null}
      {dialog?.kind === 'meal-groceries' ? (
        <MealGroceriesDialog
          recipeId={dialog.recipeId}
          servings={dialog.servings}
          onClose={close}
        />
      ) : null}
    </WorkspaceContext>
  )
}

/** The seven days of the week shown. */
export function useWeekDays(): string[] {
  const { from } = useWorkspace()
  return useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(from, index)),
    [from],
  )
}
