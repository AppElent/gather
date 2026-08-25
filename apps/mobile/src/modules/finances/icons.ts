/**
 * The Module's own glyphs, deep-imported for the reason `theme/icons.ts` gives.
 *
 * Each is a `glyph(lucide, sfSymbol)` pair: iOS draws the symbol, Android draws
 * the SVG, and no call site knows which.
 */
import ArrowDownRight from 'lucide-react-native/icons/arrow-down-right'
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right'
import Bookmark from 'lucide-react-native/icons/bookmark'
import ChartLine from 'lucide-react-native/icons/chart-line'
import Clock from 'lucide-react-native/icons/clock'
import House from 'lucide-react-native/icons/house'
import Key from 'lucide-react-native/icons/key-round'
import Plus from 'lucide-react-native/icons/plus'
import Repeat from 'lucide-react-native/icons/repeat'
import Scale from 'lucide-react-native/icons/scale'
import Target from 'lucide-react-native/icons/target'
import TriangleAlert from 'lucide-react-native/icons/triangle-alert'
import Users from 'lucide-react-native/icons/users'

import { type Glyph, glyph } from '../../theme/glyph'

export const FINANCE_ICONS = {
  House: glyph(House, 'house.fill'),
  Key: glyph(Key, 'key.fill'),
  Repeat: glyph(Repeat, 'repeat'),
  Target: glyph(Target, 'target'),
  Users: glyph(Users, 'person.2.fill'),
  Chart: glyph(ChartLine, 'chart.line.uptrend.xyaxis'),
  Scale: glyph(Scale, 'scalemass.fill'),
  Clock: glyph(Clock, 'clock'),
  Plus: glyph(Plus, 'plus'),
  Bookmark: glyph(Bookmark, 'bookmark.fill'),
  Alert: glyph(TriangleAlert, 'exclamationmark.triangle.fill'),
  Up: glyph(ArrowUpRight, 'arrow.up.right'),
  Down: glyph(ArrowDownRight, 'arrow.down.right'),
} satisfies Record<string, Glyph>
