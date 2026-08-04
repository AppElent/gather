import type { Messages } from '../en'
import { common } from './common'
import { modules } from './modules'
import { settings } from './settings'
import { shell } from './shell'

export const nl = { common, shell, modules, settings } satisfies Messages
