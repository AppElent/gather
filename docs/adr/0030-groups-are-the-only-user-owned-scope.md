# Groups are the only user-owned scope

Status: decided (2026-09-01)

Gather treats every user-owned record as belonging to exactly one Group. A
Group is an ordinary membership and sharing boundary; it has no Personal mode,
no special single-member behavior, and no product-defined purpose or type.

## Decision

- New accounts do not receive a Group automatically.
- A person with no Groups enters a join-or-create onboarding flow.
- A person accepting an invite may join that Group without creating one first.
- Existing former Personal Groups are converted in place to ordinary Groups,
  preserving their names and content. Names containing “Personal” remain user
  data and have no behavioral meaning.
- Group recognition comes from the required name plus optional Group
  appearance: a prepared picture or chosen icon, with a stable fallback.
- Admins may edit Group name and appearance.
- Personal Nutrition data remains legacy and out of scope for this change;
  Nutrition and its Personal records are deprecated separately.

## Consequences

Privacy does not come from a Personal Group or a person-owned record. The
active product surface is Group-scoped, while Catalog data remains outside
user ownership. The schema and UI can remove `isPersonal`, default-Group
creation, and Personal-only membership restrictions. The migration may apply to
existing rows directly; production contains no used Personal Groups.

The Group name and appearance are identity cues, not configuration. Modules
must not branch on whether a Group is a household, club, or another kind of
Group.

