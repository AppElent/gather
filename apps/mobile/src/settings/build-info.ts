/**
 * The build line at the foot of Settings: which version, which build, which
 * over-the-air update, which channel. It answers "what is my phone running?"
 * without a trip to the changelog (APP-471).
 *
 * Plain data in, a sentence out, so a test can run it with no React Native.
 * The update's label is `formatOtaLabel`'s: the release standard has one
 * format, shared with the publish script and the EAS update message.
 */
import { fmt } from '@gather/core/i18n'

import type { Messages } from '../i18n'
import { formatOtaLabel } from './ota-label.mjs'

export interface BuildInfo {
  /** `expo.version`; in an update, the version the update was built from. */
  version: string
  /** The native build number, which an update never changes. */
  build: string
  /** `Updates.updateId`: null when nothing was ever downloaded. */
  updateId: string | null
  /** `Updates.isEmbeddedLaunch`: the bundle inside the binary is running. */
  isEmbeddedLaunch: boolean
  /** `Updates.createdAt`: when the update was published. */
  createdAt: Date | null
  /** `EXPO_PUBLIC_GIT_SHA`, inlined by the publish script. */
  sha: string | undefined
  channel: string
}

/**
 * The label of the running update, or null on the embedded bundle.
 *
 * An update without a commit sha (published by hand without the publish
 * script) cannot have the shared label; it shows its id's first characters,
 * which is at least enough to find it in EAS.
 */
export function updateLabel(info: BuildInfo): string | null {
  if (info.isEmbeddedLaunch || !info.updateId) return null
  if (info.createdAt && info.sha) {
    try {
      return formatOtaLabel(info.version, info.createdAt, info.sha)
    } catch {
      // A malformed sha falls through to the id.
    }
  }
  return info.updateId.slice(0, 8)
}

export function buildInfoLine(
  messages: Messages['settings']['buildInfo'],
  info: BuildInfo,
): string {
  const label = updateLabel(info)
  const update = label === null ? messages.noUpdate : fmt(messages.update, { label })
  return fmt(messages.line, {
    version: info.version,
    build: info.build,
    update,
    channel: info.channel,
  })
}
