/**
 * The code half of passwordless sign-in.
 *
 * `sign-in` already sent the code, so this screen never sends on mount — a
 * remount would re-send, and Clerk rate-limits that. The address is a route
 * param purely so the screen can say where the code went.
 *
 * An account with a second factor stays on this screen: a correct code swaps
 * the form for the second factor's own (`useEmailCodeSignIn` decides which),
 * rather than pushing a third screen for a state with no address of its own.
 *
 * `autoComplete="sms-otp"` (Android) and `textContentType="oneTimeCode"` (iOS)
 * are what let the keyboard offer the code the moment the email arrives.
 *
 * Nothing navigates on success: `finalize()` flips `isSignedIn`, the `(auth)`
 * layout redirects, and this screen unmounts — to the same place the password
 * form lands, where `ConvexSessionGate` takes over.
 */

import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { AuthButton } from '../../../components/AuthButton'
import { AuthError } from '../../../components/AuthError'
import { AuthField } from '../../../components/AuthField'
import { AuthLink } from '../../../components/AuthLink'
import { AuthScreen } from '../../../components/AuthScreen'
import { haptics } from '../../../feedback/haptics'
import { fmt, useI18n } from '../../../i18n'
import { useTokens } from '../../../theme/tokens'
import { useEmailCodeSignIn } from '../use-email-code-sign-in'
import { useCooldown } from './use-cooldown'

const CODE_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 30
/** Backup codes are eight characters; anything else is a code of this length. */
const BACKUP_CODE_MAX_LENGTH = 16

export function SignInCodeScreen({ email }: { email?: string }) {
  const { t } = useI18n()
  const tokens = useTokens()
  const router = useRouter()
  const {
    verify,
    verifySecondFactor,
    resend,
    resending,
    startOver,
    secondFactor,
    busy,
    error,
  } = useEmailCodeSignIn()
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS)
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState(false)

  const { start: startCooldown } = cooldown
  // The code was sent on the previous screen, so the clock starts as this one does;
  // a second factor's code is sent as that step opens, so it starts the clock again.
  const secondFactorStrategy = secondFactor?.strategy
  // biome-ignore lint/correctness/useExhaustiveDependencies: the step opening is the trigger
  useEffect(() => startCooldown(), [startCooldown, secondFactorStrategy])

  const text = t.signIn.emailCode
  const second = text.secondFactor
  const isBackup = secondFactor?.strategy === 'backup_code'
  const length = isBackup ? BACKUP_CODE_MAX_LENGTH : CODE_LENGTH
  const ready = isBackup ? code.trim().length > 0 : code.length === CODE_LENGTH

  async function submit() {
    setNotice(false)
    const ok = secondFactor
      ? await verifySecondFactor(code)
      : await verify(code)
    if (!ok) haptics.actionFailed()
    else setCode('')
  }

  async function onResend() {
    setNotice(false)
    if (await resend()) {
      cooldown.start()
      setNotice(true)
    } else {
      haptics.actionFailed()
    }
  }

  async function leave() {
    await startOver()
    router.back()
  }

  // A failed second-factor send has nothing to wait out: retry straight away.
  const coolingDown = cooldown.remaining > 0 && !(secondFactor && error)
  const sendsCode =
    secondFactor?.strategy === 'phone_code' ||
    secondFactor?.strategy === 'email_code'
  const resendLink = (
    <AuthLink
      testID="sign-in-code-resend"
      label={
        coolingDown
          ? fmt(text.resendIn, { seconds: cooldown.remaining })
          : text.resend
      }
      onPress={onResend}
      disabled={coolingDown || resending}
    />
  )

  return (
    <AuthScreen
      heading={secondFactor ? second.heading : t.verify.heading}
      subtitle={
        secondFactor
          ? secondFactor.strategy === 'totp'
            ? second.totp
            : secondFactor.strategy === 'backup_code'
              ? second.backupCode
              : fmt(second.sent, {
                  contact: secondFactor.contact ?? second.sentFallback,
                })
          : fmt(text.sent, { email: email ?? '' })
      }
      footer={
        secondFactor ? (
          <>
            {sendsCode ? resendLink : null}
            <AuthLink
              testID="sign-in-code-back"
              label={second.back}
              onPress={leave}
            />
          </>
        ) : (
          <>
            {resendLink}
            <AuthLink
              testID="sign-in-code-change-email"
              label={text.back}
              onPress={leave}
            />
          </>
        )
      }
    >
      <AuthField
        key={secondFactor?.strategy ?? 'code'}
        testID="sign-in-code-input"
        label={isBackup ? second.backupCodeLabel : t.fields.code}
        value={code}
        onChangeText={setCode}
        keyboardType={isBackup ? 'default' : 'number-pad'}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={length}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={() => ready && !busy && submit()}
      />

      <AuthError message={error} />
      {notice ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.notice, { color: tokens.muted }]}
        >
          {text.resent}
        </Text>
      ) : null}

      <AuthButton
        testID="sign-in-code-submit"
        label={secondFactor ? second.verify : t.signIn.submit}
        busy={busy}
        disabled={!ready}
        onPress={submit}
      />
    </AuthScreen>
  )
}

const styles = StyleSheet.create({
  notice: { fontSize: 14, lineHeight: 20 },
})
