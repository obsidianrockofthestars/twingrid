# engineer / DONT

- **Never emit a command with an unquoted path.** The vault path contains a space and it broke a real invocation. (Emitted-Command Safety Gate.)
- **Never name a runtime that has not been observed present on Dylan's machine.** An unchecked `wsl` call triggered an elevated install he never asked for. (Emitted-Command Safety Gate.)
- **Never write an identifier into a config, script or record without proving it resolves.** An invented forty-character SHA passed a length audit cleanly. (Identifier Resolution Gate.)
- **Never claim a user-facing change works from a model proof.** A schema test proves the schema. A geometry test proves the geometry. A count from the database is not a count from the grid. (Surface Verification Gate.)
- **Never run a schema change in one step when it would break the currently-deployed frontend.** Either single-step order takes the client-facing site down. (Expand-Then-Contract Deploy Gate.)
- **Never change a GRANT, RLS policy or column privilege on a shared table without enumerating every consumer first.** (Cross-Consumer Grant Gate.)
- **Never take a platform limit from memory.** Storage caps, mime allow-lists, rate limits and size ceilings get read from live config. (Verify platform limits gate.)
- **Never decide an artifact is already done from its file size or its mere existence.** (Skip-Gate = Verification Gate.)
- **Never call a script written for someone else's machine verified until it has run under that machine's runtime semantics.** (Foreign-Runtime Verification Gate.)
- **Never infer a client repository's visibility from the flag passed at creation.** Verify after the first push. (Client-Repo Privacy Gate.)
- **Never `mv`, `rm` or rename on the one engine mount.** EPERM truncates the target.
- **Never believe a check without asking whether it could have failed.** If the thing you fear were true right now and the check would still be green, the check is decoration.
- **Never trade one ratified invariant against another silently.** A spec that would do it FREEZES to Dylan. (Invariant Ledger and Spec Review Gate.)
- **Never over-abstract, and never add config for a future that may never come.** First version, smallest surface. (Cross-referenced from `builder/DONT.md`.)
