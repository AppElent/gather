import {
  collectExport,
  type ExportProgress,
  exportFileName,
  serializeExport,
} from '@gather/core/data-export'
import { useConvex } from 'convex/react'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { fmt, useMessages } from '../../lib/i18n'

/**
 * "Export your data": the person's account and every Group they are in, as a
 * JSON download (docs/contracts/data-export.md).
 *
 * The file is assembled here, page by page, rather than built on the server:
 * a Convex query is one bounded read, and a household's baby log alone can be
 * more than one. The button keeps its label at every width — it is the
 * workflow's one action, not a compact control.
 */
export function DataExportSettings() {
  const convex = useConvex()
  const { dataExport } = useMessages().settings
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [failed, setFailed] = useState(false)

  async function run() {
    setFailed(false)
    setProgress({ done: 0, total: 0 })
    try {
      const now = new Date()
      const data = await collectExport(
        {
          manifest: () => convex.query(api.dataExport.manifest, {}),
          page: (request) => convex.query(api.dataExport.page, request),
        },
        { now, onProgress: setProgress },
      )
      if (!data) throw new Error('Not signed in')
      download(exportFileName(now), serializeExport(data))
    } catch {
      setFailed(true)
    } finally {
      setProgress(null)
    }
  }

  return (
    // `rm-panel` rather than `SurfaceCard`: it sits under the profile panels
    // on Account and reads as one more of them.
    <section className="rm-panel p-4">
      <h2 className="rm-label">{dataExport.title}</h2>
      <p className="m-0 mb-2 text-sm opacity-70">{dataExport.description}</p>
      <p className="m-0 mb-2 text-sm opacity-70">{dataExport.leftOut}</p>
      <p className="m-0 mb-3 text-sm opacity-70">{dataExport.photos}</p>

      {failed && (
        <p
          role="alert"
          className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {dataExport.failed}
        </p>
      )}

      <button
        type="button"
        disabled={progress !== null}
        onClick={run}
        className="inline-flex min-h-9 items-center gap-2 rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Download className="size-4" aria-hidden="true" />
        <span aria-live="polite">
          {progress
            ? fmt(dataExport.busy, {
                done: progress.done,
                total: progress.total || '…',
              })
            : dataExport.action}
        </span>
      </button>
    </section>
  )
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoked on the next turn, once the click has handed the URL to the browser.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
