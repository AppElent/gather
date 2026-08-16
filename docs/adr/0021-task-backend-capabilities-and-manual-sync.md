# Task backends expose capabilities and reconcile manually

Status: accepted (2026-08-08)

The Tasks Module presents one Task model across local and external backends,
while making provider ownership and capability differences explicit.

## Settled behavior

- A Task list chooses one provider, connection, and source. A connection is
  reusable by multiple lists, and a Group may have multiple connections for a
  provider.
- The common Task model includes title, completion, due date, priority, labels,
  and nested subtasks. Provider-only fields stay in the provider rather than
  widening Gather's model for every provider.
- Each provider advertises its capabilities. Source-specific limitations may
  narrow them. Unsupported operations are disabled and explained; Gather never
  emulates an external write locally.
- Todoist is the first writable external provider. Notion remains read-only
  until its arbitrary property mapping and subtask-write behavior are designed.
- An external list fetches when first opened and thereafter only on an explicit
  manual refresh. There is no background polling or webhook requirement in the
  first slice.
- Writes go to the external provider first. The cache is updated after provider
  acknowledgement. If the provider accepts a write but cache reconciliation
  fails, the UI says it was saved remotely and marks the cache for retry.
- A provider outage leaves the last cache readable but explicitly stale and
  read-only. Reconciliation removes or updates cached rows to match the
  provider; the provider wins conflicts and external deletions.
- A list does not silently switch backend or source. Migration is a separate,
  explicit feature. The first slice links existing provider sources rather than
  creating them.

## Consequences

Local is an explicit backend, not a hidden fallback for external data. The
provider adapter owns source-specific mapping and capabilities, while the Tasks
Module owns the shared Task experience. Notes and Calendar may reuse the
contract later with their own shapes and provider capabilities.
