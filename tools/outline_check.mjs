// Control outlines clear 3 to 1 (2026-09-15, CLAUDE.md page rule 6). --line-w (#DEDEE8) is 1.34 to 1 on white, so a button,
// input or link-card whose only visible edge is that border cannot be seen by a low-vision visitor. #79 and #83 fixed three new
// controls by hand; this check holds every existing one. BOUNDARY: the border is the control's only edge; the cascade's last
// border colour for it and for every state of it (:hover, [aria-pressed], .done) must clear 3 to 1 on white, paper and paper-2.
// DARK: the same on the dark surfaces. THEMED: persona page controls, whose colours are derived per owner, must take --pmuted,
// which deriveTheme pulls to 4.5 to 1 on --pbg and --psurf for every theme. DECORATIVE: rules the sweep would flag whose border
// is not the control's edge, each with the reason. Any other control rule bordered in --line-w or --pline fails.
import fs from 'node:fs';
const h=fs.readFileSync(process.argv[2]||new URL('../docs/index.html',import.meta.url),'utf8'); // a path argument checks another copy, e.g. main's
const BOUNDARY=['#home .pkstep','#life .btn','.lfsel','.lfin','.lfta','#places .btn','.plcard','#account .pk-themebox input[type=color]','#account .pk-base',
  '#account .acedit input','#account .acedit textarea','#account .pkacform input','#home .hclaimrow input','#home .hrenrow input','#explore .excard','#account .excard',
  '#tourcard button','#home select','#home .hbtn','#home .hdoor','#mod .mtab','#mod .mbtn','.pctrl-b','.rptcard .field','.pk-btn.ghost','.pkwall-face',
  '#auth .authcard .field','#auth .oauthbtn','.nf-card','.nf-q textarea','.nf-q input','.nf-choice','.nf-tpl button','.pcopytext','#helpbtn','#tutbtn',
  '#helppanel .hpshow','#helppanel .hpq button.q','#tutfoot button','#tutnav button[aria-current="true"]'];
const DARK=['.chatin textarea','#pkroom .btn','#pkroom .pkrmratebox .phrbtn','#pkroom .pkrmratebox .phnote','#termsbar .pk-btn.solid'];
const THEMED=['#profile .btn.ghost','#profile .pctrl-b','body.route-profile #chat textarea','#profile .phobj','#profile .phrbtn','#profile .phnote','#profile .pkin select','#profile .pcopytext'];
// none today: the one candidate, the tutorial's current chapter, was measured at 1.34 with a fill of 1.2, so its border is the marker
const DECORATIVE={};
const css=[...h.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g,'');
const tok={}; for(const m of css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) tok[m[1]]=m[2]; // later :root blocks win, as in the cascade
const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>({parts:m[1].split(',').map(s=>s.trim().replace(/\s+/g,' ')),body:m[2]}));
const hex=v=>{ const t=/var\((--[\w-]+)\)/.exec(v); if(t) return tok[t[1]]||null; const x=/#[0-9a-fA-F]{6}\b/.exec(v); return x?x[0]:null; };
const lum=c=>{ const f=i=>{ const s=parseInt(c.slice(i,i+2),16)/255; return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4); }; return 0.2126*f(1)+0.7152*f(3)+0.0722*f(5); };
const ratio=(a,b)=>{ const x=lum(a),y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
const decl=(body,prop)=>{ const m=new RegExp('(?:^|;)\\s*'+prop+'\\s*:([^;]*)').exec(body); return m?m[1]:null; };
const borderRaw=body=>{ const c=decl(body,'border-color'); return c!==null?c:decl(body,'border'); };
// the cascade, flattened: the last rule that sets a border for a selector wins (rules here never differ in specificity for one selector)
const last={}; for(const r of rules){ const raw=borderRaw(r.body); if(raw===null) continue; for(const p of r.parts) last[p]=raw; }
const colourOf=raw=>/^\s*(0|none)\b|transparent/.test(raw)?'none':hex(raw);
let fails=0; const say=(ok,m)=>{ if(!ok) fails++; console.log((ok?'ok   ':'FAIL ')+m); };
const states=b=>Object.keys(last).filter(p=>p===b||(p.startsWith(b)&&/^[:\[.]/.test(p.slice(b.length))));
const measure=(list,names)=>{ const surf=names.map(k=>tok[k]); for(const b of list){ say(b in last,b+': rule found');
  for(const p of states(b)){ const c=colourOf(last[p]); if(c==='none') continue; if(!c){ say(false,p+' border '+last[p].trim()+' does not resolve'); continue; }
    const min=Math.min(...surf.map(s=>ratio(c,s))); say(min>=3,p+' border '+c+' is '+min.toFixed(2)+' to 1 at worst on '+names.join(', ')); } } };
measure(BOUNDARY,['--card-w','--paper','--paper-2']);
measure(DARK,['--surface','--ground']);
for(const b of THEMED){ say(b in last&&/var\(--pmuted\)/.test(last[b]),b+' border takes --pmuted: '+(last[b]||'no rule').trim()); }
// the sweep: a control-shaped rule bordered in --line-w or --pline is either classified above or a failure
// ponytail: selector keywords and cursor:pointer find controls; an <a> link-card with neither is caught only by the lists above
const known=new Set([...BOUNDARY,...DARK,...THEMED]);
for(const r of rules){ const bd=borderRaw(r.body)||''; if(!/--line-w\b|--pline\b/.test(bd)) continue;
  for(const p of r.parts){ if(!(/\b(button|input|select|textarea)\b|btn\b|\.field\b/.test(p)||/cursor\s*:\s*pointer/.test(r.body))) continue;
    if(known.has(p)) continue;
    if(DECORATIVE[p]) { console.log('ok   '+p+' decorative: '+DECORATIVE[p]); continue; }
    say(false,p+' is a control bordered in '+bd.trim()+' and is in no list'); } }
console.log(fails?('outline check: '+fails+' failure(s)'):'outline check OK');
process.exit(fails?1:0);
