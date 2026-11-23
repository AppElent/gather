/**
 * SPIKE (APP-652, do not merge): JS face of the local WatchConnectivity
 * module. iOS only; elsewhere every call is a no-op.
 */
import { requireOptionalNativeModule } from 'expo'

type WatchState = {
  supported: boolean
  activation?: number
  paired?: boolean
  watchAppInstalled?: boolean
}

type NativeModule = {
  updateApplicationContext(context: Record<string, string>): Promise<void>
  getState(): WatchState
}

const native = requireOptionalNativeModule<NativeModule>('GatherWatchConnectivity')

export async function updateWatchContext(context: Record<string, string>): Promise<void> {
  await native?.updateApplicationContext(context)
}

export function watchState(): WatchState {
  return native?.getState() ?? { supported: false }
}
