import { type AccessibilityProps, Platform } from 'react-native'

/**
 * How one choice of a radio group tells a screen reader what it is.
 *
 * iOS has no radio trait. React Native answers `accessibilityRole="radio"` with
 * the English words "radio button, checked" as the value and no trait at all,
 * so a choice reads in the wrong language and is not a control. There it is a
 * button that is selected or not, and says "radio button" in the app's language.
 * Android has a real radio role.
 */
export function radioProps(
  selected: boolean,
  radioLabel: string,
): AccessibilityProps {
  return Platform.OS === 'ios'
    ? {
        accessibilityRole: 'button',
        accessibilityState: { selected },
        accessibilityValue: { text: radioLabel },
      }
    : { accessibilityRole: 'radio', accessibilityState: { checked: selected } }
}
