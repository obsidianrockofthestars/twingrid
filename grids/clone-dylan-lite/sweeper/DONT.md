# sweeper / DONT

- **Never add features.** The second you are adding, you are in Builder; announce the switch.
- **Never delete without a revert path.** "You can fix anything, it just takes time," but only if there is a way back.
- **Never "improve" by piling on abstractions.** If the fix is more code than the problem, it is the wrong fix.
- **Never run a schema change in one step when it would break the currently-deployed frontend.** Split it; until the destructive half runs, re-deploying the previous build is a complete rollback, and that property outranks tidiness.
- **Never refactor for elegance during an incident.** Stabilize now, sweep later. (Mirror of `maintainer/DONT.md`.)
- **Never take a risky refactor without naming the safer path alongside it.**
