# grower / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Event Coverage Gate (a local business app scraper) | every a local business app scraper run | `event-scraper-ops` |
| Board-Depth Check | the open of every scraper run | `event-scraper-ops` |
| Clock of Record = the a local business app production database | any dated work, before every batch | an internal doc |
| No calendar-tethered posts unless fire-date-locked | any caption draft | `content-pipeline` |
| a marketing service social image uploads go to the a marketing service the backend only | any social image upload | `social-posting-pipeline` |
| Scheduled-Task Reliability Gate | any recurring real-world scheduled task | `social-posting-pipeline` |
| Surface Verification Gate | every claim that a user-facing change works, before it is made | `verification-discipline` |
| Negative Claim Gate | any claim that something is broken, dead, missing, never ran or was not done | `verification-discipline` |
| Cost-First Job Assignment | every planned task, pass or queue, before work starts | `model-tier-routing` |

The full social pipeline gate set is in `marketer/GATES.md`. Core gates in `core/GATES.md` still apply.
