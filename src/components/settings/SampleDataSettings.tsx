import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { SAMPLE_GROUP_NAME } from '../../../convex/lib/seed/sampleHousehold'
import { errorMessage } from '../../lib/errorMessage'
import { fmt, plural, useI18n } from '../../lib/i18n'
import { SurfaceCard } from '../app/ShellPrimitives'

const buttonClass =
  'inline-flex min-h-9 items-center rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'

/**
 * Whether this build may offer the sample-data controls.
 *
 * Build-time rather than runtime: Vite inlines `VITE_*`, so a production
 * build that never sets it cannot render this panel at all. The Worker's
 * `environment_name` var would be the more natural signal but is server-side
 * only and never reaches the client bundle.
 *
 * This only hides the UI. The mutations behind it enforce their own guard
 * (`ENABLE_SAMPLE_DATA` on the Convex deployment), because a public mutation
 * is callable regardless of what the client renders.
 */
const SAMPLE_DATA_ENABLED =
  import.meta.env.VITE_ENABLE_SAMPLE_DATA === 'true' || import.meta.env.DEV

type Busy = 'load' | 'reset' | null

export function SampleDataSettings() {
  const loadSampleData = useMutation(api.seed.loadSampleData)
  const resetSampleData = useMutation(api.seed.resetSampleData)
  const [busy, setBusy] = useState<Busy>(null)
  const { locale, messages } = useI18n()
  const { sampleData } = messages.settings
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  if (!SAMPLE_DATA_ENABLED) return null

  async function run(kind: Exclude<Busy, null>) {
    setBusy(kind)
    setError(null)
    setResult(null)
    try {
      if (kind === 'load') {
        const out = await loadSampleData({})
        setResult(
          fmt(sampleData.loaded, {
            recipes: out.sample.recipes,
            tasks: out.sample.tasks,
            babyEvents: out.sample.babyEvents,
            diaryEntries: out.sample.diaryEntries,
            group: SAMPLE_GROUP_NAME,
          }),
        )
      } else {
        const out = await resetSampleData({})
        setResult(
          out.orphaned > 0
            ? fmt(plural(locale, out.orphaned, sampleData.removedWithOrphans), {
                deleted: out.deleted,
              })
            : fmt(sampleData.removed, { deleted: out.deleted }),
        )
      }
    } catch (e) {
      setError(errorMessage(e, sampleData.failed))
    } finally {
      setBusy(null)
    }
  }

  return (
    <SurfaceCard>
      <h2 className="m-0 mb-1 text-base font-semibold">{sampleData.title}</h2>
      <p className="m-0 mb-3 text-sm opacity-70">
        {sampleData.descriptionBefore}{' '}
        <strong>{sampleData.descriptionStrong}</strong>
        {sampleData.descriptionAfter}
      </p>

      {error && (
        <p className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {result && <p className="mb-3 text-sm opacity-70">{result}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={busy !== null}
          onClick={() => run('load')}
        >
          {busy === 'load' ? sampleData.loading : sampleData.load}
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={busy !== null}
          onClick={() => {
            if (window.confirm(sampleData.confirmRemove)) {
              void run('reset')
            }
          }}
        >
          {busy === 'reset' ? sampleData.removing : sampleData.remove}
        </button>
      </div>
    </SurfaceCard>
  )
}
