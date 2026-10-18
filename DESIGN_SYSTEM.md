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

Read a pattern only when building that interaction: [number fields](docs/standards/number-fields.md), [editors](docs/standards/editors.md),
[actionable lists](docs/standards/lists.md), and [design studies](docs/standards/design-studies.md). Project
decisions below bind these standards to product components, identity, and justified exceptions.
Conform, improve, or differ as described in [working with standards](CODING_STANDARDS.md#working-with-standards).
<!-- appelent-standards:end -->

## Web

A sea/lagoon palette (`--sea-ink`, `--lagoon`, light and dark) defined in
`src/styles.css`, with `.demo-panel`/`.demo-card` as the card surface. The same
file overrides `@appelent/auth`'s `--auth-*` tokens to that palette and supplies
`.rm-panel`/`.rm-label`, which the package's `ProfilePanel` and
`AppearanceSettings` use but do not ship, styled to match `.demo-panel` and
`.demo-section-title`. Shell components live in
`src/components/app/`; destructive actions confirm through `ConfirmAction`.

### Responsive action controls

Compact add, edit, delete and refresh controls show only their icon below
Tailwind's `lg` breakpoint (1024px), tablets included, and the icon plus its
translated visible label at `lg` and above (`hidden lg:inline` on the label).
Every icon-only control keeps a translated `aria-label`. A control keeps its
visible label at every width when the label carries essential state or
workflow context, such as a form submission or a confirmation.

### Breadcrumbs

A page below a Module's index renders `<Breadcrumbs>` with its trail; the
rules and the add-a-route checklist are in [navigation](docs/contracts/navigation.md).

## Native

Read [gather's mobile design system](apps/mobile/DESIGN_SYSTEM.md). The phone
owns its look and shares its words with the web ([ADR-0017](docs/adr/0017-the-phone-owns-its-look-and-shares-its-words.md)).
