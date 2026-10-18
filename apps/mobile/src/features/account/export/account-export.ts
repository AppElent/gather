/**
 * Writing "Export your data" out of the phone.
 *
 * The file is the web's file — `collectExport` in `@gather/core/data-export`
 * assembles both — written to the cache with `expo-file-system` and handed to
 * the system share sheet with `expo-sharing`, on iOS and Android alike: Save
 * to Files, Drive, AirDrop, Mail, whatever the phone offers. The platform
 * draws everything after the button (apps/mobile/DESIGN_SYSTEM.md).
 *
 * `expo-sharing` is a native module and moved the build fingerprint, so this
 * reaches a phone with the next native build rather than over the air
 * (ADR-0029). Its config plugin is deliberately not in `app.json`: sharing
 * *out* needs none, and the plugin's share-*into* half would compete with
 * `expo-share-intent`, which is how a Drop arrives (docs/contracts/drop.md).
 */
import {
  collectExport,
  type ExportProgress,
  exportFileName,
  serializeExport,
} from '@gather/core/data-export'
import type { ConvexReactClient } from 'convex/react'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

import { api } from '../../../../../../convex/_generated/api'

/** Why an export did not reach the share sheet, for the screen to say. */
export type ExportFailure = 'unavailable' | 'failed'

export class DataExportError extends Error {
  constructor(readonly reason: ExportFailure) {
    super(reason)
  }
}

export async function exportMyData(
  convex: ConvexReactClient,
  onProgress: (progress: ExportProgress) => void,
): Promise<void> {
  // Asked first: a phone with nowhere to share to should not wait through
  // every page of the household to be told so.
  if (!(await Sharing.isAvailableAsync())) {
    throw new DataExportError('unavailable')
  }

  const now = new Date()
  const data = await collectExport(
    {
      manifest: () => convex.query(api.dataExport.manifest, {}),
      page: (request) => convex.query(api.dataExport.page, request),
    },
    { now, onProgress },
  )
  if (!data) throw new DataExportError('failed')

  clearEarlierExports()
  const file = new File(Paths.cache, exportFileName(now))
  file.create()
  file.write(serializeExport(data))
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
  })
}

/**
 * Remove the files earlier exports left in the cache.
 *
 * Not done after sharing: on Android `shareAsync` resolves when the chooser
 * closes, which can be before the app it handed the file to — Drive's upload
 * dialog, a mail draft — has read it. So the copy stays until the next export
 * replaces it, and there is never more than one.
 */
function clearEarlierExports() {
  for (const entry of Paths.cache.list()) {
    if (entry instanceof File && /^gather-export-.*\.json$/.test(entry.name)) {
      entry.delete()
    }
  }
}
