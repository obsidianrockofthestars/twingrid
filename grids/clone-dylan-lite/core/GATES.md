# core / GATES

**Names and pointers only. No gate text lives here.**

The gate registry is the "Ratified gates" section of `the config` (51 ratified gates as of 2026-08-21). It is verified mechanically by `the guard scripts`, and `the wiki` is generated from that section, never hand-counted. Copying gate text into a grid cell would create a second source of truth and the count would drift. Read the gate at source.

## Always in force (every session, every facet)

| Gate | Trigger | Detail page |
|---|---|---|
| Start-of-Session Context Gate | the FIRST action of every session | an internal doc |
| Never use the Edit or Write tool on vault files | any write to a vault file | an internal doc |
| Checkpoint Verification Gate | session close, before any log entry | an internal doc |
| Snapshot-Clean Gate + reliable baseline | any snapshot or vault write | an internal doc |
| Source-Hash Stamp Gate | writing or applying any derived artifact | `vault-guard-protocol` |
| Concurrent-Writer Discipline | any write to a file another session may also write, and every `log.md` entry | `vault-guard-protocol` |
| Mid-Session Integrity Checks | after every batch of vault writes | `vault-guard-protocol` |
| Cloud-Bridge Write Discipline | a one engine cloud or file-bridge session writes an existing file | `vault-guard-protocol` |
| Source-of-Truth Scope Gate | adding any new working directory to the vault | `vault-guard-protocol` |
| Canonical System Time = America/Chicago (Central) | anything that stamps or compares a time | `vault-guard-protocol` |
| Question and Drift Discipline | every one-shot, spawned or orchestrated session | `vault-guard-protocol` |
| Shared-Temp Staging Ban | any device-bridge vault write, and any shell call that writes then reads | an internal doc |
| Verbatim Ingest Gate | any calibration source entering Raw | an internal doc |
| Deliverables are not done until they exist in the vault | presenting any artifact as finished | an internal doc |
| Post-mortem every failure | a tool or workflow damages data or gives a wrong result | an internal doc |
| Concurrent-Write Re-Read Gate | every truncation or missing-sentinel CRITICAL, before acting on it | `verification-discipline` |
| Negative Claim Gate | any claim that something is broken, dead, missing, never ran or was not done | `verification-discipline` |
| Hypothesis Protocol | Dylan brings a hypothesis | `clone-dylan-protocol` |
| Connector Preflight Gate | start of any multi-step queue | `clone-dylan-protocol` |
| Media Reference Capture | Dylan references any film, game, show, anime or book | `media-dna` |
| Model-Tier Check and Auto-Handoff (honesty duty) | session start, every new task or handover, and every work block whose named tier is below the session tier | `model-tier-routing` |
| Invariant Ledger and Spec Review Gate | writing or reviewing any builder spec, and any change to guard or checkpoint machinery | an internal doc |

## Mechanical checks that back these

- `the guard scripts` (STEP 0, wraps `a script`, prints digest, index head, last three session logs, sweeps `inbox.md`, runs `a script` as STEP 0d)
- `the guard scripts`, `the guard scripts`, `the guard scripts`, `the guard scripts`, `the guard scripts`, `the guard scripts`, `the guard scripts`
- Windows-native snapshot runner: `the guard scripts`. Treat the nightly scheduled task as UNCONFIRMED, not as coverage, until a real run proves it green.

## Corrections against the config, 2026-08-21 adversarial review

- **Freshness Coherence Gate IS RATIFIED** (2026-08-18, the 51st registry gate, `verification-discipline`). Trigger: any deliverable leaving the vault carrying two or more external facts. The earlier filing of it here as proposed was a stale read of `the config`, corrected against line 246.
- **Question and Drift Discipline rules 1 to 5 are ALL ratified** (rule 5 on 2026-08-01, rules 1 to 4 ratified with that row per `the config` line 191).

## Where the other gates are filed

Domain gates live on their facets: `manager/GATES.md`, `designer/GATES.md`, `marketer/GATES.md`, `engineer/GATES.md`, `writer/GATES.md`, `qa-skeptic/GATES.md`, and the Looper mode facets.
