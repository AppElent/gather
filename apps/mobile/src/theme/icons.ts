/**
 * The thirteen Module glyphs, plus the handful the chrome needs (ADR-0017).
 *
 * The web's `Icon.tsx` reaches lucide with `import * as Icons`. Doing that here
 * would hand Metro a 24.8 MB, 9,131-file package it does not tree-shake, so
 * every name is a **deep import** — `lucide-react-native/icons/<kebab-name>` —
 * and the bundle carries exactly the icons listed below.
 *
 * A named import off the barrel would be no better than the star: the barrel is
 * still one module that imports all 9,131. The deep path is the whole point.
 *
 * `MODULE_ICONS` is checked with `satisfies Record<ModuleIconName, LucideIcon>`,
 * so a Module declared with a name that is not in the union fails the build
 * instead of rendering an empty square.
 */

import type { ModuleIconName } from '@gather/core/modules'
import type { LucideIcon } from 'lucide-react-native'
import Apple from 'lucide-react-native/icons/apple'
import Baby from 'lucide-react-native/icons/baby'
import Calendar from 'lucide-react-native/icons/calendar'
import CalendarHeart from 'lucide-react-native/icons/calendar-heart'
// Chrome. Not Modules, so deliberately kept out of the union below.
import Check from 'lucide-react-native/icons/check'
import ChefHat from 'lucide-react-native/icons/chef-hat'
import ChevronLeft from 'lucide-react-native/icons/chevron-left'
import CircleAlert from 'lucide-react-native/icons/circle-alert'
import Eye from 'lucide-react-native/icons/eye'
import EyeOff from 'lucide-react-native/icons/eye-off'
import Grape from 'lucide-react-native/icons/grape'
import ListChecks from 'lucide-react-native/icons/list-checks'
import NotebookPen from 'lucide-react-native/icons/notebook-pen'
import Receipt from 'lucide-react-native/icons/receipt'
import Refrigerator from 'lucide-react-native/icons/refrigerator'
import ShoppingCart from 'lucide-react-native/icons/shopping-cart'
import Wallet from 'lucide-react-native/icons/wallet'
import Wine from 'lucide-react-native/icons/wine'

/**
 * ADR-0017's narrowing of `ModuleDef.icon` from `string`. The names are the
 * web's, because the glyphs are identical and a Module should not have to say
 * which client is asking.
 */
export const MODULE_ICONS = {
  Apple,
  Baby,
  Calendar,
  CalendarHeart,
  ChefHat,
  Grape,
  ListChecks,
  NotebookPen,
  Receipt,
  Refrigerator,
  ShoppingCart,
  Wallet,
  Wine,
} satisfies Record<ModuleIconName, LucideIcon>

export const UI_ICONS = {
  Check,
  ChevronLeft,
  CircleAlert,
  Eye,
  EyeOff,
} satisfies Record<string, LucideIcon>
