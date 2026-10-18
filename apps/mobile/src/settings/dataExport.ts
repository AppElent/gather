/**
 * Writing "Export your data" out of the phone.
 *
 * The file is the web's file — `collectExport` in `@gather/core/data-export`
 * assembles both — and only the last step differs, because the two platforms
 * offer different things to an app with no native module for it:
 *
 * - **iOS:** React Native's own `Share` takes a `file://` URL, so the file
 *   goes to the system share sheet — Save to Files, AirDrop, Mail.
 * - **Android:** `Share` carries text only, and an export is too large to
 *   pass as text through an intent. So the system folder picker
 *   (`expo-file-system`, Storage Access Framework) chooses where the file is
 *   saved instead.
 *
 * `expo-sharing` would give Android a share sheet too, but it is a native
 * module: adding it moves the build fingerprint, and the feature could then
 * not reach installed apps over the air (ADR-0029). Both paths here use what
 * every build already has.
 */
import {
  collectExport,
  type ExportProgress,
  exportFileName,
  serializeExport,
} from '@gather/core/data-export'
import type { ConvexReactClient } from 'convex/react'
import { Directory, File, Paths } from 'expo-file-system'
import { Platform, Share } from 'react-native'

import { api } from '../../../../convex/_generated/api'

export type ExportOutcome =
  /** iOS: the share sheet closed after the person picked somewhere. */
  | { kind: 'shared' }
  /** Android: written into the folder the person picked. */
  | { kind: 'saved'; file: string }
  /** The person backed out of the sheet or the picker. Not a failure. */
  | { kind: 'cancelled' }

function isCancellation(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && code.includes('CANCELLED')
}

async function assemble(
  convex: ConvexReactClient,
  now: Date,
  onProgress: (progress: ExportProgress) => void,
) {
  const data = await collectExport(
    {
      manifest: () => convex.query(api.dataExport.manifest, {}),
      page: (request) => convex.query(api.dataExport.page, request),
    },
    { now, onProgress },
  )
  if (!data) throw new Error('Not signed in')
  return serializeExport(data)
}

export async function exportMyData(
  convex: ConvexReactClient,
  onProgress: (progress: ExportProgress) => void,
): Promise<ExportOutcome> {
  const now = new Date()
  const name = exportFileName(now)

  if (Platform.OS === 'android') {
    // The folder first: backing out of it should cost nothing.
    let folder: Directory
    try {
      folder = await Directory.pickDirectoryAsync()
    } catch (error) {
      if (isCancellation(error)) return { kind: 'cancelled' }
      throw error
    }
    const text = await assemble(convex, now, onProgress)
    folder.createFile(name, 'application/json').write(text)
    return { kind: 'saved', file: name }
  }

  const text = await assemble(convex, now, onProgress)
  const file = new File(Paths.cache, name)
  if (file.exists) file.delete()
  file.create()
  file.write(text)
  try {
    const result = await Share.share({ url: file.uri })
    return result.action === Share.dismissedAction
      ? { kind: 'cancelled' }
      : { kind: 'shared' }
  } finally {
    // The sheet has handed the file on by the time it closes; a copy left in
    // the cache would be a second, unmanaged copy of the household.
    if (file.exists) file.delete()
  }
}
