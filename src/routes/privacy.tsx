import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { PublicPageFrame } from '../components/app/PublicPageFrame'
import { useMessages } from '../lib/i18n'

/**
 * The privacy statement. Public on purpose: the phone's Settings, the App
 * Store and Google Play all link here, and Google Play's account-deletion rule
 * needs a page that explains deletion to somebody without the app — which is
 * what the `#delete-account` anchor is for.
 */
export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
})

export function PrivacyPage() {
  const { privacy: copy } = useMessages()
  const textSections = [copy.security, copy.children, copy.changes]

  return (
    <PublicPageFrame
      wide
      eyebrow={copy.updated}
      title={copy.title}
      subtitle={copy.intro.body.who}
    >
      <article className="grid gap-6 text-sm leading-6 text-[var(--app-muted)]">
        <p className="m-0">{copy.intro.body.contact}</p>
        <Section title={copy.collect.title}>
          <List items={copy.collect.items} />
        </Section>
        <Section title={copy.visibility.title}>
          <Paragraphs body={copy.visibility.body} />
        </Section>
        <Section title={copy.purposes.title}>
          <Paragraphs body={copy.purposes.body} />
        </Section>
        <Section title={copy.providers.title}>
          <p className="m-0">{copy.providers.intro}</p>
          <List items={copy.providers.items} />
          <p className="m-0">{copy.providers.integrations}</p>
          <p className="m-0">{copy.providers.openFoodFacts}</p>
          <p className="m-0">{copy.providers.recipeImport}</p>
          <p className="m-0">{copy.providers.transfers}</p>
        </Section>
        <Section title={copy.retention.title}>
          <Paragraphs body={copy.retention.body} />
        </Section>
        <Section id="delete-account" title={copy.deletion.title}>
          <Paragraphs body={copy.deletion.body} />
        </Section>
        <Section title={copy.rights.title}>
          <Paragraphs body={copy.rights.body} />
        </Section>
        {textSections.map(({ title, body }) => (
          <Section key={title} title={title}>
            <p className="m-0">{body}</p>
          </Section>
        ))}
      </article>
    </PublicPageFrame>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id?: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="grid scroll-mt-6 gap-2">
      <h2 className="m-0 text-base font-semibold text-[var(--app-fg)]">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Paragraphs({ body }: { body: Record<string, string> }) {
  return Object.entries(body).map(([key, text]) => (
    <p key={key} className="m-0">
      {text}
    </p>
  ))
}

function List({ items }: { items: Record<string, string> }) {
  return (
    <ul className="m-0 grid list-disc gap-1.5 pl-5">
      {Object.entries(items).map(([key, text]) => (
        <li key={key}>{text}</li>
      ))}
    </ul>
  )
}
