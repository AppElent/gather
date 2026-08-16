# External Module Backends are authoritative and Gather caches them

Status: accepted (2026-08-08)

A Group's Module collection may use either a local Backend or an external
Backend. When it uses an external Backend, the external system is authoritative
and Gather keeps a local cache for the Group experience.

## Rules

- Backend connections are Group-scoped and never user-global.
- A collection chooses its Backend; the Module contract stays independent of
  the provider's SDK and data shape.
- Local is an explicit Backend. It is not a fallback interpretation of a cache.
- External writes go to the authoritative Backend first. Gather updates its
  cache only after the Backend acknowledges the write.
- External changes are reconciled into the cache through the provider adapter.
- Offline writes, conflicts, provider deletion, reconnect, and failed writes
  must be explicit states of the contract; stale cache data must not masquerade
  as authoritative data.

## First slice

Tasks and Todoist are the first concrete proof of the contract. Todoist must
support the required bidirectional task operations while the local task list
continues to work as the local Backend. Notes and Calendar may adopt the same
contract later; they are not required to ship adapters in this slice.

## Consequences

The existing provider-adapter pattern is extended from read-only mirrors to
provider-first writes and cache reconciliation. A user can keep different
Groups or collections in the systems they choose without making every Module
know whether its records are local or external.
