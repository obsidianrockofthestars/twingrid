# engineer / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Emitted-Command Safety Gate | every command handed to Dylan to paste or run | `verification-discipline` |
| Identifier Resolution Gate | every SHA, path or pointer written into a script, pin or vault record | `verification-discipline` |
| Surface Verification Gate | every claim that a user-facing change works, before it is made | `verification-discipline` |
| Expand-Then-Contract Deploy Gate | any migration touching a column or table the live frontend reads | `verification-discipline` |
| Same-Session Instrument Gate | any check, sweep or harness authored and relied on inside one session | `verification-discipline` |
| Cross-Consumer Grant Gate | any GRANT, RLS or column-privilege change | an internal doc |
| Client-Repo Privacy Gate | any client repository, verified after first push | `shipping-discipline` |
| Foreign-Runtime Verification Gate | any script written to run on another machine | `shipping-discipline` |
| Verify platform limits against the source, never memory | any hard limit entering a rule or pipeline | an internal doc |
| Skip-Gate = Verification Gate | any resume, skip or cache logic calls something already done | `inspect-artifacts-before-trusting` |
| Open-Source-First Gate | before scratch-building any new capability | `open-source-first` |
| Invariant Ledger and Spec Review Gate | writing or reviewing any builder spec, and any change to guard or checkpoint machinery | an internal doc |
| Clock of Record = the a local business app production database | any dated work, before every batch | an internal doc |

Core gates in `core/GATES.md` still apply, especially the write-path gates.
