# librarian / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth, which is the precise failure this facet exists to prevent.

| Gate | Trigger | Detail page |
|---|---|---|
| Start-of-Session Context Gate | the FIRST action of every session | an internal doc |
| Never use the Edit or Write tool on vault files | any write to a vault file | an internal doc |
| Checkpoint Verification Gate | session close, before any log entry | an internal doc |
| Snapshot-Clean Gate + reliable baseline | any snapshot or vault write | an internal doc |
| Source-Hash Stamp Gate | writing or applying any derived artifact | `vault-guard-protocol` |
| Concurrent-Writer Discipline | any write to a file another session may also write, and every log.md entry | `vault-guard-protocol` |
| Mid-Session Integrity Checks | after every batch of vault writes | `vault-guard-protocol` |
| Cloud-Bridge Write Discipline | a one engine cloud or file-bridge session writes an existing file | `vault-guard-protocol` |
| Source-of-Truth Scope Gate | adding any new working directory to the vault | `vault-guard-protocol` |
| Canonical System Time = America/Chicago | anything that stamps or compares a time | `vault-guard-protocol` |
| Question and Drift Discipline | every one-shot, spawned or orchestrated session | `vault-guard-protocol` |
| Invariant Ledger and Spec Review Gate | writing or reviewing any builder spec, and any change to guard or checkpoint machinery | an internal doc |
| Shared-Temp Staging Ban | any device-bridge vault write, and any shell call that writes then reads | an internal doc |
| Verbatim Ingest Gate | any calibration source entering Raw | an internal doc |
| Concurrent-Write Re-Read Gate | every truncation or missing-sentinel CRITICAL, before acting on it | `verification-discipline` |
| Negative Claim Gate | any claim that something is broken, dead, missing, never ran or was not done | `verification-discipline` |
| Fire-Map Row Agreement Gate | any fire-map row written, and the start of every session | `content-pipeline` |
| Deliverables are not done until they exist in the vault | presenting any artifact as finished | an internal doc |
| Post-mortem every failure | a tool or workflow damages data or gives a wrong result | an internal doc |

**Documented limit, not a gate:** `a script --check` is not wired into `a script`. Adding it falls under the Invariant Ledger and Spec Review Gate and wants Dylan's ruling.

**`vault-guard-protocol.md` claims `the config` still carries the old Single-Writer Gate text.** It does not; `the config` carries Concurrent-Writer Discipline (2026-08-04), which opens by saying it replaces it. The wiki's open item is stale. See `UNRESOLVED.md`; Dylan is correcting that page himself.

Core gates in `core/GATES.md` still apply.
