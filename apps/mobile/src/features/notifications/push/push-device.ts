/**
 * This phone as a push destination (APP-298): its permission, its Expo push
 * token, and the token it last registered, which sign-out unregisters.
 *
 * iOS only. Android is paused, so on Android every answer here is
 * `unavailable` and nothing is ever asked or registered.
 */
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

export type PushPermission = 'granted' | 'undetermined' | 'denied' | 'unavailable'

/** Notifications that arrive while Gather is open still show as a banner. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

function answerOf(
  permissions: Notifications.NotificationPermissionsStatus,
): PushPermission {
  if (permissions.granted) return 'granted'
  const ios = permissions.ios?.status
  if (
    ios === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    ios === Notifications.IosAuthorizationStatus.EPHEMERAL
  )
    return 'granted'
  return permissions.canAskAgain ? 'undetermined' : 'denied'
}

/** What iOS says now, without asking. */
export async function readPushPermission(): Promise<PushPermission> {
  if (Platform.OS !== 'ios') return 'unavailable'
  return answerOf(await Notifications.getPermissionsAsync())
}

/** Show iOS's own sheet. Only ever after the person did something. */
export async function requestPushPermission(): Promise<PushPermission> {
  if (Platform.OS !== 'ios') return 'unavailable'
  return answerOf(
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    }),
  )
}

/** This install's Expo push token. Needs permission and the network. */
export async function readPushToken(): Promise<string> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as
    | string
    | undefined
  const { data } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  )
  return data
}

let registered: string | null = null

/** The token this phone last registered for the signed-in account. */
export function registeredPushToken(): string | null {
  return registered
}

export function rememberRegisteredPushToken(token: string | null) {
  registered = token
}
