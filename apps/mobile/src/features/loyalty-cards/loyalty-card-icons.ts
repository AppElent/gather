/**
 * The glyphs Loyalty cards needs and the chrome does not, deep-imported for
 * the reason `theme/icons.ts` gives: the lucide barrel is thousands of modules
 * Metro will not tree-shake, so every icon is named by its own path.
 */
import Keyboard from 'lucide-react-native/icons/keyboard'
import ScanBarcode from 'lucide-react-native/icons/scan-barcode'
import Store from 'lucide-react-native/icons/store'
import Trash2 from 'lucide-react-native/icons/trash-2'

import { type Glyph, glyph } from '../../theme/glyph'

export const LOYALTY_CARD_ICONS = {
  /** Scanning a card with the camera. */
  ScanBarcode: glyph(ScanBarcode, 'barcode.viewfinder'),
  /** Typing the number by hand instead. */
  Keyboard: glyph(Keyboard, 'keyboard'),
  /** A store that is not in the Retailer catalog. */
  Store: glyph(Store, 'storefront'),
  Trash2: glyph(Trash2, 'trash'),
} satisfies Record<string, Glyph>
