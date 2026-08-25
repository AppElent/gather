/**
 * The glyphs the tasting Modules' own chrome needs, plus one per Kind.
 *
 * Deep imports, for the reason `theme/icons.ts` gives at length: the lucide
 * barrel is one module that imports all 9,131 icons and Metro does not
 * tree-shake it.
 *
 * `KIND_ICONS` is the Module's own icon from the shared catalogue, reached by
 * Kind rather than by Module id so a screen that already knows it is showing
 * wine does not have to go back through `MODULES` for a picture.
 */
import type { TastingKind } from '@gather/core/tastings'
import Beer from 'lucide-react-native/icons/beer'
import Calendar from 'lucide-react-native/icons/calendar'
import Camera from 'lucide-react-native/icons/camera'
import Ellipsis from 'lucide-react-native/icons/ellipsis'
import Grape from 'lucide-react-native/icons/grape'
import Image from 'lucide-react-native/icons/image'
import ImagePlus from 'lucide-react-native/icons/image-plus'
import Plus from 'lucide-react-native/icons/plus'
import Star from 'lucide-react-native/icons/star'
import Trash2 from 'lucide-react-native/icons/trash-2'
import Wine from 'lucide-react-native/icons/wine'

import { type Glyph, glyph } from '../../theme/glyph'

export const KIND_ICONS = {
  // No SF Symbol means cheese or beer, and reaching for one that means
  // "grapes" or "a mug of something hot" would be worse than keeping the
  // lucide glyph — the same call `theme/icons.ts` makes for these two.
  cheese: glyph(Grape, null),
  wine: glyph(Wine, 'wineglass'),
  beer: glyph(Beer, null),
} satisfies Record<TastingKind, Glyph>

export const TASTING_UI_ICONS = {
  Calendar: glyph(Calendar, 'calendar'),
  Camera: glyph(Camera, 'camera'),
  Ellipsis: glyph(Ellipsis, 'ellipsis'),
  Image: glyph(Image, 'photo'),
  ImagePlus: glyph(ImagePlus, 'photo.badge.plus'),
  Plus: glyph(Plus, 'plus'),
  Star: glyph(Star, 'star'),
  Trash2: glyph(Trash2, 'trash'),
} satisfies Record<string, Glyph>
