/**
 * Revokes the Sign in with Apple grant before the account is deleted, as Apple
 * requires (TN3194, guideline 5.1.1(v)). A fresh native sheet supplies the
 * code Convex exchanges and revokes (`accounts.revokeAppleSignIn`). Backing
 * out of the sheet cancels the deletion; any other failure is reported and the
 * deletion continues, so Apple never blocks it.
 *
 * The sheet signs in whoever owns the device's Apple Account, which need not
 * be the person linked to this account. A code for anyone else is never sent,
 * so another person's grant is never revoked.
 *
 * A grant cannot be restored, so `stillConfirmed` (the session the person
 * confirmed in is still the one signed in) is asked before the sheet and again
 * before the code is sent (APP-745). Convex refuses the code as well when the
 * account changed in between (`expectedSubject`).
 *
 * Apple issues the code to this build's bundle ID, which differs per install
 * variant (`app.config.ts`), so Convex is told which one to revoke against.
 *
 * Only iOS has the native sheet. Android Apple sign-in goes through Clerk's
 * browser flow, whose tokens the app cannot reach.
 *
 * Ported from Foundry (AppElent/workouts
 * `apps/mobile/src/features/profile/apple-revocation.ts`).
 */
import * as AppleAuthentication from 'expo-apple-authentication'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

import { reportError } from '../../../observability/report'

export type AppleLinkedUser = {
  externalAccounts: readonly { provider: string; providerUserId: string }[]
}

/** `useAction(api.accounts.revokeAppleSignIn)`. */
export type RevokeAction = (args: {
  authorizationCode: string
  bundleId: string
  expectedSubject: string
}) => Promise<unknown>

function appleUserIds(user: AppleLinkedUser) {
  return user.externalAccounts
    .filter(({ provider }) => provider.replace(/^oauth_/, '') === 'apple')
    .map(({ providerUserId }) => providerUserId)
}

export async function revokeAppleSignIn(
  user: AppleLinkedUser,
  revoke: RevokeAction,
  {
    expectedSubject,
    stillConfirmed,
  }: {
    /** The Clerk user the person confirmed the deletion as. */
    expectedSubject: string
    stillConfirmed: () => boolean
  },
): Promise<'continue' | 'cancelled' | 'changed'> {
  const linked = appleUserIds(user)
  if (Platform.OS !== 'ios' || linked.length === 0) return 'continue'
  try {
    const bundleId = Constants.expoConfig?.ios?.bundleIdentifier
    if (!bundleId) throw new Error('This build has no iOS bundle ID')
    if (!stillConfirmed()) return 'changed'
    const credential = await AppleAuthentication.signInAsync()
    if (!linked.includes(credential.user))
      throw new Error('Apple sheet returned a different Apple Account')
    const { authorizationCode } = credential
    if (!authorizationCode)
      throw new Error('Apple returned no authorization code')
    if (!stillConfirmed()) return 'changed'
    await revoke({ authorizationCode, bundleId, expectedSubject })
  } catch (error) {
    if ((error as { code?: string } | null)?.code === 'ERR_REQUEST_CANCELED')
      return 'cancelled'
    reportError(error)
  }
  return 'continue'
}
