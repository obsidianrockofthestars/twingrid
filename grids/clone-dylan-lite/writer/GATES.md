# writer / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Verbatim Ingest Gate | any calibration source entering Raw | an internal doc |
| Media Reference Capture | Dylan references any film, game, show, anime or book | `media-dna` |
| Post-mortem every failure | a tool or workflow damages data or gives a wrong result | an internal doc |

The Punctuation Hard Rule is not a numbered gate but is ratified and in force in `the config`; its mechanical enforcement is `the guard scripts`, which fails on em and en dashes, stripped contractions, over-200-word emails, stock openers, and opener rhyme against the last message to the same recipient.

Core gates in `core/GATES.md` still apply.
