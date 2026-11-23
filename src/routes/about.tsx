import { createFileRoute } from '@tanstack/react-router'
import { PublicPageFrame } from '../components/app/PublicPageFrame'
import { useMessages } from '../lib/i18n'

/** The licence the grocery dictionary's Open Food Facts terms are under. */
const ODBL_URL = 'https://opendatacommons.org/licenses/odbl/1-0/'

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
      <div className="grid gap-3 text-sm leading-6 text-[var(--muted)]">
        <p className="m-0">{about.modules}</p>
        <p className="m-0">{about.pins}</p>
        <p className="m-0 text-xs">{about.trademarks}</p>
      </div>
      <section
        aria-labelledby="about-data-sources"
        className="mt-6 grid gap-2 text-xs leading-5 text-[var(--muted)]"
      >
        <h2
          id="about-data-sources"
          className="m-0 text-sm font-semibold text-[var(--ink)]"
        >
          {about.dataSources.title}
        </h2>
        <p className="m-0">
          {about.dataSources.openFoodFacts}{' '}
          <a
            href="https://world.openfoodfacts.org"
            className="underline"
            rel="noreferrer"
            target="_blank"
          >
            openfoodfacts.org
          </a>
          {' · '}
          <a
            href={ODBL_URL}
            className="underline"
            rel="noreferrer"
            target="_blank"
          >
            {about.dataSources.licence}
          </a>
        </p>
        <p className="m-0">{about.dataSources.nevo}</p>
      </section>
    </PublicPageFrame>
  )
}
