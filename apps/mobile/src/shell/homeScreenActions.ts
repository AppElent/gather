/**
 * The app icon's long-press menu (APP-207): iOS Home Screen quick actions and,
 * because `expo-quick-actions` sets both from one list, Android's dynamic
 * shortcuts. Every item opens the quick-actions sheet (`<scheme>://quick`,
 * `quickSheetRequest.ts`); "Add task" also opens its form.
 *
 * Set from JavaScript rather than declared in `Info.plist`, so the titles
 * follow the language chosen in Settings, not only the device's. The cost is
 * that a fresh install shows them only after its first launch.
 */
import type { Action } from 'expo-quick-actions'
import type { SFSymbol } from 'expo-symbols'

import type { Messages } from '../i18n'
import type { QuickSheetRequest } from './quickSheetRequest'

export type HomeScreenActionId = 'loyalty-card' | 'task-new' | 'quick'

interface HomeScreenActionDef {
  id: HomeScreenActionId
  title: (text: Messages['shell']['homeScreenActions']) => string
  /** iOS only; Android draws the shortcut with no icon. */
  symbol: SFSymbol
  request: QuickSheetRequest
}

/**
 * In menu order, nearest the icon first. The loyalty card leads: it is what
 * somebody at a till needs, and the sheet opens with the cards on top.
 */
const HOME_SCREEN_ACTIONS: readonly HomeScreenActionDef[] = [
  {
    id: 'loyalty-card',
    title: (text) => text.loyaltyCard,
    symbol: 'creditcard',
    request: {},
  },
  {
    id: 'task-new',
    title: (text) => text.addTask,
    symbol: 'checklist',
    request: { action: 'task-new' },
  },
  {
    id: 'quick',
    title: (text) => text.quick,
    symbol: 'plus.circle',
    request: {},
  },
]

/** The menu's items in `t`'s language. */
export function homeScreenActionItems(t: Messages): Action[] {
  return HOME_SCREEN_ACTIONS.map(({ id, title, symbol }) => ({
    id,
    title: title(t.shell.homeScreenActions),
    icon: `symbol:${symbol}`,
  }))
}

/**
 * What a chosen item asks of the quick-actions sheet. Null for an id this
 * build does not know (an item set by another version).
 */
export function homeScreenActionRequest(id: string): QuickSheetRequest | null {
  const action = HOME_SCREEN_ACTIONS.find((candidate) => candidate.id === id)
  return action ? { ...action.request } : null
}
