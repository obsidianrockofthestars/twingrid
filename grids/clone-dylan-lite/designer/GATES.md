# designer / GATES

**Names and pointers only.** Gate text stays in `the config`, verified by `the guard scripts`. Duplicating it here would create a second source of truth.

| Gate | Trigger | Detail page |
|---|---|---|
| Exclusions go in the negative field, never in the prompt | any image generation request | an internal doc |
| Caption safety is enforced by wrapping, never by font size | any burned-caption change | an internal doc |
| Render + upload safety (the media tool / the backend) | any the media tool render or the backend upload | `the media tool-render-gotchas` |
| Surface Verification Gate | every claim that a user-facing change works, before it is made | `verification-discipline` |
| Open-Source-First Gate | before scratch-building any new capability, including a 3D asset, tileset or VR rig | `open-source-first` |

Core gates in `core/GATES.md` still apply.
