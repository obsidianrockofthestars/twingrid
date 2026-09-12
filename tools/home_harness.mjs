// Local harness for the signed-in Home and the persona page (v17). Writes docs/_harness.html: the real page with the Supabase client
// swapped for an in-memory stub holding sample grids in the live data shape, and a fake session. Serve docs/ and open /_harness.html
// (the Home) or /_harness.html?t=g1 (the persona page). Never committed: docs/_harness.html is gitignored. No network write can happen.
import fs from 'node:fs';
const root=new URL('../',import.meta.url); const rd=p=>fs.readFileSync(new URL(p,root),'utf8');
let h=rd('docs/index.html');
const tpl=k=>JSON.parse(rd('docs/templates/'+k+'.json'));
const mk=(id,name,k,theme,extra)=>Object.assign({id,name,owner:'u1',is_public:true,updated_at:'2026-09-11T14:00:00Z',image_url:null,voice_id:null,data:Object.assign({facets:tpl(k).facets,theme},extra||{})},{});
const twinFlag=process.argv.includes('--twin')?{twin:true}:{};
const depthFlag=process.argv.includes('--depth')?{depth:{on:true,done:[]}}:{}; // --depth opens the hatch on g1 so the basement's facet pages can be measured
const room=(process.argv.find(a=>a.startsWith('--room='))||'--room=studio').slice(7);
const grids=[mk('11111111-1111-4111-8111-111111111111','Me','coach','nebula',Object.assign({avatar:{body:'standing'},house:{room,mood:'calm',zones:{thinking:[{obj:'desk-lamp',x:3,y:1,facet:'manager'}],resting:[],memory:[]}}},twinFlag,depthFlag)),mk('22222222-2222-4222-8222-222222222222','My Shop','support','light:#2F7D6E'),mk('33333333-3333-4333-8333-333333333333','Alrat','character','coral')];
if(process.argv.includes('--empty')) grids.length=0;
const tokens=[{id:'t1',owner:'u1',label:'my laptop AI',created_at:'2026-09-10T12:00:00Z',last_used_at:'2026-09-11T18:00:00Z',revoked_at:null},{id:'t2',owner:'u1',label:'the old one',created_at:'2026-08-02T12:00:00Z',last_used_at:null,revoked_at:'2026-09-01T12:00:00Z'}];
const agwrites=[{grid_id:'11111111-1111-4111-8111-111111111111',kind:'answers',n_written:5,created_at:'2026-09-11T18:00:00Z'},{grid_id:'11111111-1111-4111-8111-111111111111',kind:'cells',n_written:1,created_at:'2026-09-11T09:20:00Z'},{grid_id:'33333333-3333-4333-8333-333333333333',kind:'answers',n_written:12,created_at:'2026-09-10T21:05:00Z'}];
const stub=`const __H={grids:${JSON.stringify(grids)},tokens:${JSON.stringify(tokens)},agwrites:${JSON.stringify(agwrites)}};
function __q(table){ const st={table,op:'select',filters:{}}; const b={}; ['select','eq','neq','in','is','order','limit','gte','lte','or','maybeSingle','single','insert','update','delete','upsert'].forEach(m=>{ b[m]=(...a)=>{ if(['update','insert','delete','upsert'].includes(m)){ st.op=m; st.payload=a[0]; } if(m==='eq') st.filters[a[0]]=a[1]; if(m==='maybeSingle'||m==='single') st.one=true; if(m==='select'&&a[1]&&a[1].head) st.head=true; return b; }; }); b.then=(res,rej)=>Promise.resolve().then(()=>__resolve(st)).then(res,rej); return b; }
function __resolve(st){ const T=st.table; if(T==='twingrid_grids'||T==='twingrid_grids_public'){ if(st.op==='update'){ const g=__H.grids.find(x=>x.id===st.filters.id); if(g){ Object.assign(g,JSON.parse(JSON.stringify(st.payload))); } return {data:st.one?g:null,error:null}; } if(st.op==='insert'){ const g=Object.assign({id:'44444444-4444-4444-8444-'+String(__H.grids.length).padStart(12,'0'),is_public:false,updated_at:new Date().toISOString(),image_url:null,voice_id:null},JSON.parse(JSON.stringify(st.payload))); __H.grids.push(g); return {data:st.one?g:[g],error:null}; } const rows=__H.grids.filter(g=>Object.keys(st.filters).every(k=>g[k]===st.filters[k])); if(st.one) return {data:rows[0]?JSON.parse(JSON.stringify(rows[0])):null,error:null}; return {data:JSON.parse(JSON.stringify(rows)),error:null}; }
  if(st.head) return {count:0,error:null}; if(T==='twingrid_accounts') return {data:st.one?{id:'u1',handle:'tester',display_name:'Tester',bio:'A sample account for the harness.',is_suspended:false,is_official:false,adult_confirmed_at:null,avatar_theme:null}:[],error:null};
  // Agent access (2026-09-11): the hash-free view the account page lists keys from. No token_hash here, exactly as in SQL.
  if(T==='twingrid_agent_tokens_mine') return {data:__H.tokens.map(t=>Object.assign({},t)),error:null};
  if(T==='twingrid_agent_writes') return {data:__H.agwrites.map(t=>Object.assign({},t)),error:null};
  return {data:st.one?null:[],error:null}; }
const __S=${process.argv.includes('--signedout')?'null':"{user:{id:'u1',email:'tester@example.com'}}"};
const SB={from:__q, rpc:()=>Promise.resolve({data:[],error:null}), storage:{from:()=>({upload:()=>Promise.resolve({error:{message:'harness'}}),remove:()=>Promise.resolve({})})}, auth:{getSession:()=>Promise.resolve({data:{session:__S}}), getUser:()=>Promise.resolve({data:{user:__S.user}}), onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}), signOut:()=>Promise.resolve({}), updateUser:()=>Promise.resolve({}), signInWithOtp:()=>Promise.resolve({}), signInWithPassword:({email,password})=>Promise.resolve(password==='correct-horse'?{data:{session:{user:{id:'u1'}}},error:null}:{data:{},error:{message:'Invalid login credentials'}}), signUp:({email})=>Promise.resolve(/@confirm\./.test(email)?{data:{user:{id:'u2'},session:null},error:null}:{data:{user:{id:'u2'},session:{user:{id:'u2'}}},error:null}), resetPasswordForEmail:()=>Promise.resolve({error:null}), signInWithOAuth:()=>Promise.resolve({error:null}) }};
// The agent lane routes, stubbed: the harness never reaches a Worker, and the token it shows is a sample string.
const __rf=window.fetch.bind(window); window.fetch=function(u,init){ const s=String(u&&u.url?u.url:u);
  if(s.indexOf('/api/agent/')>=0){ const body=(init&&init.body)?JSON.parse(init.body):{};
    if(s.indexOf('/token/revoke')>=0){ const t=__H.tokens.find(x=>x.id===body.id); if(t) t.revoked_at=new Date().toISOString(); return Promise.resolve(new Response(JSON.stringify({ok:true,id:body.id}),{status:200,headers:{'content-type':'application/json'}})); }
    const label=String(body.label||'').trim().slice(0,60)||'agent'; const id='t'+(__H.tokens.length+1);
    __H.tokens.unshift({id,owner:'u1',label,created_at:new Date().toISOString(),last_used_at:null,revoked_at:null});
    return Promise.resolve(new Response(JSON.stringify({token:'pka_sAmPLe-ha4rness-tok3n-not-a-real-key-000',id,label,created_at:new Date().toISOString()}),{status:200,headers:{'content-type':'application/json'}})); }
  return __rf(u,init); };
window.__H=__H; window.__scenes=[]; (function(){ function hook(){ var o=window.pkScene.scene; window.pkScene.scene=function(c,op){ var s=o(c,op); if(s) window.__scenes.push({canvas:c,scene:s,opts:op}); return s; }; } if(window.pkScene) hook(); else { var w=setInterval(function(){ if(!window.pkScene) return; clearInterval(w); hook(); },1); } })();`;
const a='const SB = createClient("https://jpepcqazscmhakxvutpg.supabase.co","sb_publishable_OJGmKJoI67e4I5Z_cib8yA_n7y5kjz2");';
if(!h.includes(a)) throw new Error('SB anchor missing');
h=h.replace(a,stub).replace("import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';","");
h=h.replace(/src="(\/?scene\.js|\/?avatar\.js)"/g,(m,f)=>'src="'+f+'?v='+Date.now()+'"'); // the static server has no cache headers; a stale scene.js measured as the new one once
fs.writeFileSync(new URL('docs/_harness.html',root),h); console.log('wrote docs/_harness.html with '+grids.length+' grids'+(twinFlag.twin?' (g1 is the twin)':''));
