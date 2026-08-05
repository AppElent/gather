import { createFileRoute } from '@tanstack/react-router'
import { PublicPageFrame } from '../components/app/PublicPageFrame'
import { useMessages } from '../lib/i18n'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

export function AboutPage() {
  const { about } = useMessages().shell

  return (
    <PublicPageFrame
      eyebrow={about.eyebrow}
      title={about.title}
      subtitle={about.subtitle}
    >
      <div className="grid gap-3 text-sm leading-6 text-[var(--app-muted)]">
        <p className="m-0">{about.modules}</p>
        <p className="m-0">{about.pins}</p>
      </div>
    </PublicPageFrame>
  )
}
