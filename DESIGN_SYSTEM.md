---
version: 2.1.0
description: Design rules selected by platform and interaction.
---

# Design system

<!-- appelent-standards:start -->
## Shared guidance

For UI work, read [general design](docs/standards/general-design.md) and the affected platform:

| Platform | Read |
| --- | --- |
| Browser | [Web design](docs/standards/web-design.md) |
| Native | [Mobile design](docs/standards/mobile-design.md), plus [iOS](docs/standards/ios-design.md) or [Android](docs/standards/android-design.md) |

When the task matches a row, also read:

| Task | Read |
| --- | --- |
| Entering or adjusting a numeric value | [Number fields](docs/standards/number-fields.md) |
| Fullscreen, sheet, or keyboard-anchored editing, or drafts | [Editors](docs/standards/editors.md) |
| Row actions, selection, or section menus in a list | [Actionable lists](docs/standards/lists.md) |
| Creating, reviewing, or building from a design study | [Design studies](docs/standards/design-studies.md) |

Project decisions below bind these standards to product components, identity, and justified exceptions.
Conform, improve, or differ as described in [working with standards](CODING_STANDARDS.md#working-with-standards).
<!-- appelent-standards:end -->

## Design System artifact

The canvas design system is the [Gather Design System artifact](https://claude.ai/artifact/Rwyfbq38b6YcreQMScCZgy).
Designers and coding agents start from it; product decisions below still bind the code.

## Web

The web wears the phone's tokens (Tiles & Today, APP-636). `src/styles.css`
declares them as custom properties for light and dark (`[data-theme]` and
`prefers-color-scheme`):

- Neutrals `--ground`, `--surface`, `--surface-2`, `--ink`, `--muted`,
  `--hair`, `--hair-strong`, `--danger`, `--on-ink`, equal to
  `apps/mobile/src/theme/palette.ts`.
- Per group (`kitchen`, `home`, `tasting`, `money`) `--<group>-fill`, `-on`,
  `-text` and `-wash`, equal to `@gather/core/module-tints`.
- `--accent`, `--on-accent` and `--accent-text`: ink outside a Module, the
  group's `fill`, `on` and `text` inside one. The shell sets `data-group` on a
  Module's `<main>`. A neutral action uses `ink`/`on-ink`, a Module's primary
  action its `--accent`/`--on-accent`. Links take `--accent-text`. Group
  colour never goes on navigation, rows or selection.
- Type: `--font-rounded` (`font-rounded`; `ui-rounded`, SF Pro Rounded,
  Nunito) at 700 for titles and numerals, the system stack for text; body 16px,
  subhead 15, footnote 13. No web font is loaded.
- Shape: `--radius-card` 22px, tiles 20/28/36/56px with radii 6/9/11/17,
  `--radius-pill`, `--radius-control` 12px for fields and square controls;
  `--size-row-min` 52px, `--size-control-min` 44px. No shadows or gradients on
  content.

`src/styles.test.ts` fails when a colour drifts from the phone, when a retired
token (the sea/lagoon palette, `--app-*`, Fraunces, Manrope, gradients) comes
back, or when text or an edge drops below its contrast. Components use these
tokens, never a Tailwind palette colour or a hex (photo overlays, scrims, a
switch knob, brand marks and the barcode's white card excepted). The look is
shared now; ADR-0017's rule that the clients share their words still holds.

The same file maps the `--auth-*` tokens from `src/lib/auth/tokens.css` onto
these and supplies `.rm-panel`/`.rm-label`, which `src/lib/auth/`'s
`ProfilePanel` and `AppearanceSettings` use as a card. Shell components live in
`src/components/app/`; destructive actions confirm through `ConfirmAction`,
and every modal takes its focus handling (initial focus, Tab trap, Escape,
return to opener) from `useModalFocus`. Kitchen form fields take their class
from `src/components/kitchen/fields.ts`, at 16px on phones so iOS does not zoom
in on focus.

### Responsive action controls

Binds [responsive action controls](docs/standards/web-design.md#responsive-action-controls):
the desktop breakpoint is Tailwind's `lg` (1024px), and the visible label
carries `hidden lg:inline`.

### Breadcrumbs

A page below a Module's index renders `<Breadcrumbs>` per
[nested pages carry their own trail](docs/standards/web-design.md#nested-pages-carry-their-own-trail);
gather's component, address helper and trail examples are in
[navigation](docs/contracts/navigation.md).

## Native

Read [gather's mobile design system](apps/mobile/DESIGN_SYSTEM.md). The phone
owns its look and shares its words with the web ([ADR-0017](docs/adr/0017-the-phone-owns-its-look-and-shares-its-words.md));
the web now takes that look's tokens (see [Web](#web)).
