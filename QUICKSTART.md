# Run TwinGrid yourself in five minutes

This is the demo script. Follow it top to bottom and you will have composed a working clone and then built a new one from scratch. No prior experience needed. Every line is copy-paste.

## 0. What you need

- Python 3 (check with `python --version`)
- pytest for the tests (`pip install pytest`)
- this repo on your machine

## 1. See a real clone compose

The clone is a folder of markdown cells. The engine assembles the ones that apply to a situation and prints one prompt. Try it:

```
python engine/grid.py validate grids/clone-dylan-lite
python engine/grid.py compose grids/clone-dylan-lite --specialist engineer --register surgery
```

`validate` should say `OK: 19 facets, 80 cells, no findings.` `compose` prints the full prompt for "the engineer specialist, in surgery register", and ends with a receipt listing exactly which cells it loaded and their ids. Change the axes and watch the output change:

```
python engine/grid.py compose grids/clone-dylan-lite --role teacher --register vibe
python engine/grid.py compose grids/clone-dylan-lite --mode grower --specialist marketer
```

Paste any of those outputs into a fresh AI chat and you are talking to that clone, in that posture.

## 2. Prove the safety rail

The engine refuses to ship a broken identity. Break one on a throwaway copy and watch it stop you:

```
python engine/grid.py scaffold grids/demo
del grids\demo\core\DO.md        # on macOS or Linux: rm grids/demo/core/DO.md
python engine/grid.py validate grids/demo
```

It fails with `MISSING_REQUIRED_CELL core/DO.md`, exit code 1. A missing rule cannot slip through. Delete the demo when done (`rmdir /s grids\demo`, or `rm -rf grids/demo`).

## 3. Build your own clone

```
python engine/grid.py scaffold grids/your-name
```

That writes a complete, valid skeleton: 19 facets, 80 cells, each with a placeholder, plus a stamped manifest. Now fill it in. Open `grids/blank-template/` alongside it, every cell there carries commented prompts telling you what belongs in it. Work through `core` first (it loads in every composition), then the specialists, modes, roles, and registers.

After editing, record your changes:

```
python engine/grid.py check grids/your-name      # shows what changed
python engine/grid.py stamp --force grids/your-name
python engine/grid.py validate grids/your-name
```

`--force` is required after the first stamp on purpose: re-stamping blesses your edits with a new hash, and the engine will not do that silently. That is the guardrail that stops a clone from being changed by accident.

## 4. Make clones with different skills or personalities

A clone is just a grid folder, so you can have as many as you want, each a different person or persona:

```
python engine/grid.py scaffold grids/support-agent
python engine/grid.py scaffold grids/game-master
python engine/grid.py scaffold grids/brand-voice
```

Fill each one's cells with that persona's context, rules, and voice. The four axes (specialist, mode, role, register) let a single clone shift posture; separate grids let you keep entirely separate personalities. Same engine, same safety rails, for all of them.

## 5. What the pieces mean

- **core** loads every time. The always-on identity.
- **specialists** (manager, designer, marketer, engineer, writer, qa-skeptic, librarian): domain expert seats.
- **modes** (prototyper, builder, sweeper, grower, maintainer): lifecycle personalities.
- **roles** (teacher, business-partner, worker): how an answer is shaped.
- **registers** (vibe, surgery, full-copy): the tone dial.
- Cell types per facet: `CONTEXT` (standing facts), `DO` (what to do), `DONT` (hard prohibitions), `VOICE` (how it sounds, core and registers only), `GATES` (names and pointers to rules, never the rule text itself).

## 6. Run the tests

```
cd engine && python -m pytest tests -q
```

105 tests. They cover the engine's refusal behavior: missing cells, empty cells, drifted hashes, forged receipts, and the composition guarantees.

That is the whole thing. A clone you can read, version, run anywhere, and trust because it refuses to ship broken.
