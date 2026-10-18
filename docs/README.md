# Gather docs

Rules for placing, naming and formatting documents:
[documentation standard](standards/documentation.md). Each typed folder has a
managed `.template.md` to copy, and every document's `description` says when to
read it: `grep -r "^description:" docs/standards docs/contracts docs/runbooks`.

| Folder | Type | Lifetime |
| --- | --- | --- |
| `standards/` | `standard`: shared rules | Managed by developer-tools; never edited here |
| `contracts/` | `contract`: intended behavior per area | Living, versioned |
| `adr/` | `decision`: hard-to-reverse trade-offs ([index](adr/README.md)) | Immutable; superseded |
| `runbooks/` | `runbook`: project facts for a repeatable task | Living, versioned |
| `records/` | `record`: dated evidence cited by a contract or ADR | Frozen |
| `migrations/` | Active one-shot migrations and their retirement conditions ([index](migrations/README.md)) | Until retired |
| `agents/` | Pointers engineering skills look up by path | — |

Not yet sorted into the types above, and read only when a document links them:
`superpowers/`, `plans/`, `briefs/`, `research/`, `review-notes/`,
`mobile-settings-backlog.md`.

Vocabulary: [CONTEXT.md](../CONTEXT.md). Project rules:
[CODING_STANDARDS.md](../CODING_STANDARDS.md), [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md).
