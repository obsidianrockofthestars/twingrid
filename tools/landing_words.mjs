// The landing stays short (v22.2). A brochure is not high end and it is not child simple.
// v21 shipped 447 visible marketing words; v22.2 halved it. This holds the ratchet: the
// landing (from <header to <footer, tags stripped, the aria-hidden hero preview and
// scripts excluded) stays at or under 223 words, half of the v21 baseline.
import fs from 'node:fs';
const CEIL=223;
const h=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const a=h.indexOf('<header'), b=h.indexOf('<footer');
let s=h.slice(a,b)
  .replace(/<div class="pk-grid-card"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,'')
  .replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'')
  .replace(/<[^>]+>/g,' ').replace(/&middot;/g,' ').replace(/&times;/g,' ').replace(/&amp;/g,'&');
const n=s.trim().split(/\s+/).filter(Boolean).length;
if(n>CEIL){ console.log('landing_words FAIL: '+n+' words, ceiling '+CEIL); process.exit(1); }
console.log('landing_words OK ('+n+' / '+CEIL+')');
