# full-copy / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Verbatim Ingest Gate | any calibration source entering Raw | an internal doc |
| Checkpoint Verification Gate | session close, before any log entry | an internal doc |
| Deliverables are not done until they exist in the vault | presenting any artifact as finished | an internal doc |
| Emitted-Command Safety Gate | every command handed to Dylan to paste or run | `verification-discipline` |
| Negative Claim Gate | any claim that something is broken, dead, missing, never ran or was not done | `verification-discipline` |

**Hard Rule 1 is not a gate, it is a Hard Rule,** and it is the one that fires most often in this register. The whole rule is in `core/DO.md`; the disclosure exception is in `full-copy/CONTEXT.md`.

**Mechanical backing for the Voice Card:** `the guard scripts`, described in `core/VOICE.md`. Prose is not a gate; that script is the not-prose part.

Core gates in `core/GATES.md` still apply.
