# The Current Group is ambient on web and mobile

Status: decided (2026-09-01)

The web and mobile apps use the same ambient Current Group model. Group
identity is selected in client context rather than encoded in ordinary routes.

## Decision

- Web Module and record routes are top-level routes without a Group slug or
  Group ID.
- The Current Group is persisted locally per client and validated against the
  person’s memberships at launch.
- With no local selection, the client chooses a deterministic landing Group
  and stores that selection. No server-side default determines context.
- Creating or joining a Group immediately selects it and opens its Home.
- Losing the last membership clears the local selection and opens the
  join-or-create flow.
- Switching with unsaved form state requires confirmation and resets
  navigation so content from the previous Group cannot appear under the new
  one.
- Old `/g/<slug>/…` URLs are not resolved or redirected; they 404.
- Backend authorization continues to validate membership, visibility, and
  home-Group ownership using the resolved Current Group. Ambient routing is
  not a security boundary.

## Consequences

The old web URL model and the web/mobile split are retired. Slugs are legacy
data and no longer provide user-facing Group identity. Internal links,
breadcrumbs, tests, deep-link behavior, and route structure must move to the
ambient model together.

Public/Private visibility replaces Group-to-Group sharing as a separate future
change. This ADR does not implement that redesign.

