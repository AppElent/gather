/**
 * This phone as a push destination (APP-298): its permission, its Expo push
 * token, the registration it last made, and a release still to be delivered.
 *
 * Both are kept on the phone, not in memory, so a sign-out right after a cold
 * start still knows what to release, and a release that could not reach the
 * server (offline) is sent again on the next launch.
 *
 * iOS only. Android is paused, so on Android every answer here is
 * `unavailable` and nothing is ever asked or registered.
 */
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

import {
  clearPreference,
  PREFERENCE_KEYS,
  readPreference,
  writePreference,
} from '../../../prefs/localPreference'

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

/** A token as registered, with the Clerk session it was registered under. */
export interface PushRegistration {
  token: string
  sessionId: string
}

function readRegistration(
  key: typeof PREFERENCE_KEYS.pushRegistration | typeof PREFERENCE_KEYS.pushRelease,
): PushRegistration | null {
  const raw = readPreference(key)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<PushRegistration>
    return typeof value.token === 'string' &&
      typeof value.sessionId === 'string'
      ? { token: value.token, sessionId: value.sessionId }
      : null
  } catch {
    return null
  }
}

/** What this phone last registered for the signed-in account. */
export function registeredPush(): PushRegistration | null {
  return readRegistration(PREFERENCE_KEYS.pushRegistration)
}

export function rememberRegisteredPush(registration: PushRegistration) {
  writePreference(
    PREFERENCE_KEYS.pushRegistration,
    JSON.stringify(registration),
  )
}

/**
 * Sign-out: the registration becomes a release to deliver. Returns it, or
 * null when this phone registered nothing.
 */
export function moveRegistrationToRelease(): PushRegistration | null {
  const registration = registeredPush()
  clearPreference(PREFERENCE_KEYS.pushRegistration)
  if (registration)
    writePreference(PREFERENCE_KEYS.pushRelease, JSON.stringify(registration))
  return registration
}

/**
 * A registration that reached the server after this phone signed out: it is
 * released at once, and kept until that is confirmed like any other.
 */
export function queuePushRelease(registration: PushRegistration) {
  writePreference(PREFERENCE_KEYS.pushRelease, JSON.stringify(registration))
}

/** A release the server has not confirmed yet. */
export function pendingPushRelease(): PushRegistration | null {
  return readRegistration(PREFERENCE_KEYS.pushRelease)
}

/** The server confirmed `release`; forget it unless a newer one replaced it. */
export function confirmPushRelease(release: PushRegistration) {
  const pending = pendingPushRelease()
  if (
    pending?.token === release.token &&
    pending.sessionId === release.sessionId
  )
    clearPreference(PREFERENCE_KEYS.pushRelease)
}
