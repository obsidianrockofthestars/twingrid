#!/usr/bin/env python3
"""
TwinGrid local runner. Chat with a grid-composed clone on your own machine,
with your own key. No web, no account. Friendly for any setup.

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  python twingrid_chat.py my-grid.json --specialist engineer --register surgery
  python twingrid_chat.py my-grid.json --all                 # full power (every facet)
  python twingrid_chat.py my-grid.json --queue engineer,writer,qa-skeptic

Grid JSON is what the TwinGrid site's "Export grid" button gives you, or any
grids/<name> folder run through the engine. Only depends on the Python stdlib.
"""
import argparse, json, os, sys, urllib.request

CELLORDER = ["CONTEXT", "DO", "DONT", "GATES", "VOICE"]

def load(path):
    d = json.load(open(path, encoding="utf-8"))
    return {f["name"]: f for f in d["facets"]}

def compose(byname, facets):
    out = []
    for fn in facets:
        f = byname.get(fn)
        if not f: continue
        for c in CELLORDER:
            t = f["cells"].get(c)
            if t and t.strip():
                out.append("# %s / %s\n\n%s" % (fn, c, t))
    return "\n\n---\n\n".join(out)

def call(system, messages, model):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        sys.exit("Set ANTHROPIC_API_KEY first.")
    body = json.dumps({"model": model, "max_tokens": 1024,
                       "system": system, "messages": messages}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body,
        headers={"content-type": "application/json", "x-api-key": key,
                 "anthropic-version": "2023-06-01"})
    with urllib.request.urlopen(req) as r:
        j = json.load(r)
    return j["content"][0]["text"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("grid")
    ap.add_argument("--specialist"); ap.add_argument("--mode")
    ap.add_argument("--role"); ap.add_argument("--register", default="vibe")
    ap.add_argument("--all", action="store_true", help="full power: load every facet")
    ap.add_argument("--queue", help="comma-separated specialists, run one after another")
    ap.add_argument("--model", default=os.environ.get("TWINGRID_MODEL", "claude-sonnet-4-5"))
    a = ap.parse_args()
    byname = load(a.grid)

    if a.queue:
        specs = [s.strip() for s in a.queue.split(",") if s.strip()]
        print("Queue / council mode: %d runs.\n" % len(specs))
        for i, sp in enumerate(specs, 1):
            facets = ["core", sp] + [x for x in [a.mode, a.role, a.register] if x]
            print("=" * 60 + "\nRUN %d: %s\n" % (i, sp) + "=" * 60)
            print(call(compose(byname, facets),
                       [{"role": "user", "content": "Introduce yourself and how you'd approach my work."}], a.model), "\n")
        return

    if a.all:
        facets = list(byname.keys())
    else:
        facets = ["core"] + [x for x in [a.specialist, a.mode, a.role, a.register] if x]
    system = ("You are this person's clone. Speak in first person as them, following "
              "these cells verbatim as your identity, voice, and rules:\n\n" + compose(byname, facets))
    print("Loaded %d facets. Ctrl-C to quit.\n" % len(facets))
    history = []
    while True:
        try:
            user = input("you > ").strip()
        except (EOFError, KeyboardInterrupt):
            print(); break
        if not user: continue
        history.append({"role": "user", "content": user})
        reply = call(system, history, a.model)
        history.append({"role": "assistant", "content": reply})
        print("\nclone > " + reply + "\n")

if __name__ == "__main__":
    main()
