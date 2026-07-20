import { createFileRoute } from '@tanstack/react-router'
import { PublicPageFrame } from '../components/app/PublicPageFrame'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

export function AboutPage() {
  return (
    <PublicPageFrame
      eyebrow="About Gather"
      title="A group command center for everyday coordination"
      subtitle="Gather keeps shared recipes, plans, lists, tasks, notes, and tasting logs in one compact workspace for the people who coordinate together."
    >
      <div className="grid gap-3 text-sm leading-6 text-[var(--app-muted)]">
        <p className="m-0">
          Recipes and Nutrition are live today, and the surrounding modules are
          staged so a group can grow into meal planning, groceries, pantry
          tracking, finances, bills, tasks, calendar, notes, cheeses, and wines
          without changing products.
        </p>
        <p className="m-0">
          The command center brings those modules together as a shared view of
          what is active, what is planned, and what needs attention next.
        </p>
      </div>
    </PublicPageFrame>
  )
}
