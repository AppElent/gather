import { createFileRoute } from '@tanstack/react-router'
import { PublicPageFrame } from '../components/app/PublicPageFrame'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

export function AboutPage() {
  return (
    <PublicPageFrame
      eyebrow="About Gather"
      title="One shared group for everyday coordination"
      subtitle="Gather keeps shared recipes, plans, lists, tasks, notes, and tasting logs in one place, for the people who share a household."
    >
      <div className="grid gap-3 text-sm leading-6 text-[var(--app-muted)]">
        <p className="m-0">
          Recipes and Nutrition are live today, and the surrounding modules are
          staged so a group can grow into meal planning, groceries, pantry
          tracking, finances, bills, tasks, calendar, notes, cheeses, and wines
          without changing products.
        </p>
        <p className="m-0">
          Every module is available in every group. You pin the ones you use to
          your own navigation, and the rest stay one click away — your choices
          are yours alone and never move anybody else's.
        </p>
      </div>
    </PublicPageFrame>
  )
}
