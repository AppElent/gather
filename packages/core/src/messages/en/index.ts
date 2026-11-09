import { auth } from './auth'
import { baby } from './baby'
import { calendar } from './calendar'
import { common } from './common'
import { finances } from './finances'
import { modules } from './modules'
import { notes } from './notes'
import { nutrients } from './nutrients'
import { privacy } from './privacy'
import { recipes } from './recipes'
import { settings } from './settings'
import { shell } from './shell'
import { tasks } from './tasks'
import { tastings } from './tastings'

/**
 * One area per surface, plus two that cut across them.
 *
 * `common` is vocabulary every screen shares. `nutrients` is the nutrient names
 * and where a set of figures came from, read by a recipe's nutrition panel.
 */
export const en = {
  common,
  shell,
  modules,
  notes,
  nutrients,
  recipes,
  finances,
  tasks,
  baby,
  calendar,
  tastings,
  settings,
  auth,
  privacy,
}

/**
 * The shape every other locale has to have. English is the source language:
 * a string is written here first, and every other locale's file `satisfies`
 * this, so a missing or stray key is a typecheck failure rather than a hole
 * somebody notices in production.
 */
export type Messages = typeof en
