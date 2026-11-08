/**
 * Asks before something permanent, in the alert `apps/mobile/DESIGN_SYSTEM.md`
 * describes: it names what is destroyed, Cancel is the safe answer, and the
 * destructive answer is the only one that acts.
 */
import { Alert } from 'react-native'

export function confirmDestructive({
  title,
  message,
  confirm,
  cancel,
  onConfirm,
}: {
  title: string
  message?: string
  /** The destructive button's label: "Delete", "Sign out of this device". */
  confirm: string
  cancel: string
  onConfirm: () => void
}) {
  Alert.alert(title, message, [
    { text: cancel, style: 'cancel' },
    { text: confirm, style: 'destructive', onPress: onConfirm },
  ])
}
