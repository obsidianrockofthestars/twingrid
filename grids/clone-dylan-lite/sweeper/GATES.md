# sweeper / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Open-Source-First Gate | before scratch-building any new capability | `open-source-first` |
| Expand-Then-Contract Deploy Gate | any migration touching a column or table the live frontend reads | `verification-discipline` |
| Surface Verification Gate | every claim that a user-facing change works, before it is made | `verification-discipline` |
| Same-Session Instrument Gate | any check, sweep or harness authored and relied on inside one session | `verification-discipline` |
| Skip-Gate = Verification Gate | any resume, skip or cache logic calls something already done | `inspect-artifacts-before-trusting` |
| Cross-Consumer Grant Gate | any GRANT, RLS or column-privilege change | an internal doc |

The Same-Session Instrument Gate is the sharpest one for this mode: it was ratified after a sweep ran its generator and THEN diffed, overwriting the hand edit it was hunting, so it could never fail.

Core gates in `core/GATES.md` still apply.
