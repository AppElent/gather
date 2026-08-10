# Collapsed icon picker

## Decision

`IconPicker` is collapsed by default. Its single trigger shows the selected
emoji, or the neutral `🍽️` placeholder when no icon is selected. Activating the
trigger opens a dedicated modal bottom sheet that is rendered outside the form's
layout.

The component is used by both the food form and the one-off form inside the
nutrition add sheet. It must therefore not use a food-specific placeholder.

## Interaction

- The trigger is a 44px button and names its action for assistive technology.
  It reports whether the picker is expanded.
- The sheet has a visible, accessible title and close action, an icon grid, and
  an explicit clear action only when an icon is selected.
- Choosing an icon or clearing it calls the existing `onChange` contract and
  closes the sheet. Dismissing the sheet does not change the selection.
- Escape, the close button, and the backdrop dismiss the sheet. Focus returns
  to the trigger.
- The icon set, stored values, and `null`-on-submit conversion remain unchanged.

## Architecture

The picker owns only temporary open/closed state. The sheet is portal-rendered
so it does not expand the food form and does not conflict with the existing
nutrition add sheet. It is a focused component rather than a nested instance of
the draggable `BottomSheet`, whose document-level Escape and gesture handling
is designed for a top-level sheet.

New chrome strings are added in English and Dutch. Emoji remain stored content
and are not translated.

## Tests

The agreed seams are:

1. The rendered `IconPicker`: initial collapsed state, open/close controls,
   icon selection, explicit clearing, dismissal, and accessible trigger state.
2. The existing food-form submission seam: clearing still becomes `null` in the
   form payload.

The focused picker test file runs during each red/green cycle. Typechecking and
the full suite run before completion.

## Scope boundaries

- Do not change the curated icon set or backend icon semantics.
- Do not change the parent nutrition add sheet's gesture behavior.
- Do not add a second picker for recipes or combos.
