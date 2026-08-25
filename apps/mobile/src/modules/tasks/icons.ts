/**
 * The glyphs the Tasks and Notes taskActionss need, and nothing else.
 *
 * Same rule as `theme/icons.ts` and the Baby log's own set: deep imports, one
 * `glyph(lucide, sfSymbol)` pair each, so the bundle carries exactly what is
 * listed here and an iPhone draws its own symbols rather than someone else's
 * stroke icons.
 *
 * It lives beside the taskActionss rather than in `theme/icons.ts` because that
 * file is the app's vocabulary and this is a lab. When a Module ships, its
 * glyphs move up into `theme/icons.ts` and this file loses them.
 */
import ArrowUpDown from 'lucide-react-native/icons/arrow-up-down'
import Calendar from 'lucide-react-native/icons/calendar'
import CircleCheck from 'lucide-react-native/icons/circle-check'
import Ellipsis from 'lucide-react-native/icons/ellipsis'
import FileText from 'lucide-react-native/icons/file-text'
import Flag from 'lucide-react-native/icons/flag'
import FlaskConical from 'lucide-react-native/icons/flask-conical'
import Link from 'lucide-react-native/icons/link'
import Pin from 'lucide-react-native/icons/pin'
import Plus from 'lucide-react-native/icons/plus'
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal'
import Tag from 'lucide-react-native/icons/tag'
import Trash2 from 'lucide-react-native/icons/trash-2'

import { type Glyph, glyph } from '../../theme/glyph'

export const TASK_ICONS = {
  /** Settings' Labs group, and the only one of these the shell ever draws. */
  Flask: glyph(FlaskConical, 'flask'),
  ArrowUpDown: glyph(ArrowUpDown, 'arrow.up.arrow.down'),
  Calendar: glyph(Calendar, 'calendar'),
  CircleCheck: glyph(CircleCheck, 'checkmark.circle'),
  /** The list's own menu, at the right of the nav bar. */
  Ellipsis: glyph(Ellipsis, 'ellipsis'),
  FileText: glyph(FileText, 'doc.text'),
  Flag: glyph(Flag, 'flag'),
  /** A list that lives in Notion or Todoist rather than in Gather. */
  Link: glyph(Link, 'link'),
  Pin: glyph(Pin, 'pin'),
  Plus: glyph(Plus, 'plus'),
  /** Which properties a row shows. */
  Sliders: glyph(SlidersHorizontal, 'slider.horizontal.3'),
  Tag: glyph(Tag, 'tag'),
  Trash2: glyph(Trash2, 'trash'),
} satisfies Record<string, Glyph>
