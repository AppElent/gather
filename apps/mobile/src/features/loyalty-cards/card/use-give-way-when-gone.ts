/**
 * A card the control opened as the open card (APP-443) that turns out to be
 * gone gives way to the quick-actions sheet the control otherwise opens.
 *
 * Only when the screen never showed the card: the control's answer for a card
 * deleted since it was recorded. A card that was on screen and is then deleted,
 * here or on another phone, already has its own way out (`onDeleted` goes
 * back), and a second back with the sheet on top would be uninvited.
 */
import { useEffect, useRef } from 'react'

export function useGiveWayWhenGone(
  openedByControl: boolean,
  /** The card's face: undefined while loading, null when gone. */
  face: unknown,
  giveWay: () => void,
) {
  const shown = useRef(false)
  useEffect(() => {
    if (face) shown.current = true
  }, [face])

  const giveWayRef = useRef(giveWay)
  giveWayRef.current = giveWay

  const gone = openedByControl && face === null
  useEffect(() => {
    if (gone && !shown.current) giveWayRef.current()
  }, [gone])
}
