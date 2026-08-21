# Shared code crosses as a package with no dependencies

Status: decided, not yet implemented (2026-08-13)

## Decision

Portable hand-written code crosses clients only through `@gather/core`. The package ships raw TypeScript, has no runtime dependencies, and exposes only explicit subpaths. Generated Convex API stubs remain relative imports.

## Consequences

Core owns shared domain unions, module metadata, messages, locale helpers, tints, and Group-selection helpers. Web routing, React wiring, Convex functions, and mobile presentation stay outside it. `convex/` does not move as part of this decision.

## Enforcement

`packages/core/package.json` has an empty dependency set and a wildcard-free exports map. Its DOM-free `tsconfig`, Node Vitest project, and dedicated core typecheck enforce the boundary.

## Reopen when

pnpm's isolated linker stops enforcing the empty dependency boundary, or the backend moves into a package under a separately approved migration.
