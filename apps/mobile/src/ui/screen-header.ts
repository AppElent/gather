/**
 * The two Tiles & Today screen tops, as native-stack options: what the
 * platform draws, so a screen never paints a title or a back pill itself.
 *
 * - **Wash** (`components/WashHeader`): a Module screen with no photo. The
 *   header is transparent over the group's wash, and the system large title
 *   collapses inline on scroll.
 * - **Photo** (`components/PhotoHeader`): a record with a photo. The photo runs
 *   full-bleed under a transparent header and its glass buttons; the title is
 *   drawn once in content, and the native inline title fades in only after
 *   that one has scrolled under the bar.
 *
 * Pure objects, so a test can hold the rules without a renderer.
 */

/** About 290 pt: the full-bleed photo on a record. */
export const PHOTO_HEIGHT = 290

/**
 * How far the wash reaches above its own box: past the large title, the
 * status bar and any pull-down overscroll, so the colour never ends in a seam.
 */
export const WASH_OVERSCROLL = 1000

/** The options of a Module screen with no photo. */
export function washScreenOptions(title: string) {
  return {
    headerShown: true,
    title,
    headerTransparent: true,
    headerLargeTitle: true,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
  } as const
}

/**
 * The options of a record screen while it loads or after it is gone. The
 * header is already transparent, as it will be once the record arrives:
 * a native-stack screen that turns transparent after mounting keeps the
 * content frame of its opaque bar.
 */
export function pendingScreenOptions(title: string) {
  return {
    headerShown: true,
    title,
    headerTransparent: true,
    headerLargeTitle: false,
    headerShadowVisible: false,
  } as const
}

/**
 * The options of a record with a photo. `titleShown` is false until the
 * in-content title has scrolled under the bar: the header `title` stays set
 * throughout (VoiceOver and the app switcher read it), and only its ink is
 * withheld, so there is never a second visible title.
 */
export function photoScreenOptions(
  title: string,
  titleShown: boolean,
  ink: string,
) {
  return {
    headerShown: true,
    title,
    headerTransparent: true,
    headerLargeTitle: false,
    headerShadowVisible: false,
    headerTitleStyle: { color: titleShown ? ink : 'transparent' },
  } as const
}

/**
 * Whether the record's own title has gone under the bar, so the inline one
 * should take over. `titleBottom` is the in-content title's bottom edge in
 * scroll-content coordinates; `barBottom` is where the navigation bar ends.
 */
export function inlineTitleShown(
  scrollY: number,
  titleBottom: number | null,
  barBottom: number,
): boolean {
  if (titleBottom === null) return false
  return scrollY + barBottom >= titleBottom
}
