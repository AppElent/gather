/**
 * The five ways gather could present the Add launcher.
 *
 * Deleted with the rest of `src/lab/` once the decision lands in
 * `docs/mobile-interaction.md`.
 *
 * Three of them are `expo-router` form sheets and differ only in their
 * presentation options, so they are three routes rather than one route with
 * dynamic options: `presentation` is read when the screen is registered, and a
 * lab that changed it at runtime would be measuring the lab.
 */

export const SHEET_VARIANTS = [
  'modal',
  'detents',
  'fit',
  'undimmed',
  'expo-ui',
] as const
export type SheetVariant = (typeof SHEET_VARIANTS)[number]

export interface VariantInfo {
  label: string
  /** What it is, in one line, for the person holding the phone. */
  what: string
  /** The specific thing to judge. */
  watch: string
  /** Where it lives: a pushed route, or drawn on the lab screen itself. */
  route: '/lab/sheet-detents' | '/lab/sheet-fit' | '/lab/sheet-undimmed' | null
}

export const VARIANTS: Record<SheetVariant, VariantInfo> = {
  modal: {
    label: "Today's modal",
    what: 'The hand-built Modal that QuickActionSheet uses right now.',
    watch:
      'The baseline. No drag, no resize, no native material — this is what the others have to beat.',
    route: null,
  },
  detents: {
    label: 'formSheet, detents',
    what: 'A route presented as a form sheet at half height, expandable to full. The switch-group configuration.',
    watch: 'Does the tab selection move? Do you come back to the same screen?',
    route: '/lab/sheet-detents',
  },
  fit: {
    label: 'formSheet, fits content',
    what: 'The same, sized exactly to whatever is inside it, with no detents.',
    watch: 'Does it resize when the row expands, or when the keyboard opens?',
    route: '/lab/sheet-fit',
  },
  undimmed: {
    label: 'formSheet, undimmed',
    what: 'Half height, but the screen behind stays lit and tappable.',
    watch:
      'Does leaving the app visible behind it feel better or more confusing?',
    route: '/lab/sheet-undimmed',
  },
  'expo-ui': {
    label: '@expo/ui BottomSheet',
    what: 'A SwiftUI sheet with no address, opened over the lab screen itself.',
    watch:
      'Compare directly against "formSheet, detents" — this is the real fork.',
    route: null,
  },
}
