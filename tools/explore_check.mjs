// Explore search + sort (v23). Pure functions lifted straight off the page, the way
// tools/inplace_check.mjs lifts other functions. Exit 1 on any miss.
import fs from 'node:fs';
const h=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const cut=(from,to)=>{ const i=h.indexOf(from); const j=h.indexOf(to,i); if(i<0||j<0) throw new Error('anchor missing: '+from.slice(0,40)); return h.slice(i,j+to.length); };
const src=[
  cut('function pkxAvgRating(scores,id){','{avg:0,n:0};\n}'),
  cut('function pkxShowTopRated(scores,ids){','.n>0); }'),
  cut('function pkxMatch(name,summary,query){','s.indexOf(q)>=0;\n}'),
  cut('function pkxSortRows(rows,mode,counts,scores){','return out;\n}'),
].join('\n');
if(/innerHTML/.test(src)) throw new Error('innerHTML found in the lifted functions');
const {pkxAvgRating,pkxShowTopRated,pkxMatch,pkxSortRows}=new Function(src+'\nreturn {pkxAvgRating,pkxShowTopRated,pkxMatch,pkxSortRows};')();

let fails=0; const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } };

// ---- pkxMatch: name and summary, case-insensitive, trimmed, empty query matches everything ----
ok(pkxMatch('The Coach','Here to help you plan.','coach')===true,'matches name case-insensitively');
ok(pkxMatch('The Coach','Here to help you plan.','COACH')===true,'matches name regardless of query case');
ok(pkxMatch('The Coach','Here to help you plan.','plan')===true,'matches the summary text');
ok(pkxMatch('The Coach','Here to help you plan.','baker')===false,'no match when neither field contains the query');
ok(pkxMatch('The Coach','Here to help you plan.','  coach  ')===true,'query is trimmed');
ok(pkxMatch('The Coach','Here to help you plan.','')===true,'an empty query matches everything');
ok(pkxMatch('The Coach','Here to help you plan.','   ')===true,'a whitespace-only query matches everything');

// ---- pkxShowTopRated: only render the control once at least one persona has a rating ----
ok(pkxShowTopRated({},['a','b'])===false,'no scores at all: Top rated stays hidden');
ok(pkxShowTopRated({a:[{lane:'human',avg_rating:4.6,n:0}]},['a','b'])===false,'a lane with zero reviews is not a rating');
ok(pkxShowTopRated({a:[{lane:'human',avg_rating:4.6,n:3}]},['a','b'])===true,'one rated persona is enough to show the control');

// ---- pkxSortRows ----
const rows=[
  {id:'a',updated_at:'2026-09-10T00:00:00Z'},
  {id:'b',updated_at:'2026-09-12T00:00:00Z'},
  {id:'c',updated_at:'2026-09-11T00:00:00Z'},
];
// Newest: updated_at descending
ok(pkxSortRows(rows,'newest',null,{}).map(r=>r.id).join(',')==='b,c,a','Newest orders by updated_at descending');

// Popular: by visit count descending, ties fall back to newest
const counts={a:2,b:2,c:9};
ok(pkxSortRows(rows,'popular',counts,{}).map(r=>r.id).join(',')==='c,b,a','Popular orders by count, tied counts fall back to newest');

// Popular with no counts (fetch failed): silently falls back to Newest
ok(pkxSortRows(rows,'popular',null,{}).map(r=>r.id).join(',')==='b,c,a','Popular with no counts falls back to Newest');

// Top rated: by average descending, then by review count, then newest
const scores={
  a:[{lane:'human',avg_rating:4.0,n:5}],
  b:[{lane:'human',avg_rating:4.8,n:1}],
  c:[{lane:'human',avg_rating:4.0,n:9}],
};
ok(pkxSortRows(rows,'top',null,scores).map(r=>r.id).join(',')==='b,c,a','Top rated orders by average, then by review count');
// no ratings anywhere: every row ties at avg 0 / n 0, so it falls back to newest
ok(pkxSortRows(rows,'top',null,{}).map(r=>r.id).join(',')==='b,c,a','Top rated with no ratings at all ties out to newest');

// pkxSortRows must not mutate its input
const before=rows.map(r=>r.id).join(',');
pkxSortRows(rows,'popular',counts,{});
ok(rows.map(r=>r.id).join(',')===before,'pkxSortRows returns a new array, does not sort in place');

// Prime review (2026-09-14). A control's outline is non-text contrast and needs 3 to 1 on the card: --line-w measures 1.34 to 1,
// --ink-soft 8.49 to 1 (the same fix as the go back button, #79). And the Top rated control is proven hidden where it has nothing
// behind it by the render line itself, not only by the helper that decides it (Rendered-Control, both directions).
ok(/#explore \.pkxsearch\{[^}]*border:1px solid var\(--ink-soft\)/.test(h),'the search box outline clears 3 to 1 on the card');
ok(/#explore \.pkxsortbtn\{[^}]*border:1px solid var\(--ink-soft\)/.test(h),'the sort button outline clears 3 to 1 on the card');
ok(/id="pkxsorttop" aria-pressed="false" hidden>Top rated</.test(h),'Top rated ships hidden in the markup, so a slow or failed load never shows it empty');
ok(h.includes('if(sortBtns.top) sortBtns.top.hidden=!showTop;'),'the render hides Top rated exactly when no persona has a rating');
ok(h.includes("if(mode==='top' && !showTop) mode='newest';"),'a remembered Top rated sort falls back to Newest when there is nothing to rate by');

if(fails){ console.log(fails+' FAILED'); process.exit(1); }
console.log('explore_check OK');
