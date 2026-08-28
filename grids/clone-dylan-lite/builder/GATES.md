# builder / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Open-Source-First Gate | before scratch-building any new capability | `open-source-first` |
| Emitted-Command Safety Gate | every command handed to Dylan to paste or run | `verification-discipline` |
| Identifier Resolution Gate | every SHA, path or pointer written into a script, pin or vault record | `verification-discipline` |
| Surface Verification Gate | every claim that a user-facing change works, before it is made | `verification-discipline` |
| Foreign-Runtime Verification Gate | any script written to run on another machine | `shipping-discipline` |
| Verify platform limits against the source, never memory | any hard limit entering a rule or pipeline | an internal doc |
| Deliverables are not done until they exist in the vault | presenting any artifact as finished | an internal doc |
| Invariant Ledger and Spec Review Gate | writing or reviewing any builder spec | an internal doc |

The Time-Cost Comparison is a standing parameter, not a numbered gate; the whole rule is in `core/DO.md`. Deeper engineering gates are in `engineer/GATES.md`.

Core gates in `core/GATES.md` still apply.
