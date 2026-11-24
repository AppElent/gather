/**
 * Draws nothing. Keeps the app icon's long-press menu (`homeScreenActions.ts`)
 * in the current language, and follows a chosen item, or the Control Center
 * control's request (`controlRequest.ts`), to the quick-actions sheet. The
 * control's request opens the Loyalty card that is open instead, when there is
 * one (APP-443); the icon's menu and `<scheme>://quick` always open the sheet.
 *
 * Mounted by the root navigator once the router is up, signed in or not: the
 * route holds the request across sign-in, as it does for the deep link.
 */
import * as QuickActions from 'expo-quick-actions'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { Platform, Settings } from 'react-native'

import { confirmedAccount } from '../convex/lastKnown'
import {
  isCardOnScreen,
  readOpenCard,
} from '../features/loyalty-cards/card/open-card-store'
import { offlineGroupCards } from '../features/loyalty-cards/offline/offline-cards'
import { readRetainedGroup } from '../group/retainedGroup'
import { useI18n } from '../i18n'
import { moduleHref } from '../modules/moduleDestination'
import { reportError } from '../observability/report'
import {
  CONTROL_REQUEST_KEY,
  CONTROL_REQUEST_MAX_AGE_MS,
  CONTROL_REQUEST_TAKEN,
  controlTarget,
  isFreshControlRequest,
} from './controlRequest'
import {
  homeScreenActionItems,
  homeScreenActionRequest,
} from './homeScreenActions'
import { isWaitingForSheets, openAfterSheets } from './linkAfterSheets'
import {
  type QuickSheetRequest,
  quickSheetHref,
  requestQuickSheetInPlace,
} from './quickSheetRequest'

/**
 * `QuickActions.initial` is the item that launched this process and never
 * clears, so it is followed once per process, not once per mount: the
 * navigator remounts this after the Unavailable gate.
 */
let launchItemFollowed = false

/**
 * About when the process started. The navigator first mounts this behind the
 * Unavailable gate, which an offline launch can keep up for minutes; a launch
 * item reaching it later than the control's freshness limit is dropped, so the
 * sheet does not appear long after it was asked for.
 */
const loadedAt = Date.now()

/**
 * Opens the sheet in place when it is up, else through its route once every
 * other sheet has closed (APP-774). In place only while it stays up: something
 * that waits for the sheets is closing it.
 */
function openQuickSheet(request: QuickSheetRequest) {
  if (!isWaitingForSheets() && requestQuickSheetInPlace(request)) return
  // A tick later, so a cold start's router has mounted its first screen.
  openAfterSheets(() =>
    setTimeout(() => router.navigate(quickSheetHref(request))),
  )
}

/**
 * The control's press: the open Loyalty card, when there is one, else the
 * sheet. A card already on screen stays as it is, without a second copy.
 */
function followControl() {
  const card = readOpenCard()
  const target = controlTarget(card, {
    now: Date.now(),
    currentGroupId: readRetainedGroup(),
    savedCardIds: card
      ? offlineGroupCards(confirmedAccount(), card.groupSlug)?.map(
          (saved) => saved._id,
        )
      : undefined,
    isOnScreen: isCardOnScreen,
  })
  if (target.kind === 'stay') return
  if (target.kind === 'sheet') {
    openQuickSheet({})
    return
  }
  const href = moduleHref('/all/loyalty-cards/card', {
    cardId: target.cardId,
    via: 'control',
  })
  // With the All index beneath the card, so it has a back button (APP-454).
  openAfterSheets(() =>
    setTimeout(() => router.navigate(href, { withAnchor: true })),
  )
}

export function HomeScreenActionLinks() {
  const { t } = useI18n()

  useEffect(() => {
    QuickActions.setItems(homeScreenActionItems(t)).catch(reportError)
  }, [t])

  useEffect(() => {
    const follow = (action: QuickActions.Action) => {
      const request = homeScreenActionRequest(action.id)
      if (request) openQuickSheet(request)
    }
    if (!launchItemFollowed) {
      launchItemFollowed = true
      const fresh = Date.now() - loadedAt <= CONTROL_REQUEST_MAX_AGE_MS
      if (QuickActions.initial && fresh) follow(QuickActions.initial)
    }
    const subscription = QuickActions.addListener(follow)
    return () => subscription.remove()
  }, [])

  // The control's request: one left before this mounted (a cold start), then
  // each new one. Taken once: marked taken (`CONTROL_REQUEST_TAKEN`) before the card or the
  // sheet opens.
  useEffect(() => {
    if (Platform.OS !== 'ios') return
    const take = () => {
      const requestedAt = Settings.get(CONTROL_REQUEST_KEY)
      if (requestedAt == null || requestedAt === CONTROL_REQUEST_TAKEN) return
      Settings.set({ [CONTROL_REQUEST_KEY]: CONTROL_REQUEST_TAKEN })
      if (isFreshControlRequest(requestedAt, Date.now())) followControl()
    }
    take()
    const watch = Settings.watchKeys(CONTROL_REQUEST_KEY, take)
    return () => Settings.clearWatch(watch)
  }, [])

  return null
}
