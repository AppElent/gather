---
type: decision
description: Read before changing what the phone and web share in look and vocabulary.
version: 1.0.0
status: accepted
date: 2026-08-13
---

# The phone owns its look and shares its words

## Decision

Mobile owns its native layout, typography, neutrals, spacing, and controls. Both clients share user-visible vocabulary, module groups, tints, and icon names through `@gather/core`.

## Consequences

`StyleSheet` and `apps/mobile/src/theme/` provide the mobile design system; native Expo UI owns platform chrome. Module tints live in core, while the adaptive accent rule, radii, and glyph lookup remain mobile-specific. A fifth module group is a design decision because it needs a contrast-safe tint on both themes.

## Enforcement

`packages/core/src/moduleTints.ts` is keyed by `ModuleGroup`; `apps/mobile/src/theme/` consumes it through typed tokens. Message parity and core typechecks prevent shared vocabulary from drifting. See [`apps/mobile/DESIGN_SYSTEM.md`](../../apps/mobile/DESIGN_SYSTEM.md#interaction-vocabulary) for interaction conventions.

## Reopen when

NativeWind reaches stable production support, the delivery path makes native styling libraries practical, or the web adopts the tinted catalogue and needs generated CSS tokens.
