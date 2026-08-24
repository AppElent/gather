/**
 * One glyph per event type, plus the handful the Baby log's own chrome needs.
 *
 * Deep imports, for the reason `theme/icons.ts` gives at length: the barrel is
 * one module that imports all 9,131 icons and Metro does not tree-shake it, so
 * the bundle carries exactly what is listed here.
 *
 * The lucide names are the web's (`src/lib/babyEventFields.ts`), because the
 * glyph for a diaper should not depend on which client is asking (ADR-0017).
 * The SF Symbol beside each is the phone's own word for the same thing, and
 * only iOS ever sees it — see `theme/glyph.tsx`.
 */
import type { BabyEventType } from '@gather/core/domain'
import Baby from 'lucide-react-native/icons/baby'
import CalendarClock from 'lucide-react-native/icons/calendar-clock'
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark'
import FileDown from 'lucide-react-native/icons/file-down'
import ListChecks from 'lucide-react-native/icons/list-checks'
import Milk from 'lucide-react-native/icons/milk'
import Moon from 'lucide-react-native/icons/moon'
import NotebookPen from 'lucide-react-native/icons/notebook-pen'
import Pill from 'lucide-react-native/icons/pill'
import Plus from 'lucide-react-native/icons/plus'
import Ruler from 'lucide-react-native/icons/ruler'
import Sparkles from 'lucide-react-native/icons/sparkles'
import Syringe from 'lucide-react-native/icons/syringe'
import Thermometer from 'lucide-react-native/icons/thermometer'
import Trash2 from 'lucide-react-native/icons/trash-2'
import TrendingUp from 'lucide-react-native/icons/trending-up'

import { type Glyph, glyph } from '../../theme/glyph'

export const EVENT_ICONS = {
  temperature: glyph(Thermometer, 'thermometer.medium'),
  feeding: glyph(Milk, 'cup.and.saucer'),
  diaper: glyph(Baby, 'figure.and.child.holdinghands'),
  sleep: glyph(Moon, 'moon.zzz'),
  growth: glyph(Ruler, 'ruler'),
  medication: glyph(Pill, 'pills'),
  vaccination: glyph(Syringe, 'syringe'),
  note: glyph(NotebookPen, 'square.and.pencil'),
  memory: glyph(Sparkles, 'sparkles'),
} satisfies Record<BabyEventType, Glyph>

export const BABY_UI_ICONS = {
  Baby: glyph(Baby, 'figure.and.child.holdinghands'),
  CalendarClock: glyph(CalendarClock, 'calendar.badge.clock'),
  CircleQuestionMark: glyph(CircleQuestionMark, 'questionmark.circle'),
  FileDown: glyph(FileDown, 'square.and.arrow.down'),
  ListChecks: glyph(ListChecks, 'checklist'),
  Plus: glyph(Plus, 'plus'),
  Trash2: glyph(Trash2, 'trash'),
  TrendingUp: glyph(TrendingUp, 'chart.line.uptrend.xyaxis'),
} satisfies Record<string, Glyph>
