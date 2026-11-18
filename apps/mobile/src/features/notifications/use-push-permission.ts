/**
 * The one call a screen makes before it sets a reminder or tells somebody
 * they were assigned something (APP-298; used by APP-305, APP-333, APP-302):
 *
 * ```ts
 * const { ask } = usePushPermission()
 * await ask('reminder') // explains in one line, then iOS's own sheet, once
 * ```
 *
 * It never blocks what the person was doing: a reminder is saved whatever the
 * answer, and simply reaches no phone that said no.
 */
import { use } from 'react'

import {
  PushPermissionContext,
  type PushPermissionValue,
} from './push/push-permission-provider'

export function usePushPermission(): PushPermissionValue {
  const value = use(PushPermissionContext)
  if (!value)
    throw new Error('usePushPermission outside PushPermissionProvider')
  return value
}
