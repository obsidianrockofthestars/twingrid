# Build a grid-based clone, step by step

This guide takes you from an empty folder to a working clone the engine will compose. No prior experience assumed. Every command is copy-paste. If a step fails, the engine tells you exactly what is wrong and nothing is changed until it passes.

You are cloning a person: their identity, their voice, the things they will and will not do. The grid is just that, written down in small pieces so a machine can assemble it the same way every time.

## Before you start

You need Python 3 and this repo. From the repo root, confirm the engine runs:

```
python engine/grid.py --help
```

## Step 1. Create the skeleton

Pick a short name for your clone (letters, digits, dashes). Then:

```
python engine/grid.py scaffold grids/your-name
```

This writes a complete, valid grid of 19 facets and 80 cells, each holding a placeholder line, plus a stamped manifest. It refuses if a grid already exists at that path, so it can never overwrite one. Confirm it worked:

```
python engine/grid.py validate grids/your-name
```

You should see `OK: 19 facets, 80 cells, no findings.` It validates because the placeholders count as content. That is the starting shape, not a finished clone.

## Step 2. Learn what each cell is for

Open the cells in `grids/blank-template/`. Every cell carries commented prompts describing what belongs in it. Read `core/CONTEXT.md`, `core/DO.md`, `core/DONT.md`, `core/VOICE.md`, and `core/GATES.md` first, then look at one specialist, one mode, one role, and one register to see how the four kinds differ. The prompts are HTML comments, so they are invisible when the markdown is rendered and visible when you edit the raw file.

The five cell types:

- CONTEXT: standing facts this facet always needs. Background and constraints that do not change turn to turn.
- DO: what this facet should actively do. Imperative lines, each a rule that stands alone.
- DONT: hard prohibitions. Each one a "Never X" that survives being read with no DO cell present. "Prefer X" is not a prohibition.
- VOICE: how the voice sounds. Rhythm, allowed markers, and the bans. Core and registers only.
- GATES: names and pointers only. List each rule's name, its trigger, and where the full rule text lives. Never copy the rule text into a cell, because a second copy is a second thing to go stale.

## Step 3. Fill in the cells

Start with `core`, it loads in every composition, so it matters most. Open `grids/your-name/core/CONTEXT.md`, delete the placeholder line, and write the real thing. Work through the core cells, then the specialists, modes, roles, and registers.

Write like the person, not about the person. A summary of someone is not that someone. Quote real phrasing in VOICE. Keep DONT lines absolute.

## Step 4. Bless your changes

After editing, the recorded hashes no longer match the files. See the drift first:

```
python engine/grid.py check grids/your-name
```

Then record the new state:

```
python engine/grid.py stamp --force grids/your-name
```

`--force` is required after the first stamp. Re-stamping blesses your edits with a new hash, and the engine will not do that silently. This is the guardrail: a clone cannot be changed without you saying you meant it.

## Step 5. Validate

```
python engine/grid.py validate grids/your-name
```

Fix anything it flags, then stamp and validate again. `MISSING_REQUIRED_CELL` means a cell file is gone. `EMPTY_REQUIRED_CELL` means a cell has only headings or comments, no real content. `HASH_DRIFT` means you edited since the last stamp, go back to Step 4.

## Step 6. Compose the clone

This is the payoff. Assemble the identity for a given situation:

```
python engine/grid.py compose grids/your-name --specialist engineer --register surgery
```

Available axes: `--specialist`, `--mode`, `--role`, `--register`. Leave one off and it is not loaded. The output is the full prompt, plus a receipt listing exactly which cells were loaded and their ids, so you always know what the clone was built from. Paste that output into a fresh AI session and you are talking to the clone.

## Step 7. Keep it honest

- Never hand-edit the manifest. It is generated. Edit cells, then stamp.
- Run `validate` before you trust a composition.
- Put the clone under version control (this repo already is). Every change to a person's clone should have a diff and a history.
- The engine guarantees delivery, not truth. It will refuse a missing or empty cell, but it cannot tell whether what you wrote is actually true to the person. That part is on you.
