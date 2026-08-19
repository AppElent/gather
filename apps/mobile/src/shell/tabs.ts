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
  name: 'home' | 'search' | 'add' | 'settings' | 'all'
  /** iOS. `selected` gives the filled variant the platform expects. */
  sf: { default: SFSymbolName; selected: SFSymbolName }
  /** Android. */
  md: MaterialSymbolName
  label: (messages: Messages) => string
}

export const SHELL_TABS = [
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
    label: (t) => t.shell.tabs.search,
  },
  {
    name: 'add',
    sf: { default: 'plus.circle', selected: 'plus.circle.fill' },
    md: 'add_circle',
    label: (t) => t.shell.tabs.add,
  },
  {
    /**
     * Settings, not Profile. The profile is one thing a person changes about
     * Gather and there are going to be many more, so the tab is named for the
     * whole of them and the identity sits at the top of its list.
     */
    name: 'settings',
    sf: { default: 'gearshape', selected: 'gearshape.fill' },
    md: 'settings',
    label: (t) => t.shell.tabs.settings,
  },
  {
    name: 'all',
    sf: { default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' },
    md: 'apps',
    label: (t) => t.shell.tabs.all,
  },
] as const satisfies readonly ShellTab[]
