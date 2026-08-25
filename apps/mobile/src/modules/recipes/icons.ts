/**
 * The glyphs Recipes needs and the chrome does not, deep-imported for the
 * reason `theme/icons.ts` explains at length: the lucide barrel is 9,131
 * modules Metro will not tree-shake, so every icon is named by its own path.
 */
import ChefHat from 'lucide-react-native/icons/chef-hat'
import ExternalLink from 'lucide-react-native/icons/external-link'
import Plus from 'lucide-react-native/icons/plus'
import Star from 'lucide-react-native/icons/star'
import Trash2 from 'lucide-react-native/icons/trash-2'

import { type Glyph, glyph } from '../../theme/glyph'

export const RECIPE_UI_ICONS = {
  /** A recipe with no picture, and the Module's own mark. */
  ChefHat: glyph(ChefHat, 'fork.knife'),
  ExternalLink: glyph(ExternalLink, 'arrow.up.right.square'),
  Plus: glyph(Plus, 'plus'),
  /**
   * Two entries for one lucide icon: iOS says "filled" with a different
   * symbol, Android says it with the `fill` prop (see `theme/glyph.tsx`).
   */
  Star: glyph(Star, 'star'),
  StarFilled: glyph(Star, 'star.fill'),
  Trash2: glyph(Trash2, 'trash'),
} satisfies Record<string, Glyph>
