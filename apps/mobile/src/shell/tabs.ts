/**
 * The five slots, in order, and the only place they are written down.
 *
 * **Fixed for everybody, and stable across Groups.** ADR-0015's decisive
 * argument for keeping the tabs at the root is that the native tab set cannot
 * vary by Group anyway; #142 settled that the Pins therefore cannot be the
 * tabs. So this list is a constant, not a projection of anybody's Pins, and
 * pinning something else changes Home's content and never the bar. It is also
 * why a Group switch has no work to do here — only the nested stacks reset.
 *
 * Five is the web's `DOCK_SLOTS` and Android's ceiling, which is not a
 * coincidence: both clients are answering the same question about how many
 * destinations a thumb can hold.
 *
 * ## Why these icons are not the lucide ones
 *
 * ADR-0017 gives every Module a lucide glyph, and `theme/icons.ts` is the map.
 * A native tab bar cannot take one: `NativeTabs` renders a real `UITabBarItem`
 * / `BottomNavigationView`, whose icon is an SF Symbol on iOS and a bitmap on
 * Android, and lucide-react-native draws SVG in React. Handing it a React tree
 * is not an option the platform offers.
 *
 * So the bar takes the platform's own vocabulary — an SF Symbol on iOS, a
 * Material Symbol on Android — and the lucide map keeps every other surface.
 * Both are typed against their catalogue, so a name that does not exist fails
 * the build rather than rendering a blank square on the phone. Android's
 * symbol font is one `NativeTabs` already loads; an `@expo/vector-icons` glyph
 * would work too and would put a second 357 KB icon font in the bundle to do it.
 */
import type {
  MaterialIcon,
  NativeTabsTabBarItemRole,
  SFSymbolIcon,
} from 'expo-router/unstable-native-tabs'

import type { Messages } from '../i18n'

/**
 * Taken from the props rather than from `sf-symbols-typescript` and
 * `expo-symbols` directly: the bar accepts the symbols of one catalogue
 * version each, and borrowing either union from anywhere else would put the
 * failure at the layout instead of here.
 */
type SFSymbolName = Exclude<NonNullable<SFSymbolIcon['sf']>, object>
type MaterialSymbolName = Exclude<MaterialIcon['md'], object>

export interface ShellTab {
  /** The route segment under `app/(app)/(tabs)/`. */
  name: 'home' | 'search' | 'add' | 'profile' | 'all'
  /** iOS. `selected` gives the filled variant the platform expects. */
  sf: { default: SFSymbolName; selected: SFSymbolName }
  /** Android. */
  md: MaterialSymbolName
  /**
   * iOS only, and only where the platform has a stronger idea of the slot than
   * "one of five". `search` makes iOS 26 draw its own capsule beside the bar
   * rather than a fifth equal item — the platform drawing the thing ADR-0018
   * described, which is the whole reason the bar is native.
   */
  role?: NativeTabsTabBarItemRole
  label: (messages: Messages) => string
}

export const SHELL_TABS: readonly ShellTab[] = [
  {
    name: 'home',
    sf: { default: 'house', selected: 'house.fill' },
    md: 'home',
    label: (t) => t.shell.tabs.home,
  },
  {
    name: 'search',
    sf: { default: 'magnifyingglass', selected: 'magnifyingglass' },
    md: 'search',
    role: 'search',
    label: (t) => t.shell.tabs.search,
  },
  {
    name: 'add',
    sf: { default: 'plus.circle', selected: 'plus.circle.fill' },
    md: 'add_circle',
    label: (t) => t.shell.tabs.add,
  },
  {
    name: 'profile',
    sf: {
      default: 'person.crop.circle',
      selected: 'person.crop.circle.fill',
    },
    md: 'person',
    label: (t) => t.shell.tabs.profile,
  },
  {
    name: 'all',
    sf: { default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' },
    md: 'apps',
    label: (t) => t.shell.tabs.all,
  },
] as const
