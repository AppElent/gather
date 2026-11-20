import type { Messages } from '../en'
import { auth } from './auth'
import { baby } from './baby'
import { calendar } from './calendar'
import { common } from './common'
import { finances } from './finances'
import { loyaltyCards } from './loyaltyCards'
import { mcpViews } from './mcpViews'
import { mealPreferences } from './mealPreferences'
import { modules } from './modules'
import { notes } from './notes'
import { notifications } from './notifications'
import { nutrients } from './nutrients'
import { privacy } from './privacy'
import { recipes } from './recipes'
import { settings } from './settings'
import { shell } from './shell'
import { tasks } from './tasks'
import { tastings } from './tastings'

export const nl = {
  common,
  shell,
  modules,
  notes,
  notifications,
  nutrients,
  recipes,
  finances,
  tasks,
  baby,
  calendar,
  tastings,
  loyaltyCards,
  mealPreferences,
  settings,
  auth,
  privacy,
  mcpViews,
} satisfies Messages
