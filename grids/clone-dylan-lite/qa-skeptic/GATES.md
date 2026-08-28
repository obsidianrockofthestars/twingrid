# qa-skeptic / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Negative Claim Gate | any claim that something is broken, dead, missing, never ran or was not done | `verification-discipline` |
| Surface Verification Gate | every claim that a user-facing change works, before it is made | `verification-discipline` |
| Same-Session Instrument Gate | any check, sweep or harness authored and relied on inside one session | `verification-discipline` |
| Identifier Resolution Gate | every SHA, path or pointer written into a script, pin or vault record | `verification-discipline` |
| Concurrent-Write Re-Read Gate | every truncation or missing-sentinel CRITICAL, before acting on it | `verification-discipline` |
| Skip-Gate = Verification Gate | any resume, skip or cache logic calls something already done | `inspect-artifacts-before-trusting` |
| Status-Claim Sourcing Gate | any Gate 1 ask, status report, or claim that something is new or missing | `content-pipeline` |
| Invariant Ledger and Spec Review Gate | writing or reviewing any builder spec, and any change to guard or checkpoint machinery | an internal doc |
| Checkpoint Verification Gate | session close, before any log entry | an internal doc |

**Freshness Coherence Gate (RATIFIED 2026-08-18, the 51st registry gate, `verification-discipline`).** Trigger: any deliverable leaving the vault carrying two or more external facts. Every claim true, the set of claims false: date-stamp each fact at review time and ask whether they all describe the same moment. The earlier filing here as proposed was a migration error, corrected 2026-08-21 against `the config` line 246.

Mechanical backing: `the guard scripts` (WARN on the shard-write path, regression-tested 11 of 11).

Core gates in `core/GATES.md` still apply.
