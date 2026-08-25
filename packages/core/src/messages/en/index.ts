import { baby } from './baby'
import { common } from './common'
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

/**
 * One area per surface, plus two that cut across them.
 *
 * `common` is vocabulary every screen shares. `nutrients` is the nutrient names
 * and where a set of figures came from — read by Recipes, Nutrition and Foods
 * alike, which is why it is not inside any of the three. `nutrition` beside it
 * is the food-diary module itself; the two are easy to confuse and are kept
 * apart because one is a shared glossary and the other is a screen.
 */
export const en = {
  common,
  shell,
  modules,
  notes,
  nutrients,
  recipes,
  nutrition,
  foods,
  tasks,
  baby,
  tastings,
  settings,
}

/**
 * The shape every other locale has to have. English is the source language:
 * a string is written here first, and every other locale's file `satisfies`
 * this, so a missing or stray key is a typecheck failure rather than a hole
 * somebody notices in production.
 */
export type Messages = typeof en
