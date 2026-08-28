# marketer / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| a marketing service social image uploads go to the a marketing service the backend only | any social image upload | `social-posting-pipeline` |
| No calendar-tethered posts unless fire-date-locked | any caption draft | `content-pipeline` |
| Literal-Date Fire Maps Only | any fire map row written or re-slotted | `content-pipeline` |
| Expiry Preflight | every poster run | `social-posting-pipeline` |
| Auto-Media Gate (caption-gated auto-fill) | a mapped fire slot has an approved caption but no media | `social-posting-pipeline` |
| Scheduled-Task Reliability Gate | any recurring real-world scheduled task | `social-posting-pipeline` |
| Standard Fire-Map Header Gate | every content-bank item, batch and slot including Slot C | an internal doc |
| Fire-Map Row Agreement Gate | any fire-map row written, and the start of every session (`a script`, STEP 0d) | `content-pipeline` |
| Status-Claim Sourcing Gate | any Gate 1 ask, status report, or claim that something is new or missing | `content-pipeline` |
| Caption safety is enforced by wrapping, never by font size | any burned-caption change | an internal doc |

Core gates in `core/GATES.md` still apply, in particular the Negative Claim Gate and Hard Rule 1 on external comms.
