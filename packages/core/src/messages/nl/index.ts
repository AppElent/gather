import type { Messages } from '../en'
import { baby } from './baby'
import { common } from './common'
import { finances } from './finances'
import { foods } from './foods'
import { modules } from './modules'
import { notes } from './notes'
import { nutrients } from './nutrients'
import { nutrition } from './nutrition'
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
  tastings,
  settings,
} satisfies Messages
