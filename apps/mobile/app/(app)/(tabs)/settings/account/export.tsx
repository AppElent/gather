/**
 * Export your data: the account and every Group the person is in, as one JSON
 * file (docs/contracts/data-export.md).
 *
 * A screen rather than a row that just does it, because what the file holds
 * back has to be readable before the button — "is my partner's diary in this?"
 * is the question it answers. The button is the only action, and the platform
 * draws everything after it: the share sheet on iOS, the folder picker on
 * Android (`src/settings/dataExport.ts`).
 */
import type { ExportProgress } from '@gather/core/data-export'
import { useConvex } from 'convex/react'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAvailability } from '../../../../../src/availability/AvailabilityProvider'
import { AuthButton } from '../../../../../src/components/AuthButton'
import { AuthError } from '../../../../../src/components/AuthError'
import { haptics } from '../../../../../src/feedback/haptics'
import { fmt, useI18n } from '../../../../../src/i18n'
import { exportMyData } from '../../../../../src/settings/dataExport'
import { useTokens } from '../../../../../src/theme/tokens'

export default function ExportData() {
  const tokens = useTokens()
  const { t } = useI18n()
  const convex = useConvex()
  const insets = useSafeAreaInsets()
  const { serviceActionsEnabled } = useAvailability()
  const copy = t.account.dataExport

  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [failed, setFailed] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  async function run() {
    setFailed(false)
    setSaved(null)
    setProgress({ done: 0, total: 0 })
    try {
      const outcome = await exportMyData(convex, setProgress)
      if (outcome.kind === 'saved') {
        // Android has no sheet to close, so the screen says where it went.
        setSaved(outcome.file)
        haptics.itemSaved()
      }
    } catch {
      setFailed(true)
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

      <AuthError message={failed ? copy.failed : null} />

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

      {saved ? (
        <Text
          testID="account-export-saved"
          accessibilityLiveRegion="polite"
          style={[styles.body, { color: tokens.fg }]}
        >
          {fmt(copy.saved, { file: saved })}
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
