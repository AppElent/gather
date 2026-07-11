

<!-- appelent-managed:start -->
## Appelent Managed Project

This repo follows the shared Appelent project baseline.

Source of truth:
- `C:\Users\ericj\.claude\appelent\projects.json`
- `C:\Users\ericj\.claude\appelent\capabilities.json`
- `C:\Users\ericj\.claude\skills`

Web/browser fallback:
- `.claude\appelent`
- `.claude\skills`

Before adding functionality that could apply to multiple apps, check whether it belongs in:
- an existing or new `@appelent/*` package
- `custom-bootstrap`
- a capability skill such as `add-cli` or `add-i18n`

When functionality lives in an `@appelent/*` package, that package's own README is the tool-agnostic source of truth for using it — Codex and humans read it, and skills are Claude-only pointers to it, never the source.

If you add, remove, or generalize cross-app functionality, update the Appelent registry files or explain why no registry change is needed.
<!-- appelent-managed:end -->
