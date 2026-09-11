// The question bank (v16 leg 3): docs/catalog/questions.json, one record per question. Exit 1 on any miss.
// Usage: node tools/questions_check.mjs [path]   (default docs/catalog/questions.json; a batch file may hold a subset of facets)
import fs from 'node:fs';
const path=process.argv[2]||new URL('../docs/catalog/questions.json',import.meta.url);
const FACETS=['core','manager','designer','marketer','engineer','writer','qa-skeptic','librarian','prototyper','builder','sweeper','grower','maintainer','teacher','business-partner','worker','vibe','surgery','full-copy','hat'];
const CELLS=['CONTEXT','DO','DONT','GATES','VOICE'];
const DASH=/[\u2012\u2013\u2014\u2015\u2212-]/;
const TRAP=/\b(full name|last name|surname|real name|date of birth|birthday|birth date|social security|ssn|passport|driver'?s licen|street address|home address|mailing address|zip code|postcode|phone number|email address|password|bank|salary|income|net worth|how much (do you (earn|make|owe)|money)|credit card|account number|diagnos|medication|illness|disease|disabilit|therapist|mental health|pregnan|where (do )?you live|hometown|home town|employer'?s? name|company name|school name|(kid|child|children|son|daughter|wife|husband|spouse|partner|mother|father|mom|dad)'?s? (name|age|school|birthday))\b/i;
let fails=0; const bad=(m)=>{ fails++; if(fails<=60) console.log('FAIL '+m); };
let rows; try{ rows=JSON.parse(fs.readFileSync(path,'utf8')); }catch(e){ console.log('FAIL cannot read '+path+': '+e.message); process.exit(1); }
if(!Array.isArray(rows)){ console.log('FAIL not an array'); process.exit(1); }
const ids=new Set(); const per={};
rows.forEach((r,i)=>{ const at='row '+i+' '+(r&&r.id);
  if(!r||typeof r!=='object'){ bad(at+' not an object'); return; }
  const keys=Object.keys(r).sort().join(','); const want=(r.type==='choice')?'cell,facet,hint,id,options,q,type,weight':'cell,facet,hint,id,q,type,weight'; if(keys!==want) bad(at+' keys '+keys+' (want '+want+')');
  if(FACETS.indexOf(r.facet)<0) bad(at+' facet '+r.facet); if(CELLS.indexOf(r.cell)<0) bad(at+' cell '+r.cell);
  if(!/^[a-z-]+\.(CONTEXT|DO|DONT|GATES|VOICE)\.\d{2}$/.test(String(r.id))) bad(at+' id shape'); else { const [f,c]=r.id.split('.'); if(f!==r.facet||c!==r.cell) bad(at+' id does not match facet and cell'); }
  if(ids.has(r.id)) bad(at+' duplicate id'); ids.add(r.id);
  const q=String(r.q||''); if(!q.trim()) bad(at+' empty q'); if(q.length>=140) bad(at+' q '+q.length+' chars'); if(DASH.test(q)) bad(at+' dash in q'); if(!/\b(you|your|yours|yourself)\b/i.test(q)) bad(at+' q is not second person'); if(!/\?$/.test(q.trim())) bad(at+' q does not end with a question mark'); if(TRAP.test(q)) bad(at+' privacy trap in q: '+q);
  const hint=String(r.hint||''); if(hint.length>=90) bad(at+' hint '+hint.length+' chars'); if(DASH.test(hint)) bad(at+' dash in hint'); if(TRAP.test(hint)) bad(at+' privacy trap in hint');
  if(r.type!=='text'&&r.type!=='choice') bad(at+' type '+r.type);
  if(r.type==='choice'){ if(!Array.isArray(r.options)||r.options.length<2||r.options.length>5) bad(at+' options count'); else r.options.forEach((o,k)=>{ o=String(o); if(!o.trim()||o.length>=140) bad(at+' option '+k+' length'); if(DASH.test(o)) bad(at+' dash in option '+k); if(!/[.!?]$/.test(o.trim())) bad(at+' option '+k+' is not a sentence: '+o); if(TRAP.test(o)) bad(at+' privacy trap in option '+k); }); if(new Set((r.options||[]).map(o=>String(o).toLowerCase())).size!==(r.options||[]).length) bad(at+' duplicate options'); }
  if(!Number.isInteger(r.weight)||r.weight<1||r.weight>3) bad(at+' weight '+r.weight);
  per[r.facet]=per[r.facet]||{}; per[r.facet][r.cell]=(per[r.facet][r.cell]||0)+1; });
Object.keys(per).forEach(f=>{ const n=CELLS.reduce((a,c)=>a+(per[f][c]||0),0); const lo=f==='hat'?25:35, hi=f==='hat'?25:45; if(n<lo||n>hi) bad('facet '+f+' has '+n+' questions (want '+lo+' to '+hi+')'); CELLS.forEach(c=>{ if((per[f][c]||0)<5) bad('facet '+f+' cell '+c+' has '+(per[f][c]||0)+' (want 5 or more)'); }); });
const facets=Object.keys(per); console.log((fails?'questions_check: '+fails+' failed':'questions_check OK')+' ('+rows.length+' questions, '+facets.length+' facets)'); process.exit(fails?1:0);
