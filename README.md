# TwinGrid

**An open, auditable framework for building an AI clone of a person, held as small inspectable cells instead of a black box.**

Most "AI twin" products are closed services: you pour yourself in, and a system you cannot see talks like you. TwinGrid is the opposite. A clone here is a folder of plain markdown cells, versioned in git, that an engine composes into a single prompt on demand. You can read every rule, diff every change, run it anywhere, and host it yourself. The engine refuses to compose an incomplete or drifted identity, so you can never ship a clone with a missing rule by accident.

If a twin you rent can talk like you, a twin you own can be inspected, corrected, and trusted. That is the difference.

## Why a grid

A person is not one prompt. TwinGrid breaks an identity into 19 facet folders across four axes that combine:

- **core** (1): the always-on identity. Loads in every composition.
- **specialists** (7): manager, designer, marketer, engineer, writer, qa-skeptic, librarian. Domain expert seats.
- **modes** (5): prototyper, builder, sweeper, grower, maintainer. Lifecycle personalities.
- **roles** (3): teacher, business-partner, worker. How an answer is shaped.
- **registers** (3): vibe, surgery, full-copy. The tone dial.

Each facet holds up to five cells, each a markdown file:

- `CONTEXT.md` standing facts this facet always needs
- `DO.md` what it should actively do
- `DONT.md` hard prohibitions
- `VOICE.md` how the voice sounds (core and registers only)
- `GATES.md` names and pointers to the rules that apply (never the rule text itself)

That is 80 cells for a complete clone. You compose one situation at a time, for example the engineer specialist in surgery register, and the engine assembles exactly the cells that apply, with a receipt listing what it loaded.

## What the engine guarantees

The engine guarantees delivery, not truth. It will:

- refuse to compose if a required cell is missing or empty,
- refuse to re-stamp a changed cell without an explicit `--force`, so a clone cannot be altered silently,
- emit a composition receipt naming every cell loaded, so you always know what the clone was built from.

What it cannot check is whether what you wrote is actually true to the person. That part is on you, which is exactly why the cells are readable and version-controlled.

## Quickstart

Full five-minute walkthrough, including building your own clone: see `QUICKSTART.md`.


```
# see the showcase clone compose
python engine/grid.py validate grids/clone-dylan-lite
python engine/grid.py compose grids/clone-dylan-lite --specialist engineer --register surgery

# run the tests
cd engine && python -m pytest tests -q
```

Paste the `compose` output into a fresh AI session and you are talking to that clone.

## Build your own

Follow `grids/blank-template/BUILD.md`. Short version:

```
python engine/grid.py scaffold grids/your-name
# edit each cell, then:
python engine/grid.py check grids/your-name
python engine/grid.py stamp --force grids/your-name
python engine/grid.py validate grids/your-name
```

The blank template's cells carry commented prompts describing what belongs in each one.

## The showcase: Clone Dylan Lite

`grids/clone-dylan-lite/` is a real clone, of this project's author, published as a redacted version: the method, voice, and public work are intact, while family details, finances, and private history have been removed. It is here so you can see what a dense, real clone looks like, not just an empty template. It is proof the framework carries a whole person, not a demo persona.

## A word on privacy

A grid holds real facts about a real person. Treat a private grid like a diary and keep it in a private repo. This public repo ships only a deliberately redacted clone and an empty template. Decide what is public before you make any grid public, because publishing is a one-way door.

## Roadmap

See `ROADMAP.md`. Coming: an MCP server so you build your clone by talking to Claude, and a free web builder. This repo (the framework) works today with Python alone.

## Credits

See `CREDITS.md`. TwinGrid builds toward the EvoGraph architecture (Igor Costa, arXiv:2508.05199) and bakes in the human-in-the-loop and provenance discipline from Jeremy Rule's Chief AI Officer course.

## License

MIT. See `LICENSE`. Use it, fork it, build clones with it.
