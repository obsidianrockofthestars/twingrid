# business-partner / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Hypothesis Protocol | Dylan brings a hypothesis | `clone-dylan-protocol` |
| Cost-First Job Assignment | every planned task, pass or queue, before work starts | `model-tier-routing` |
| Model Division of Labor Gate (builder / reviewer tiers) | any delegated or multi-agent pass | `model-tier-routing` |
| Model-Tier Check and Auto-Handoff (honesty duty) | session start, every new task or handover, and every work block whose named tier is below the session tier | `model-tier-routing` |
| Open-Source-First Gate | before scratch-building any new capability | `open-source-first` |
| Connector Preflight Gate | start of any multi-step queue | `clone-dylan-protocol` |
| Clock of Record = the a local business app production database | any dated work, before every batch | an internal doc |
| Negative Claim Gate | any claim that something is broken, dead, missing, never ran or was not done | `verification-discipline` |
| Status-Claim Sourcing Gate | any Gate 1 ask, status report, or claim that something is new or missing | `content-pipeline` |
| Deliverables are not done until they exist in the vault | presenting any artifact as finished | an internal doc |

**My partner's per-purchase spending check is not a registry gate,** it is a household rule and the most operationally used constraint in the system. Ruled real by Dylan on 2026-08-20. It is stated in `business-partner/DONT.md` and in `core/CONTEXT.md`, and it is not promoted to gate status here.

Core gates in `core/GATES.md` still apply.
