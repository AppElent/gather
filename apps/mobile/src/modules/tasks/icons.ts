/**
 * The glyphs the Tasks screens need beyond `UI_ICONS`, and nothing else.
 *
 * Same rule as `theme/icons.ts` and the Baby log's own set: deep imports, one
 * `glyph(lucide, sfSymbol)` pair each, so the bundle carries exactly what is
 * listed here and an iPhone draws its own symbols rather than someone else's
 * stroke icons.
 */


import type { TaskListIcon } from '@gather/core/task-lists'
import Banknote from 'lucide-react-native/icons/banknote'
import Bell from 'lucide-react-native/icons/bell'
import Calendar from 'lucide-react-native/icons/calendar'
import CircleCheck from 'lucide-react-native/icons/circle-check'
import FileText from 'lucide-react-native/icons/file-text'
import Files from 'lucide-react-native/icons/files'
import Flag from 'lucide-react-native/icons/flag'
import Gift from 'lucide-react-native/icons/gift'
import House from 'lucide-react-native/icons/house'
import Link from 'lucide-react-native/icons/link'
import List from 'lucide-react-native/icons/list'
import Luggage from 'lucide-react-native/icons/luggage'
import RotateCcw from 'lucide-react-native/icons/rotate-ccw'
import ShoppingCart from 'lucide-react-native/icons/shopping-cart'
import Sparkles from 'lucide-react-native/icons/sparkles'
import Tag from 'lucide-react-native/icons/tag'
import Trash2 from 'lucide-react-native/icons/trash-2'

import { type Glyph, glyph } from '../../theme/glyph'

export const TASK_ICONS = {
  /** A task's reminder (APP-305). */
  Bell: glyph(Bell, 'bell'),
  Calendar: glyph(Calendar, 'calendar'),
  CircleCheck: glyph(CircleCheck, 'checkmark.circle'),
  FileText: glyph(FileText, 'doc.text'),
  Flag: glyph(Flag, 'flag'),
  /** A list that lives in Notion or Todoist rather than in Gather. */
  Link: glyph(Link, 'link'),
  Price: glyph(Banknote, 'banknote'),
  Reset: glyph(RotateCcw, 'arrow.counterclockwise'),
  Tag: glyph(Tag, 'tag'),
  Trash2: glyph(Trash2, 'trash'),
} satisfies Record<string, Glyph>

/**
 * A list's tile glyph (APP-306): the short set `@gather/core/task-lists`
 * names, each with its SF Symbol. Keyed by the stored id, so an icon added to
 * the set is a type error here until it has a glyph.
 */
export const TASK_LIST_GLYPHS = {
  list: glyph(List, 'list.bullet'),
  sparkles: glyph(Sparkles, 'sparkles'),
  suitcase: glyph(Luggage, 'suitcase'),
  cart: glyph(ShoppingCart, 'cart'),
  gift: glyph(Gift, 'gift'),
  house: glyph(House, 'house'),
  papers: glyph(Files, 'doc.on.doc'),
} satisfies Record<TaskListIcon, Glyph>
