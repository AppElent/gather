import { type BarcodeFormat, barcodeShape } from '@gather/core/barcodes'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { SvgXml } from 'react-native-svg'

import { useI18n } from '../../../i18n'
import { RADIUS, TYPE } from '../../../theme/tokens'
import { type DrawnBarcode, drawCardBarcode } from './card-barcode-svg'

/**
 * The panel a till scans: always dark on light, whatever the theme. A scanner
 * reads dark bars on a light ground, so the theme stops at this panel's edge,
 * and the words inside it are dark too.
 */
export const PANEL = {
  background: '#ffffff',
  ink: '#1f2421',
  muted: '#5b625d',
  danger: '#a4372c',
} as const

type Drawn = { ok: DrawnBarcode } | { failed: true } | null

/**
 * A card's barcode, large and on a white panel, with the card number as text
 * under it — so a cashier can type what a scanner will not read, and a screen
 * reader can say it.
 */
export function CardBarcode({
  format,
  value,
  label,
  size = 'large',
}: {
  format: BarcodeFormat
  value: string
  /** The image's accessible name: which store, which format. */
  label: string
  size?: 'large' | 'preview'
}) {
  const { t } = useI18n()
  const words = t.loyaltyCards.detail
  const [drawn, setDrawn] = useState<Drawn>(null)

  useEffect(() => {
    let cancelled = false
    setDrawn(null)
    drawCardBarcode(format, value).then(
      (ok) => {
        if (!cancelled) setDrawn({ ok })
      },
      () => {
        if (!cancelled) setDrawn({ failed: true })
      },
    )
    return () => {
      cancelled = true
    }
  }, [format, value])

  const matrix = barcodeShape(format) === 'matrix'
  const maxWidth =
    size === 'large' ? (matrix ? 300 : undefined) : matrix ? 160 : 320

  return (
    <View
      style={[
        styles.panel,
        size === 'large' ? styles.panelLarge : styles.panelPreview,
      ]}
    >
      {drawn === null ? (
        <View style={styles.pending}>
          <ActivityIndicator color={PANEL.muted} />
          <Text style={[TYPE.subhead, { color: PANEL.muted }]}>
            {words.drawing}
          </Text>
        </View>
      ) : 'failed' in drawn ? (
        <Text
          accessibilityRole="alert"
          style={[TYPE.subhead, styles.centered, { color: PANEL.danger }]}
        >
          {words.drawFailed}
        </Text>
      ) : (
        <View
          testID="loyalty-card-barcode"
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
          style={[
            styles.code,
            {
              aspectRatio: drawn.ok.width / drawn.ok.height,
              maxWidth,
            },
          ]}
        >
          <SvgXml xml={drawn.ok.svg} width="100%" height="100%" />
        </View>
      )}
      {size === 'large' ? (
        <Text
          testID="loyalty-card-number"
          selectable
          // Read digit by digit, as a cashier would type it, not as one
          // number in the trillions.
          accessibilityLabel={value.split('').join(' ')}
          style={[TYPE.numeralL, styles.number, { color: PANEL.ink }]}
        >
          {value}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: PANEL.background,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    gap: 12,
  },
  panelLarge: { paddingVertical: 24, paddingHorizontal: 16 },
  panelPreview: { padding: 12 },
  pending: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  centered: { textAlign: 'center', paddingVertical: 16 },
  code: { width: '100%', alignSelf: 'center' },
  number: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
})
