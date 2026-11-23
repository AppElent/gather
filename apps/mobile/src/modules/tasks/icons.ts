/**
 * The glyphs the Tasks screens need beyond `UI_ICONS`, and nothing else.
 *
 * Same rule as `theme/icons.ts` and the Baby log's own set: deep imports, one
 * `glyph(lucide, sfSymbol)` pair each, so the bundle carries exactly what is
 * listed here and an iPhone draws its own symbols rather than someone else's
 * stroke icons.
 */


import type { SmartListId } from '@gather/core/smart-lists'
import type { TaskListIcon } from '@gather/core/task-lists'
import Banknote from 'lucide-react-native/icons/banknote'
import Bell from 'lucide-react-native/icons/bell'
import Calendar from 'lucide-react-native/icons/calendar'
import CircleCheck from 'lucide-react-native/icons/circle-check'
import FileText from 'lucide-react-native/icons/file-text'
import Files from 'lucide-react-native/icons/files'
import Flag from 'lucide-react-native/icons/flag'
import Gift from 'lucide-react-native/icons/gift'
import Hash from 'lucide-react-native/icons/hash'
import House from 'lucide-react-native/icons/house'
import Link from 'lucide-react-native/icons/link'
import List from 'lucide-react-native/icons/list'
import Luggage from 'lucide-react-native/icons/luggage'
import Repeat from 'lucide-react-native/icons/repeat'
import RotateCcw from 'lucide-react-native/icons/rotate-ccw'
import ShoppingCart from 'lucide-react-native/icons/shopping-cart'
import Sparkles from 'lucide-react-native/icons/sparkles'
import Sun from 'lucide-react-native/icons/sun'
import TableProperties from 'lucide-react-native/icons/table-properties'
import Tag from 'lucide-react-native/icons/tag'
import Text from 'lucide-react-native/icons/text'
import Trash2 from 'lucide-react-native/icons/trash-2'
import User from 'lucide-react-native/icons/user'
import UserPlus from 'lucide-react-native/icons/user-plus'

import { type Glyph, glyph } from '../../theme/glyph'

export const TASK_ICONS = {
  /** A task's reminder (APP-305). */
  Bell: glyph(Bell, 'bell'),
  Calendar: glyph(Calendar, 'calendar'),
  /** A grocery item's amount and aisle chips (APP-664). */
  Amount: glyph(Hash, 'number'),
  Aisle: glyph(TableProperties, 'tablecells'),
  CircleCheck: glyph(CircleCheck, 'checkmark.circle'),
  FileText: glyph(FileText, 'doc.text'),
  Flag: glyph(Flag, 'flag'),
  /** A list that lives in Notion or Todoist rather than in Gather. */
  Link: glyph(Link, 'link'),
  Price: glyph(Banknote, 'banknote'),
  /** A task that comes back once done (APP-303). */
  Repeat: glyph(Repeat, 'repeat'),
  Reset: glyph(RotateCcw, 'arrow.counterclockwise'),
  Tag: glyph(Tag, 'tag'),
  /** A task's description, from the keyboard composer (APP-587). */
  Description: glyph(Text, 'text.alignleft'),
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

/** A smart list's glyph on its `home` tile (APP-301). */
export const SMART_LIST_GLYPHS = {
  today: glyph(Sun, 'sun.max'),
  mine: glyph(User, 'person'),
  upcoming: glyph(Calendar, 'calendar'),
  unassigned: glyph(UserPlus, 'person.badge.plus'),
} satisfies Record<SmartListId, Glyph>
