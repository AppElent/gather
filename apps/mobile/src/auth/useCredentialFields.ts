/**
 * The values of a credential form, and when it is safe to submit them.
 *
 * iOS AutoFill can fill or clear a focused field without `onChangeText`: a
 * strong password it offered, or one it took back when that offer was
 * declined. Until the field reports its text in `onEndEditing`, React state
 * holds whatever was there before. A primary button that submits from state
 * while a field still has focus therefore sends the wrong password, or none.
 *
 * So submitting never trusts a focused field:
 *
 * - `press` is the primary button. With a field focused it blurs it and
 *   submits from that field's `onEndEditing`, with its final native text.
 *   With nothing focused it submits from state.
 * - `submitFrom(key)` is the keyboard's Go or Done: the event carries the
 *   field's text, so it submits at once.
 * - `editing` is true while a field has focus. The button stays enabled then,
 *   because state may say a field is empty that AutoFill has filled.
 *
 * `onSubmit` gets the latest values and decides whether they are enough;
 * nothing here knows what a form needs. Same approach as Foundry's
 * (AppElent/workouts#250).
 */
import { useCallback, useRef, useState } from 'react'
import { TextInput } from 'react-native'

/** `onEndEditing` and `onSubmitEditing` both carry the field's native text. */
type TextEvent = { nativeEvent: { text: string } }

export function useCredentialFields<K extends string>(
  initial: Record<K, string>,
  onSubmit: (values: Record<K, string>) => void,
) {
  const [values, setValues] = useState(initial)
  const latest = useRef(initial)
  const [editing, setEditing] = useState(false)
  const pending = useRef(false)
  const submitRef = useRef(onSubmit)
  submitRef.current = onSubmit

  const set = useCallback((key: K, text: string) => {
    latest.current = { ...latest.current, [key]: text }
    setValues(latest.current)
  }, [])

  const submitNow = useCallback(() => {
    pending.current = false
    submitRef.current(latest.current)
  }, [])

  /** The props that bind a `Field` to `key`. */
  function field(key: K) {
    return {
      value: values[key],
      onChangeText: (text: string) => set(key, text),
      onFocus: () => {
        pending.current = false
        setEditing(true)
      },
      onEndEditing: (event: TextEvent) => {
        set(key, event.nativeEvent.text)
        setEditing(false)
        if (pending.current) submitNow()
      },
    }
  }

  const press = useCallback(() => {
    const focused = TextInput.State.currentlyFocusedInput()
    if (focused) {
      pending.current = true
      focused.blur()
    } else {
      submitNow()
    }
  }, [submitNow])

  function submitFrom(key: K) {
    return (event: TextEvent) => {
      set(key, event.nativeEvent.text)
      submitNow()
    }
  }

  return { values, field, press, submitFrom, editing }
}
