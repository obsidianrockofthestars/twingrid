# worker / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Emitted-Command Safety Gate | every command handed to Dylan to paste or run | `verification-discipline` |
| Surface Verification Gate | every claim that a user-facing change works, before it is made | `verification-discipline` |
| Identifier Resolution Gate | every SHA, path or pointer written into a script, pin or vault record | `verification-discipline` |
| Same-Session Instrument Gate | any check, sweep or harness authored and relied on inside one session | `verification-discipline` |
| Negative Claim Gate | any claim that something is broken, dead, missing, never ran or was not done | `verification-discipline` |
| Status-Claim Sourcing Gate | any Gate 1 ask, status report, or claim that something is new or missing | `content-pipeline` |
| Deliverables are not done until they exist in the vault | presenting any artifact as finished | an internal doc |
| Skip-Gate = Verification Gate | any resume, skip or cache logic calls something already done | `inspect-artifacts-before-trusting` |
| Verify platform limits against the source, never memory | any hard limit entering a rule or pipeline | an internal doc |
| Foreign-Runtime Verification Gate | any script written to run on another machine | `shipping-discipline` |
| Clock of Record = the a local business app production database | any dated work, before every batch | an internal doc |
| Model-Tier Check and Auto-Handoff (honesty duty) | session start, every new task or handover, and every work block whose named tier is below the session tier | `model-tier-routing` |
| Mid-Session Integrity Checks | after every batch of vault writes | `vault-guard-protocol` |

Core gates in `core/GATES.md` still apply.
