# librarian / DO

- **Run `the guard scripts` as the session's FIRST action,** before trusting or building on any vault content. Repair any CRITICAL from the newest clean snapshot by filename timestamp, and log the repair, before doing anything else. (Start-of-Session Context Gate.)
- **Read the rollup layer before the raw layer:** `the wiki`, then `the wiki`, then the relevant pages, then the last 2 to 3 session logs. Go to `the notes` only for deep dives. **Never grep a large operational file for context the rollup already carries.**
- **Sweep `inbox.md` near session start.** Fold quick items into the right wiki page or Raw session log, spin up a full session log when an item needs room, then move the line to the Swept section with a pointer to what it became.
- **Discuss key takeaways with Dylan before writing anything** on an ingest. Step 2 of the workflow comes before step 3 on purpose.
- **Cross-link aggressively, across all four domains** (business, creative, technical, personal). If a concept appears in two domains it MUST be linked. That is the whole point, and orphan pages are a bug.
- **Expect a single source to touch 10 to 15 wiki pages.** That is normal, not scope creep.
- **Update `the wiki` and `the wiki` after every change,** every time.
- **Write every `log.md` entry as a shard through `the guard scripts`,** never by prepending to `log.md` by hand. Give each session its own `##` heading and `[[session-log]]` wikilink, including same-day satellite sessions, and name the engine that produced it.
- **Run `--absorb` before `--render`, always,** and verify line by line that the render deletes nothing. A render that only ADDS is safe; a render that would remove a line is a stop.
- **End every page under `the wiki` with the tail sentinel** and follow the page format in `librarian/CONTEXT.md`.
- **Cite every factual claim** as `(source: the notes/to/file.md)`. Note contradictions between sources explicitly. Mark an unsourced claim `[NEEDS VERIFICATION]`.
- **Say plainly when the answer is not in the wiki,** then offer to file the answer as a new page if it is worth keeping.
- **Run `the guard scripts` after every batch of vault writes,** not only at session start and end. (Mid-Session Integrity Checks.)
- **Take the snapshot AFTER the final write,** and confirm the new archive's byte counts match the finished files. (Checkpoint Verification Gate, S6 amendment.)
- **Go through `vault_write.read_for_update` then `write_verified(..., expect=fp)`** on every read-modify-write of a file another session may touch. md5 is the authority: the 2026-07-02 clobber preserved its own byte count.
- **Re-hash a source file FIRST and abort on mismatch** before applying anything derived from it. A byte count is not verification. (Source-Hash Stamp Gate.)
- **Stamp every time in `America/Chicago`.** my city is Central and that is core identity, not an accident of which sandbox the session booted in.
