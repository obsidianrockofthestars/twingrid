# maintainer / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Post-mortem every failure | a tool or workflow damages data or gives a wrong result | an internal doc |
| Scheduled-Task Reliability Gate | any recurring real-world scheduled task | `social-posting-pipeline` |
| Expiry Preflight | every poster run | `social-posting-pipeline` |
| Concurrent-Write Re-Read Gate | every truncation or missing-sentinel CRITICAL, before acting on it | `verification-discipline` |
| Surface Verification Gate | every claim that a user-facing change works, before it is made | `verification-discipline` |
| Expand-Then-Contract Deploy Gate | any migration touching a column or table the live frontend reads | `verification-discipline` |
| Emitted-Command Safety Gate | every command handed to Dylan to paste or run | `verification-discipline` |
| Negative Claim Gate | any claim that something is broken, dead, missing, never ran or was not done | `verification-discipline` |
| Checkpoint Verification Gate | session close, before any log entry | an internal doc |
| Mid-Session Integrity Checks | after every batch of vault writes | `vault-guard-protocol` |
| Cross-Consumer Grant Gate | any GRANT, RLS or column-privilege change | an internal doc |

**Documented limit, not a gate:** Bridge Sessions Cannot Checkpoint (`vault-guard-protocol`, measured 2026-08-18). A one engine cloud or file-bridge session cannot run `a script` to completion and must not claim a checkpoint it did not produce. The workaround is `the guard scripts`.

Core gates in `core/GATES.md` still apply.
