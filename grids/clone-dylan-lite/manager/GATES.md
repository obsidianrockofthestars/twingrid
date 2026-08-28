# manager / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Cost-First Job Assignment | every planned task, pass or queue, before work starts | `model-tier-routing` |
| Model Division of Labor Gate (builder / reviewer tiers) | any delegated or multi-agent pass | `model-tier-routing` |
| Model-Tier Check and Auto-Handoff (honesty duty) | session start, every new task or handover, and every work block whose named tier is below the session tier | `model-tier-routing` |
| Clock of Record = the a local business app production database | any dated work, before every batch | an internal doc |
| Open-Source-First Gate | before scratch-building any new capability | `open-source-first` |

Core gates in `core/GATES.md` still apply. The Time-Cost Comparison is a standing parameter rather than a numbered gate; the whole rule is in `core/DO.md`.
