/**
 * One glyph, drawn the way the platform draws glyphs.
 *
 * ADR-0017 gives every Module and every event type a lucide name, and that map
 * stays: it is the shared vocabulary, and it is what Android renders. What it
 * is not is what an iPhone looks like. SF Symbols are the system font's own
 * glyphs — they inherit the text weight, they use Apple's optical sizing, and
 * every other app on the phone is drawn from the same 6,000 of them. A lucide
 * stroke icon next to a native tab bar reads as "an app from somewhere else",
 * and the tab bar already proved the point: `shell/tabs.ts` has always carried
 * SF Symbols, because `NativeTabs` would not take anything else.
 *
 * So `glyph()` pairs each lucide icon with the SF Symbol that means the same
 * thing, and returns one component with lucide's prop shape. Call sites do not
 * change and do not branch — `<Icon size={20} color={tint.fg} />` renders an
 * SVG on Android and a symbol on iOS.
 *
 * Three things make this safe rather than a source of blank squares:
 *
 * - **The name is typed.** `SymbolViewProps['name']` is the
 *   `sf-symbols-typescript` union, so a symbol that does not exist fails
 *   `pnpm typecheck` instead of rendering nothing on a device.
 * - **`fallback` is always the lucide icon.** A symbol that exists but is
 *   newer than the phone's iOS draws the SVG rather than a hole.
 * - **`null` is a real answer.** Where the catalogue has nothing that means
 *   the thing — cheese — the pair is `null` and iOS keeps the lucide glyph,
 *   which is better than a symbol that means something else.
 *
 * `strokeWidth` has no equivalent and is not forwarded: SF Symbols carry
 * weight, not stroke. It is mapped, coarsely, because the two heaviest call
 * sites (chevrons at 2.2, the close button) do read as bolder.
 */
import { SymbolView, type SymbolViewProps } from 'expo-symbols'
import type { LucideIcon } from 'lucide-react-native'
import type { ComponentType } from 'react'
import type { AccessibilityProps } from 'react-native'

const IOS = process.env.EXPO_OS === 'ios'

/**
 * Lucide's prop shape, which is the one every call site in the app uses.
 *
 * The accessibility props ride along because an icon beside a label is
 * decoration, and half the call sites say so — `accessibilityElementsHidden`
 * and its Android twin. Both surfaces take them: a lucide icon is an SVG view
 * and `SymbolView` extends `ViewProps`.
 */
export type GlyphProps = AccessibilityProps & {
  size?: number
  color?: string
  strokeWidth?: number
}

export type Glyph = ComponentType<GlyphProps>

/** The typed SF Symbol union, taken from the props that consume it. */
export type SymbolName = Exclude<SymbolViewProps['name'], object>

export function glyph(fallback: LucideIcon, symbol: SymbolName | null): Glyph {
  if (!IOS || symbol === null) return fallback

  const Fallback = fallback

  return function SymbolGlyph({
    size = 24,
    color,
    strokeWidth,
    ...rest
  }: GlyphProps) {
    return (
      <SymbolView
        {...rest}
        name={symbol}
        size={size}
        tintColor={color}
        weight={(strokeWidth ?? 1.8) >= 2.2 ? 'semibold' : 'regular'}
        resizeMode="scaleAspectFit"
        style={{ width: size, height: size }}
        fallback={
          <Fallback size={size} color={color} strokeWidth={strokeWidth} />
        }
      />
    )
  }
}
