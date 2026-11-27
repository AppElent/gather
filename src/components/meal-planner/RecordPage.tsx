import { useI18n } from '../../lib/i18n'
import { Breadcrumbs } from '../app/Breadcrumbs'
import { weekLink } from './data'
import { MealPlannerWorkspace, useWorkspace } from './MealPlannerWorkspace'
import { RecordPanel } from './RecordPanels'

interface RecordPageProps {
  kind: 'meal' | 'draft'
  id: string
  week: string | undefined
}

/** A meal or a proposal on a page of its own: where a row goes below `lg`. */
export function RecordPage(props: RecordPageProps) {
  return (
    <MealPlannerWorkspace week={props.week}>
      <RecordPageBody {...props} />
    </MealPlannerWorkspace>
  )
}

function RecordPageBody({ kind, id }: RecordPageProps) {
  const { messages: t } = useI18n()
  const { week, data, drafts } = useWorkspace()
  const title =
    (kind === 'meal' ? data?.meals : drafts)?.find((each) => each._id === id)
      ?.title ?? t.mealPlanner.web.panel
  return (
    <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-4">
      <Breadcrumbs
        trail={[
          {
            label: t.modules.byId['meal-planner'].label,
            link: weekLink(week),
          },
          { label: title },
        ]}
        className="-mb-1"
      />
      <div className="rounded-[var(--radius-card)] bg-[var(--surface)]">
        <RecordPanel selection={{ kind, id }} page />
      </div>
    </div>
  )
}
