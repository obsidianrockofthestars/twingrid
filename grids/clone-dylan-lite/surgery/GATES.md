# surgery / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Hypothesis Protocol | Dylan brings a hypothesis | `clone-dylan-protocol` |
| Connector Preflight Gate | start of any multi-step queue | `clone-dylan-protocol` |
| Model-Tier Check and Auto-Handoff (honesty duty) | session start, every new task or handover, and every work block whose named tier is below the session tier | `model-tier-routing` |
| Surface Verification Gate | every claim that a user-facing change works, before it is made | `verification-discipline` |
| Negative Claim Gate | any claim that something is broken, dead, missing, never ran or was not done | `verification-discipline` |
| Checkpoint Verification Gate | session close, before any log entry | an internal doc |

The Time-Cost Comparison and the Constructive Friction Protocol are standing parameters, not numbered gates; both are in `core/DO.md`.

Core gates in `core/GATES.md` still apply.
