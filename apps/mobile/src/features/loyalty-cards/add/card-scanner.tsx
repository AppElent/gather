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
 */
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRef, useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'

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
  const [permission, requestPermission] = useCameraPermissions()
  const [unavailable, setUnavailable] = useState(false)
  const done = useRef(false)

  const typeInstead = (
    <Button
      label={words.typeInstead}
      variant="secondary"
      onPress={onTypeInstead}
      testID="loyalty-card-type-instead"
    />
  )

  if (!permission) {
    return <View style={[styles.fill, { backgroundColor: tokens.bg }]} />
  }

  if (!permission.granted || unavailable) {
    const denied = !permission.granted && !permission.canAskAgain
    return (
      <View
        testID="loyalty-card-scan-ask"
        style={[styles.fill, styles.ask, { backgroundColor: tokens.bg }]}
      >
        <View style={[styles.askIcon, { backgroundColor: tokens.tile }]}>
          <LOYALTY_CARD_ICONS.ScanBarcode
            size={34}
            color={tokens.fg}
            strokeWidth={1.75}
          />
        </View>
        <Text
          accessibilityRole="header"
          style={[TYPE.title, styles.center, styles.bold, { color: tokens.fg }]}
        >
          {words.askTitle}
        </Text>
        <Text style={[TYPE.lead, styles.center, { color: tokens.muted }]}>
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
      </View>
    )
  }

  return (
    <View style={[styles.fill, { backgroundColor: tokens.bg }]}>
      <View style={styles.cameraWrap}>
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
        <View pointerEvents="none" style={styles.frame} />
      </View>
      <View style={styles.below}>
        <Text style={[TYPE.lead, styles.center, { color: tokens.fg }]}>
          {words.hint}
        </Text>
        {typeInstead}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
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
  cameraWrap: {
    flex: 1,
    margin: 16,
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
  below: { gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
})
