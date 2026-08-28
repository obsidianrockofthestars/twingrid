# librarian / DONT

- **Never modify anything in the `the notes` folder.** Filling a BLANK answer slot in a calibration question file is an addition and is permitted (Dylan ruling 2026-08-12); editing or deleting an existing question or an existing answer is not.
- **Never delete or modify calibration data in `the notes/`.** It is sacred.
- **Never file a paraphrase of Dylan as Raw calibration.** Source material enters `the notes` byte-faithful, typos and all. Paraphrase and synthesis live only in the wiki layer, clearly marked as synthesis. A clone trained on a summary of a man becomes a summary of a man. (Verbatim Ingest Gate.)
- **Never use the Edit or Write tool on vault files.** Python in-place writes only, verified with `wc -l` and `tail`. (Gate, 2026-06-10.)
- **Never `mv`, `rm` or rename on the one engine mount.** EPERM truncates the target.
- **Never `device_commit_files` over an existing vault file** on a cloud or file-bridge session. Write a fresh sibling path, verify it on-device by size, md5 and sentinel, then do a device-local copy in, re-verify, and clear the sibling. (Cloud-Bridge Write Discipline.)
- **Never stage a vault write through `/tmp` on the device bridge.** `/tmp` is shared across concurrent one engine threads, and on 2026-08-04 a denied write left another session's log to be read as if it were ours, passing every existing check. Any shell call that writes then reads chains with `&&`. (Shared-Temp Staging Ban.)
- **Never prepend an entry directly to `the wiki`.** Write a shard. `log.md` is generated.
- **Never render `log.md` before running `a script --absorb`,** and never render when the render would delete a line.
- **Never order shards by parsing their headings.** The ordinal in the filename is the order; the 422 migrated entries carry 33 distinct heading conventions.
- **Never edit `the config` unilaterally.** Propose the change, show Dylan, then apply. The gate registry lives there and nowhere else.
- **Never copy a gate's full text into a grid cell, a wiki page or a skill.** Names, triggers and Detail pointers only. A second source of truth for a gate is how a gate goes stale.
- **Never log an edit that did not land,** and never log a snapshot or integrity result the session did not actually produce. A bridge session that cannot snapshot says plainly that it produced none and names the last good archive. (Checkpoint Verification Gate.)
- **Never repair a truncation CRITICAL before re-reading the file at a stable size.** A file that is growing is not a file that is truncated, and the dangerous response is restoring a snapshot over newer work that was never damaged. (Concurrent-Write Re-Read Gate.)
- **Never keep writing after the checkpoint.** The checkpoint closes the session; a post-checkpoint change reopens it with a satellite entry and a fresh S6.
- **Never copy the full vault to any cloud or external backup location.** Redundancy is local snapshots only, last 14. The one carve-out is the private allow-listed `clone-dylan-brain` repo carrying Tier 1 only, which is never used to restore.
- **Never assert a page, link, entry or file is missing without searching first.** Absence is a claim like any other and it needs a source. (Negative Claim Gate.)
