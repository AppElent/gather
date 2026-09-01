/**
 * Account: who you are, what can be changed about it, and the two ways out.
 *
 * It used to be a name, an email, a sentence saying the rest was managed on the
 * web, and Sign out. That stopped being defensible the moment the phone could
 * create an account — an app that signs people up has to let them delete the
 * account from inside it (App Store guideline 5.1.1(v)), and once deletion is
 * here, "your name is managed elsewhere" reads as an app that could not be
 * bothered rather than one that drew a line.
 *
 * So this is a hub in the shape Settings already uses: a picture and a name at
 * the top, then one row per thing you can change, each its own pushed screen.
 * Nothing here edits anything itself.
 *
 * **The two ways out are not the same weight and are not next to each other.**
 * Sign out is a secondary button; Delete account is a row, in danger, below a
 * gap, and it opens a screen that says what it will destroy before it asks.
 */
import { useUser } from '@clerk/expo'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { isTestAccount } from '../../../../../src/auth/config'
import { useSignOut } from '../../../../../src/auth/useSignOut'
import { useAvailability } from '../../../../../src/availability/AvailabilityProvider'
import { AuthButton } from '../../../../../src/components/AuthButton'
import { useI18n } from '../../../../../src/i18n'
import { identityInitial } from '../../../../../src/settings/identity'
import { setProfilePhoto } from '../../../../../src/settings/profilePhoto'
import type { SettingsHref } from '../../../../../src/settings/sections'
import type { Glyph } from '../../../../../src/theme/glyph'
import { UI_ICONS } from '../../../../../src/theme/icons'
import { RADIUS, useTokens } from '../../../../../src/theme/tokens'

export default function Account() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { user } = useUser()
  const signOut = useSignOut()
  const { serviceActionsEnabled } = useAvailability()
  const insets = useSafeAreaInsets()

  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  const name = user?.fullName?.trim() ?? ''
  const locked = isTestAccount(email)

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Identity locked={locked} />

      {locked ? (
        <Text style={[styles.note, { color: tokens.muted }]}>
          {t.account.testAccount}
        </Text>
      ) : null}

      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        <Row
          icon={UI_ICONS.User}
          label={t.account.name}
          value={name}
          href="/settings/account/name"
          first
          disabled={locked}
        />
        <Row
          icon={UI_ICONS.KeyRound}
          label={t.account.password}
          href="/settings/account/password"
          disabled={locked}
        />
        <Row
          icon={UI_ICONS.Mail}
          label={t.account.email}
          value={email}
          href="/settings/account/email"
        />
        <Row
          icon={UI_ICONS.Smartphone}
          label={t.account.devices}
          href="/settings/account/devices"
        />
      </View>

      <AuthButton
        variant="secondary"
        label={t.signedIn.signOut}
        disabled={!serviceActionsEnabled}
        onPress={signOut}
      />

      <View
        style={[
          styles.card,
          styles.danger,
          { backgroundColor: tokens.surface, borderColor: tokens.border },
        ]}
      >
        <Row
          icon={UI_ICONS.Trash2}
          label={t.account.deleteAccount.title}
          href="/settings/account/delete"
          first
          destructive
          disabled={locked || !serviceActionsEnabled}
        />
      </View>
    </ScrollView>
  )
}

/**
 * The picture, the name and the email — and the picture is the control.
 *
 * Tapping an avatar to change it is what every account screen on both
 * platforms does, so it needs no button of its own; the sheet of answers is
 * the platform's own action sheet rather than a row of buttons, because there
 * are three of them and one is destructive.
 */
function Identity({ locked }: { locked: boolean }) {
  const tokens = useTokens()
  const { t } = useI18n()
  const { isLoaded, user } = useUser()
  const [busy, setBusy] = useState(false)
  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  const name = user?.fullName?.trim() ?? ''
  const initial = identityInitial(isLoaded, name, email)
  const User = UI_ICONS.User

  // Clerk hands back a generated avatar for an account with no picture, so
  // "has a picture" is a question only Clerk can answer.
  const photo = user?.hasImage ? user.imageUrl : undefined

  async function change(action: 'camera' | 'library' | 'remove') {
    if (!user) return
    setBusy(true)
    const outcome = await setProfilePhoto(user, action)
    setBusy(false)
    if (outcome === 'denied') Alert.alert(t.account.picture.denied)
    if (outcome === 'failed') Alert.alert(t.account.picture.failed)
  }

  function choose() {
    Alert.alert(t.account.picture.change, undefined, [
      { text: t.account.picture.take, onPress: () => void change('camera') },
      { text: t.account.picture.choose, onPress: () => void change('library') },
      ...(photo
        ? [
            {
              text: t.account.picture.remove,
              style: 'destructive' as const,
              onPress: () => void change('remove'),
            },
          ]
        : []),
      { text: t.actions.cancel, style: 'cancel' as const },
    ])
  }

  return (
    <View style={styles.identity}>
      <Pressable
        testID="account-photo"
        accessibilityRole="button"
        accessibilityLabel={t.account.picture.change}
        accessibilityState={{ disabled: locked, busy }}
        disabled={locked || busy}
        onPress={choose}
        style={({ pressed }) => [
          styles.avatar,
          { backgroundColor: tokens.tile },
          pressed && styles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={tokens.muted} />
        ) : photo ? (
          <Image
            source={{ uri: photo }}
            contentFit="cover"
            style={styles.avatarImage}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : initial ? (
          <Text style={[styles.initial, { color: tokens.fg }]}>{initial}</Text>
        ) : (
          <User
            size={30}
            color={tokens.muted}
            strokeWidth={1.6}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        )}
      </Pressable>
      {name ? (
        <Text selectable style={[styles.name, { color: tokens.fg }]}>
          {name}
        </Text>
      ) : null}
      <Text selectable style={[styles.email, { color: tokens.muted }]}>
        {email}
      </Text>
    </View>
  )
}

/** A row that goes somewhere, with the value it currently holds beside it. */
function Row({
  icon,
  label,
  value,
  href,
  first = false,
  destructive = false,
  disabled = false,
}: {
  icon: Glyph
  label: string
  value?: string
  href: SettingsHref
  first?: boolean
  destructive?: boolean
  disabled?: boolean
}) {
  const tokens = useTokens()
  const Icon = icon
  const ChevronRight = UI_ICONS.ChevronRight
  const color = destructive ? tokens.danger : tokens.fg

  return (
    <Pressable
      testID={`account-row-${href.split('/').pop()}`}
      accessibilityRole="button"
      accessibilityLabel={[label, value].filter(Boolean).join(', ')}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => router.push(href)}
      style={({ pressed }) => [
        styles.row,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: tokens.border,
        },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Icon
        size={19}
        color={destructive ? tokens.danger : tokens.muted}
        strokeWidth={1.8}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text numberOfLines={1} style={[styles.rowLabel, { color }]}>
        {label}
      </Text>
      {value ? (
        <Text
          numberOfLines={1}
          style={[styles.rowValue, { color: tokens.muted }]}
        >
          {value}
        </Text>
      ) : null}
      <ChevronRight
        size={18}
        color={tokens.muted}
        strokeWidth={1.8}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  identity: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  avatarImage: { width: '100%', height: '100%' },
  initial: { fontSize: 32, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  email: { fontSize: 15 },
  note: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  // The end of the account is not the next row after Devices.
  danger: { marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 4,
  },
  rowLabel: { flex: 1, fontSize: 16 },
  rowValue: { fontSize: 15, maxWidth: 150 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.45 },
})
