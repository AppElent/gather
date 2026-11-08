/**
 * The Module's own glyphs, deep-imported for the reason `theme/icons.ts` gives.
 *
 * Each is a `glyph(lucide, sfSymbol)` pair: iOS draws the symbol, Android draws
 * the SVG, and no call site knows which.
 */
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
  Alert: glyph(TriangleAlert, 'exclamationmark.triangle.fill'),
} satisfies Record<string, Glyph>
