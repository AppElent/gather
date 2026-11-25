import { addDays } from '@gather/core/civil-date'
import { weekRange } from '@gather/core/week-menu'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { linkTo } from '../../lib/links'
import { buttonClass } from '../app/buttons'
import { ListDetailLayout, ListLoadingState } from '../app/ListDetailLayout'
import { WashHeader } from '../app/WashHeader'
import { useCloseOnEscape } from '../tasks/useCloseOnEscape'
import { type WeekSearch, weekLink, weekSummary } from './data'
import { MealPlannerWorkspace, useWorkspace } from './MealPlannerWorkspace'
import { RecordPanel } from './RecordPanels'
import { WeekGrid } from './WeekGrid'
import { joinSlots } from './words'

/** The week menu: the week's day cards, the proposal, and the open meal. */
export function MealPlannerPage({ search }: { search: WeekSearch }) {
  return (
    <MealPlannerWorkspace week={search.week}>
      <WeekBody search={search} />
    </MealPlannerWorkspace>
  )
}

function WeekBody({ search }: { search: WeekSearch }) {
  const { locale, messages: t } = useI18n()
  const words = t.mealPlanner
  const { week, from, data, open } = useWorkspace()
  const navigate = useNavigate()
  const selection = search.meal
    ? ({ kind: 'meal', id: search.meal } as const)
    : search.draft
      ? ({ kind: 'draft', id: search.draft } as const)
      : undefined
  const close = () =>
    void navigate({ ...weekLink(week), resetScroll: false })
  useCloseOnEscape(Boolean(selection), close)
  const summary = data ? weekSummary(data, from) : undefined

  return (
    <ListDetailLayout
      header={
        <WashHeader
          group="kitchen"
          icon="CalendarHeart"
          title={t.modules.byId['meal-planner'].label}
          summary={
            summary
              ? {
                  count: fmt(words.web.count, {
                    count: summary.planned,
                    total: summary.total,
                  }),
                  scope: joinSlots(summary.slots, words, locale) || undefined,
                }
              : undefined
          }
          settings={linkTo('mealPlannerSettings')}
          extra={
            <button
              type="button"
              aria-label={words.web.toGroceries}
              disabled={!data}
              onClick={() => open({ kind: 'groceries' })}
              className={`${buttonClass.onWash} max-lg:w-[var(--size-control-min)] max-lg:px-0`}
            >
              <ShoppingCart className="size-[18px]" aria-hidden="true" />
              <span className="hidden lg:inline">{words.web.toGroceries}</span>
            </button>
          }
          primary={{
            label: words.plan.open,
            onClick: () => open({ kind: 'plan' }),
            icon: <Sparkles className="size-[18px]" aria-hidden="true" />,
          }}
        />
      }
      list={
        <>
          <WeekBar />
          <ProposalBar />
          {data ? (
            <WeekGrid
              selectedId={selection?.id}
              panelOpen={Boolean(selection)}
            />
          ) : (
            <ListLoadingState label={words.web.loading} sections={3} />
          )}
        </>
      }
      panel={
        selection ? (
          <RecordPanel selection={selection} onClose={close} />
        ) : undefined
      }
      panelLabel={words.web.panel}
      recordKey={selection?.id}
      onCloseRecord={close}
    />
  )
}

function WeekBar() {
  const { locale, messages: t } = useI18n()
  const words = t.mealPlanner
  const { from, current } = useWorkspace()
  const range = weekRange(from, locale)
  const to = (monday: string) =>
    weekLink(monday === current ? undefined : monday)
  const round =
    'grid size-9 shrink-0 place-items-center rounded-[var(--radius-pill)] bg-[var(--surface)] text-[var(--ink)] no-underline pointer-coarse:size-[var(--size-control-min)]'
  return (
    <div className="flex items-center gap-2.5">
      <Link
        {...to(addDays(from, -7))}
        aria-label={words.previousWeek}
        className={round}
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </Link>
      <Link
        {...to(addDays(from, 7))}
        aria-label={words.nextWeek}
        className={round}
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </Link>
      <p
        aria-live="polite"
        aria-label={fmt(words.weekLabel, { range })}
        className="m-0 min-w-0 flex-1 text-body font-semibold"
      >
        {range}
      </p>
      {from === current ? null : (
        <Link
          {...weekLink(undefined)}
          className={`${buttonClass.small} pointer-coarse:min-h-[var(--size-control-min)]`}
        >
          {words.web.thisWeek}
        </Link>
      )}
    </div>
  )
}

/** Direction A: what is proposed and not saved yet, discard or accept it all. */
function ProposalBar() {
  const { locale, messages: t } = useI18n()
  const words = t.mealPlanner
  const { drafts, actions } = useWorkspace()
  if (!drafts || drafts.length === 0) return null
  const fallback = drafts.every((draft) => draft.source !== 'ai')
  const evenings = drafts.every((draft) => draft.slot === 'dinner')
  const Icon = fallback ? Clock : Sparkles
  return (
    <section
      data-testid="proposal-bar"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[18px] border-[1.5px] border-dashed border-[var(--kitchen-text)] bg-[var(--surface)] px-4 py-2.5"
    >
      <Icon
        className="size-5 shrink-0 text-[var(--kitchen-text)]"
        aria-hidden="true"
      />
      <p role="status" className="m-0 min-w-[180px] flex-1 text-subhead">
        <b>
          {plural(
            locale,
            drafts.length,
            evenings ? words.web.proposalEvenings : words.web.proposalMeals,
          )}
        </b>
        {' · '}
        {fallback ? words.web.proposalFallback : words.web.proposalBody}
      </p>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          disabled={actions.accepting}
          onClick={actions.discard}
          className="min-h-9 cursor-pointer border-0 bg-transparent px-3 text-subhead font-semibold text-[var(--muted)] pointer-coarse:min-h-[var(--size-control-min)]"
        >
          {words.proposal.discard}
        </button>
        <button
          type="button"
          disabled={actions.accepting}
          onClick={actions.acceptAll}
          className={`${buttonClass.primary} min-h-9 text-subhead pointer-coarse:min-h-[var(--size-control-min)]`}
        >
          {words.web.acceptAll}
        </button>
      </div>
    </section>
  )
}
