/**
 * The first step of adding a card: point the camera at its barcode (APP-142).
 *
 * The camera is asked for only here, with a sentence first saying what it is
 * for. A refusal is an answer, not a failure: it says how to turn the camera
 * on in Settings, and typing the number is always one tap away — as it is
 * when the phone has no camera at all (a simulator) or the code will not scan.
 *
 * Only the barcode types a card can carry are scanned (`SCAN_TYPES`), and the
 * first good read wins: the camera reports the same code many times a second.
 *
 * The camera runs only while this step is on screen: a tab switch keeps the
 * screen mounted, and a mounted `CameraView` keeps the capture session (and
 * the camera indicator) on. Coming back from Settings reads the permission
 * again, since the hook reads it once.
 */
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useIsFocused } from 'expo-router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import {
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { haptics } from '../../../feedback/haptics'
import { useI18n } from '../../../i18n'
import { RADIUS, TYPE, useTokens } from '../../../theme/tokens'
import { Button } from '../../../ui/button'
import { LOYALTY_CARD_ICONS } from '../loyalty-card-icons'
import { cardFromScan, SCAN_TYPES, type ScannedCard } from './card-scan'

export function CardScanner({
  onScanned,
  onTypeInstead,
}: {
  onScanned: (card: ScannedCard) => void
  onTypeInstead: () => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const words = t.loyaltyCards.scan
  const [permission, requestPermission, getPermission] = useCameraPermissions()
  const [unavailable, setUnavailable] = useState(false)
  const done = useRef(false)
  const focused = useIsFocused()

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') getPermission().catch(() => {})
    })
    return () => subscription.remove()
  }, [getPermission])

  const typeInstead = (
    <Button
      label={words.typeInstead}
      variant="secondary"
      onPress={onTypeInstead}
      testID="loyalty-card-type-instead"
    />
  )

  if (!permission) {
    return <View style={[styles.fill, { backgroundColor: tokens.ground }]} />
  }

  if (!permission.granted || unavailable) {
    const denied = !permission.granted && !permission.canAskAgain
    return (
      <Screen background={tokens.ground} centred testID="loyalty-card-scan-ask">
        <View style={[styles.askIcon, { backgroundColor: tokens.surface2 }]}>
          <LOYALTY_CARD_ICONS.ScanBarcode
            size={34}
            color={tokens.ink}
            strokeWidth={1.75}
          />
        </View>
        <Text
          accessibilityRole="header"
          style={[TYPE.title2, styles.center, styles.bold, { color: tokens.ink }]}
        >
          {words.askTitle}
        </Text>
        <Text style={[TYPE.body, styles.center, { color: tokens.muted }]}>
          {unavailable
            ? words.unavailable
            : denied
              ? words.denied
              : words.askBody}
        </Text>
        <View style={styles.askActions}>
          {unavailable ? null : denied ? (
            <Button
              label={words.openSettings}
              onPress={() => {
                Linking.openSettings().catch(() => {})
              }}
              testID="loyalty-card-open-settings"
            />
          ) : (
            <Button
              label={words.allow}
              onPress={() => {
                requestPermission().catch(() => {})
              }}
              testID="loyalty-card-allow-camera"
            />
          )}
          {typeInstead}
        </View>
      </Screen>
    )
  }

  return (
    <Screen background={tokens.ground}>
      <View style={styles.cameraWrap}>
        {focused ? (
          <CameraView
            style={styles.camera}
            facing="back"
            accessibilityLabel={words.frame}
            barcodeScannerSettings={{ barcodeTypes: [...SCAN_TYPES] }}
            onMountError={() => setUnavailable(true)}
            onBarcodeScanned={(result) => {
              if (done.current) return
              const card = cardFromScan(result)
              if (!card) return
              done.current = true
              haptics.selectionChanged()
              onScanned(card)
            }}
          />
        ) : null}
        <View pointerEvents="none" style={styles.frame} />
      </View>
      <View style={styles.below}>
        <Text style={[TYPE.body, styles.center, { color: tokens.ink }]}>
          {words.hint}
        </Text>
        {typeInstead}
      </View>
    </Screen>
  )
}

/**
 * The step's page: a scroll view, so the platform insets it below the
 * navigation bar and above the tab bar (a plain view runs under both), and so
 * larger text can still reach "Type the number instead".
 */
function Screen({
  background,
  centred,
  testID,
  children,
}: {
  background: string
  centred?: boolean
  testID?: string
  children: ReactNode
}) {
  return (
    <ScrollView
      testID={testID}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: background }}
      contentContainerStyle={[styles.page, centred && styles.ask]}
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flexGrow: 1, paddingVertical: 16, gap: 16 },
  ask: {
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  askIcon: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askActions: { gap: 10, marginTop: 8 },
  center: { textAlign: 'center' },
  bold: { fontWeight: '700' },
  // A card's barcode is wider than tall; a 4:5 window leaves room for the
  // hint and the way out below it on the smallest phones.
  cameraWrap: {
    aspectRatio: 4 / 5,
    maxHeight: 520,
    marginHorizontal: 16,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  camera: { flex: 1 },
  frame: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '30%',
    bottom: '30%',
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: RADIUS.card,
  },
  below: { gap: 12, paddingHorizontal: 16 },
})
