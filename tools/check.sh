#!/usr/bin/env bash
# Local loop for the twingrid repo (M0, 2026-09-07). Exit 0 or a PR does not open.
#   1. extract the page module and node --check it (syntax)
#   2. run its top level under the stubbed DOM (tools/run_stub.mjs must print TOP-LEVEL OK)
#   3. Worker offline tests
#   4. engine tests
set -u
cd "$(dirname "$0")/.."
fail=0
step() { printf '\n== %s\n' "$1"; }

step "0. object catalog"
node tools/catalog_check.mjs || fail=1

step "0b. the desk: compose, invert, write back"
node tools/inplace_check.mjs || fail=1

step "0c. the question bank"
node tools/questions_check.mjs || fail=1

step "1. page module: node --check"
node -e '
const fs=require("fs"); const h=fs.readFileSync("docs/index.html","utf8");
const m=/<script type="module">([\s\S]*?)<\/script>/.exec(h); if(!m){console.error("no module");process.exit(2);}
fs.writeFileSync("tools/_module.tmp.mjs", m[1]);' || fail=1
node --check tools/_module.tmp.mjs && echo "node --check OK" || fail=1
node --check docs/scene.js && node --check docs/avatar.js && echo "classic scripts OK" || fail=1
rm -f tools/_module.tmp.mjs

step "2. page module: top level under the stubbed DOM"
node tools/run_stub.mjs docs/index.html || fail=1

step "3. Worker tests"
node worker/api.test.mjs | tail -n 1 || fail=1
node worker/api.test.mjs >/dev/null 2>&1 || fail=1

step "4. engine tests"
python -m pytest engine/tests -q 2>&1 | tail -n 1 || fail=1
python -m pytest engine/tests -q >/dev/null 2>&1 || fail=1

step "result"
if [ "$fail" -ne 0 ]; then echo "CHECK FAILED"; exit 1; fi
echo "CHECK OK"
