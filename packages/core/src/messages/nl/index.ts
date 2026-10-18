import type { Messages } from '../en'
import { auth } from './auth'
import { baby } from './baby'
import { calendar } from './calendar'
import { common } from './common'
import { finances } from './finances'
import { foods } from './foods'
import { modules } from './modules'
import { notes } from './notes'
import { nutrients } from './nutrients'
import { nutrition } from './nutrition'
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
  nutrients,
  recipes,
  nutrition,
  foods,
  finances,
  tasks,
  baby,
  calendar,
  tastings,
  settings,
  privacy,
  auth,
} satisfies Messages
