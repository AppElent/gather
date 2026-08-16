/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The chrome glyphs the three variants need, kept out of `theme/icons.ts` so
 * deleting this folder deletes the whole prototype. Deep imports for the same
 * reason the real map uses them: the barrel pulls all 9,131 icons into Metro.
 */
import type { LucideIcon } from 'lucide-react-native'
import House from 'lucide-react-native/icons/house'
import LayoutGrid from 'lucide-react-native/icons/layout-grid'
import Plus from 'lucide-react-native/icons/plus'
import Search from 'lucide-react-native/icons/search'
import SquarePen from 'lucide-react-native/icons/square-pen'
import User from 'lucide-react-native/icons/user'
import X from 'lucide-react-native/icons/x'

export const PROTO_ICONS = {
  House,
  LayoutGrid,
  Plus,
  Search,
  SquarePen,
  User,
  X,
} satisfies Record<string, LucideIcon>
