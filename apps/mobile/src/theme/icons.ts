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
 * Each entry is a `glyph(lucide, sfSymbol)` pair rather than the lucide icon
 * on its own: Android draws the SVG, iOS draws the symbol, and the call sites
 * do not know which (see `theme/glyph.tsx`). `null` where the SF catalogue has
 * no honest equivalent.
 *
 * `MODULE_ICONS` is checked with `satisfies Record<ModuleIconName, Glyph>`, so
 * a Module declared with a name that is not in the union fails the build
 * instead of rendering an empty square.
 */

import type { ModuleIconName } from '@gather/core/modules'
import Apple from 'lucide-react-native/icons/apple'
import Baby from 'lucide-react-native/icons/baby'
import Beer from 'lucide-react-native/icons/beer'
import Calendar from 'lucide-react-native/icons/calendar'
import CalendarHeart from 'lucide-react-native/icons/calendar-heart'
import Camera from 'lucide-react-native/icons/camera'
// Chrome. Not Modules, so deliberately kept out of the union below.
import Check from 'lucide-react-native/icons/check'
import ChefHat from 'lucide-react-native/icons/chef-hat'
import ChevronDown from 'lucide-react-native/icons/chevron-down'
import ChevronLeft from 'lucide-react-native/icons/chevron-left'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import ChevronUp from 'lucide-react-native/icons/chevron-up'
import CircleAlert from 'lucide-react-native/icons/circle-alert'
import CircleMinus from 'lucide-react-native/icons/circle-minus'
import CirclePlus from 'lucide-react-native/icons/circle-plus'
import Ellipsis from 'lucide-react-native/icons/ellipsis'
import Eye from 'lucide-react-native/icons/eye'
import EyeOff from 'lucide-react-native/icons/eye-off'
import Grape from 'lucide-react-native/icons/grape'
import GripVertical from 'lucide-react-native/icons/grip-vertical'
import ImagePlus from 'lucide-react-native/icons/image-plus'
import KeyRound from 'lucide-react-native/icons/key-round'
import Grid from 'lucide-react-native/icons/layout-grid'
import List from 'lucide-react-native/icons/list'
import ListChecks from 'lucide-react-native/icons/list-checks'
import Mail from 'lucide-react-native/icons/mail'
import NotebookPen from 'lucide-react-native/icons/notebook-pen'
import Pencil from 'lucide-react-native/icons/pencil'
import Pin from 'lucide-react-native/icons/pin'
import PinOff from 'lucide-react-native/icons/pin-off'
import Refrigerator from 'lucide-react-native/icons/refrigerator'
import Search from 'lucide-react-native/icons/search'
import Settings from 'lucide-react-native/icons/settings'
import ShoppingCart from 'lucide-react-native/icons/shopping-cart'
import Smartphone from 'lucide-react-native/icons/smartphone'
import Trash2 from 'lucide-react-native/icons/trash-2'
import User from 'lucide-react-native/icons/user'
import Wallet from 'lucide-react-native/icons/wallet'
import Wine from 'lucide-react-native/icons/wine'
import X from 'lucide-react-native/icons/x'

import { type Glyph, glyph } from './glyph'

/**
 * ADR-0017's narrowing of `ModuleDef.icon` from `string`. The names are the
 * web's, because the glyphs are identical and a Module should not have to say
 * which client is asking.
 */
export const MODULE_ICONS = {
  Apple: glyph(Apple, 'carrot'),
  Baby: glyph(Baby, 'figure.and.child.holdinghands'),
  // Beers. `mug.fill` is the nearest the SF catalogue has and it means a mug
  // of something hot, so this keeps the lucide glyph for `Grape`'s reason:
  // a symbol that draws the wrong drink is worse than one that draws the SVG.
  Beer: glyph(Beer, null),
  Calendar: glyph(Calendar, 'calendar'),
  CalendarHeart: glyph(CalendarHeart, 'menucard'),
  ChefHat: glyph(ChefHat, 'fork.knife'),
  // Cheeses. There is no SF Symbol that means cheese, and reaching for one
  // that means "grapes" or "a basket" would be worse than keeping the lucide
  // glyph, which at least means what it draws.
  Grape: glyph(Grape, null),
  ListChecks: glyph(ListChecks, 'checklist'),
  NotebookPen: glyph(NotebookPen, 'square.and.pencil'),
  Refrigerator: glyph(Refrigerator, 'refrigerator'),
  ShoppingCart: glyph(ShoppingCart, 'cart'),
  Wallet: glyph(Wallet, 'creditcard'),
  Wine: glyph(Wine, 'wineglass'),
} satisfies Record<ModuleIconName, Glyph>

export const UI_ICONS = {
  /** The shared photo row's two answers: take one, or pick one. */
  Camera: glyph(Camera, 'camera'),
  ImagePlus: glyph(ImagePlus, 'photo.badge.plus'),
  Check: glyph(Check, 'checkmark'),
  ChevronDown: glyph(ChevronDown, 'chevron.down'),
  ChevronLeft: glyph(ChevronLeft, 'chevron.left'),
  ChevronRight: glyph(ChevronRight, 'chevron.right'),
  /** Rearranging an ordered list, one row at a time. */
  ChevronUp: glyph(ChevronUp, 'chevron.up'),
  CircleAlert: glyph(CircleAlert, 'exclamationmark.circle'),
  /**
   * Edit mode's two verbs, drawn the way iOS draws them in an editing list:
   * filled circles, red to take away and green to put back, so the pair reads
   * at a glance without either one being a word.
   */
  CircleMinus: glyph(CircleMinus, 'minus.circle.fill'),
  CirclePlus: glyph(CirclePlus, 'plus.circle.fill'),
  /**
   * The All screen's nav-bar menu: view, and the way into Edit.
   *
   * Bare `ellipsis`, not `ellipsis.circle`. iOS 26 draws a nav-bar button on
   * its own glass circle, so the circled symbol lands a ring inside a ring -
   * Mail and Files both put three plain dots in that button.
   */
  Ellipsis: glyph(Ellipsis, 'ellipsis'),
  /** The Settings tab's Modules group, and All's two ways to draw itself. */
  Grid: glyph(Grid, 'square.grid.2x2'),
  List: glyph(List, 'list.bullet'),
  GripVertical: glyph(GripVertical, 'line.3.horizontal'),
  Eye: glyph(Eye, 'eye'),
  EyeOff: glyph(EyeOff, 'eye.slash'),
  /** Changing a password. */
  KeyRound: glyph(KeyRound, 'key'),
  /**
   * A Pin, which is what this app calls the thing other apps call a favourite
   * (CONTEXT.md). Never a heart.
   */
  Pin: glyph(Pin, 'pin'),
  /**
   * The same Pin, stuck in. SF Symbols say "on" with a different symbol rather
   * than a `fill` prop, so the pair is two entries here and lucide's one icon
   * takes `fill` at the call site (see `glyph`).
   */
  PinFill: glyph(Pin, 'pin.fill'),
  PinOff: glyph(PinOff, 'pin.slash'),
  /** The email addresses on an account. */
  Mail: glyph(Mail, 'envelope'),
  /** Edit, where a row already does something else when pressed. */
  Pencil: glyph(Pencil, 'pencil'),
  Search: glyph(Search, 'magnifyingglass'),
  Settings: glyph(Settings, 'gearshape'),
  /** The two Settings groups: what follows you, and what stays on this phone. */
  Smartphone: glyph(Smartphone, 'iphone'),
  /** Destroying something for good — deleting an account, and nothing else. */
  Trash2: glyph(Trash2, 'trash'),
  User: glyph(User, 'person.crop.circle'),
  X: glyph(X, 'xmark'),
} satisfies Record<string, Glyph>
