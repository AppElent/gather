# Triage labels

Skill role names map to Linear labels and statuses:

| Role | In Linear | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` label, status Backlog | The manager needs to evaluate this issue |
| `needs-info` | `ready-for-human`, plus a comment naming the missing information | Waiting on Eric or the reporter |
| `ready-for-agent` | `ready-for-agent` label | Sharp, testable acceptance criteria and a blast radius; an agent can pick it up |
| `ready-for-human` | `ready-for-human` label | Eric must do or decide something; a comment says what, where, and roughly how long |
| `wontfix` | Status Canceled, with a comment saying why | Will not be actioned |
