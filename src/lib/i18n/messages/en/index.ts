import { common } from './common'
import { modules } from './modules'
import { settings } from './settings'
import { shell } from './shell'

export const en = { common, shell, modules, settings }

/**
 * The shape every other locale has to have. English is the source language:
 * a string is written here first, and every other locale's file `satisfies`
 * this, so a missing or stray key is a typecheck failure rather than a hole
 * somebody notices in production.
 */
export type Messages = typeof en
