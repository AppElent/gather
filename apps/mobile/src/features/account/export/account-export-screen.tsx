/**
 * Export your data: the account and every Group the person is in, as one JSON
 * file (docs/contracts/data-export.md).
 *
 * A screen rather than a row that just does it, because what the file holds
 * back has to be readable before the button — "is my partner's diary in this?"
 * is the question it answers. The button is the only action, and the platform
 * draws everything after it: the system share sheet, on iOS and Android alike
 * (`account-export.ts`). The sheet appearing is the confirmation, so
 * the screen says nothing on success (apps/mobile/DESIGN_SYSTEM.md).
 */
import type { ExportProgress } from '@gather/core/data-export'
import { useConvex } from 'convex/react'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAvailability } from '../../../availability/AvailabilityProvider'
import { AuthButton } from '../../../components/AuthButton'
import { AuthError } from '../../../components/AuthError'
import { haptics } from '../../../feedback/haptics'
import { fmt, useI18n } from '../../../i18n'
import { useTokens } from '../../../theme/tokens'
import {
  DataExportError,
  type ExportFailure,
  exportMyData,
} from './account-export'

export function AccountExportScreen() {
  const tokens = useTokens()
  const { t } = useI18n()
  const convex = useConvex()
  const insets = useSafeAreaInsets()
  const { serviceActionsEnabled } = useAvailability()
  const copy = t.account.dataExport

  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [failed, setFailed] = useState<ExportFailure | null>(null)

  async function run() {
    setFailed(null)
    setProgress({ done: 0, total: 0 })
    try {
      await exportMyData(convex, setProgress)
    } catch (error) {
      setFailed(error instanceof DataExportError ? error.reason : 'failed')
      haptics.actionFailed()
    } finally {
      setProgress(null)
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={[styles.lead, { color: tokens.fg }]}>
        {copy.description}
      </Text>
      <Text style={[styles.body, { color: tokens.muted }]}>{copy.leftOut}</Text>
      <Text style={[styles.body, { color: tokens.muted }]}>{copy.photos}</Text>

      <AuthError message={failed ? copy[failed] : null} />

      <AuthButton
        testID="account-export-submit"
        label={copy.action}
        busy={progress !== null}
        disabled={!serviceActionsEnabled}
        onPress={() => void run()}
      />

      {progress && progress.total > 0 ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.body, { color: tokens.muted }]}
        >
          {fmt(copy.busy, { done: progress.done, total: progress.total })}
        </Text>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  lead: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 20 },
})
