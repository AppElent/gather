import type { Messages } from '../en'
import { baby } from './baby'
import { common } from './common'
import { foods } from './foods'
import { modules } from './modules'
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
  nutrients,
  recipes,
  nutrition,
  foods,
  tasks,
  baby,
  tastings,
  settings,
} satisfies Messages
