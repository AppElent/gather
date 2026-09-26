/**
 * A cheese wedge, drawn to lucide's grid (24×24, round 2px strokes) because
 * lucide has no cheese and SF Symbols has nothing that means one. The Cheeses
 * Module used lucide's grape bunch, which read as Wine at a glance.
 */
import Svg, { Circle, Path } from 'react-native-svg'

import type { GlyphProps } from './glyph'

export function CheeseWedge({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  ...rest
}: GlyphProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <Path d="M2 11 15.5 4.5 22 11v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
      <Path d="M2 11h20" />
      <Circle cx={7.5} cy={15.5} r={1.5} />
      <Circle cx={16} cy={15} r={1} />
    </Svg>
  )
}
