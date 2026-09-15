// The desk on the signed-in Home (v16): nfCompose writes the five core cells from the fourteen answers, pkhpInvert reads them back,
// pkhpWriteBack rebuilds a cell it can explain and appends under one it cannot. Exit 1 on any miss. Functions are lifted from the page.
import fs from 'node:fs';
const h=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const cut=(from,to)=>{ const i=h.indexOf(from); const j=h.indexOf(to,i); if(i<0||j<0) throw new Error('anchor missing: '+from.slice(0,40)); return h.slice(i,j+to.length); };
const src=[cut('function nfCell(name,parts)','(add your own here)"); }'),cut('function nfCompose(A)',"GATES:nfCell('GATES',[A('rule'), A('line')]) }; }"),cut('const PK_CORE_HDR=','/i;'),cut('function pkhpInvert(cells)','return {a,ok}; }'),cut('function pkhpWriteBack(cells,ans,ok)','return out; }'),cut('function pkhpAppend(old,s)','+s; }'),cut('function pkHatName(v,facets)','return {name:v}; }'),cut('function pkHatCells(cells,name)','return out; }'),cut('function nfLenientParse(txt, known)','return out;\n}'),cut('function pkagParse(raw, known)','return obj;\n}'),cut('function pkagMap(obj, qs)','return {got,dropped,ignored}; }'),cut('function pkagQLine(q)',":''); }")].join('\n');
const {nfCompose,pkhpInvert,pkhpWriteBack,pkhpAppend,pkHatName,pkHatCells,pkagParse,pkagMap,pkagQLine}=new Function(src+'\nreturn {nfCompose,pkhpInvert,pkhpWriteBack,pkhpAppend,pkHatName,pkHatCells,pkagParse,pkagMap,pkagQLine};')();
let fails=0; const ok=(c,m)=>{ if(!c){ fails++; console.log('FAIL '+m); } };
const A={who:'A calm designer.',days:'shipping things',values:'honesty, craft',help:'Bottom line first.',decide:'research, then gut',direct:'Blunt',never:'Never flatter me.',peeves:'No jargon.',formality:'Casual',phrases:'Done is better.',humor:'Dry.',rule:'Tell the truth.',line:'Never hurt my people.'};
const cells=nfCompose(id=>A[id]||''); const inv=pkhpInvert(cells);
Object.keys(A).forEach(k=>ok(inv.a[k]===A[k],'round trip '+k+': '+JSON.stringify(inv.a[k])));
['CONTEXT','DO','DONT','GATES','VOICE'].forEach(c=>ok(inv.ok[c]===true,'ok flag '+c));
const back=pkhpWriteBack(cells,inv.a,inv.ok); ['CONTEXT','DO','DONT','GATES','VOICE'].forEach(c=>ok(back[c]===cells[c],'write back unchanged '+c));
// a cell with the owner's own prose: not explained, prefilled only from the prefixed line, kept on write back with the answers under it
const own={CONTEXT:'# core / CONTEXT\n\nI bake at dawn.\n\nI spend my days: at the oven\n\nI hate mornings.',DO:'',DONT:'',GATES:'',VOICE:'(add your own here)'};
const inv2=pkhpInvert(own); ok(inv2.ok.CONTEXT===false,'own prose is not explained'); ok(inv2.a.who===undefined,'who left blank'); ok(inv2.a.days==='at the oven','prefixed line prefilled'); ok(inv2.ok.VOICE===true,'placeholder counts as empty');
const back2=pkhpWriteBack(own,Object.assign({},inv2.a,{who:'A baker.',days:'at the oven, early'}),inv2.ok);
ok(back2.CONTEXT==='# core / CONTEXT\n\nI bake at dawn.\n\nI hate mornings.\n\nA baker.\n\nI spend my days: at the oven, early','prose kept, prefixed line replaced, answers under: '+JSON.stringify(back2.CONTEXT));
ok(back2.DO.startsWith('# core / DO')&&back2.DO.includes('(add your own here)'),'empty cell rebuilt as placeholder');
const back3=pkhpWriteBack(own,inv2.a,inv2.ok); ok(back3.CONTEXT==='# core / CONTEXT\n\nI bake at dawn.\n\nI hate mornings.\n\nI spend my days: at the oven','no new answer: prefixed line re-emitted once, nothing duplicated: '+JSON.stringify(back3.CONTEXT));
// the depth (leg 3): an answer lands under the header, replaces the placeholder, and never touches the owner's prose
ok(pkhpAppend('# vibe / DO\n\n(add your own here)','I want one question at a time.')==='# vibe / DO\n\nI want one question at a time.','placeholder replaced under the header');
ok(pkhpAppend('# vibe / DO\n\nI ramble.\n','I want one question at a time.')==='# vibe / DO\n\nI ramble.\n\nI want one question at a time.','prose kept, sentence under it');
ok(pkhpAppend('','I ramble.')==='I ramble.','empty cell takes the sentence alone');
// hats (v17): a hat name is a slug, unique among the facets, never core; its cells take the hat's own header and an empty cell keeps the placeholder
ok(pkHatName('My Coach Hat',[]).name==='my-coach-hat','slug from owner text'); ok(!!pkHatName('',[]).error,'empty name refused'); ok(!!pkHatName('core',[]).error,'core refused'); ok(!!pkHatName('Coach',[{name:'coach'}]).error,'duplicate refused case-insensitively'); ok(!!pkHatName('12 3',[]).error,'no letters refused');
const hc=pkHatCells({DO:'# core / DO\n\nAsk sharp questions.',DONT:'# manager / DONT\n\nNever rescue.'},'coach');
ok(hc.DO==='# coach / DO\n\nAsk sharp questions.','core header renamed: '+JSON.stringify(hc.DO)); ok(hc.DONT==='# coach / DONT\n\nNever rescue.','blank guidance header renamed'); ok(hc.VOICE==='# coach / VOICE\n\n(add your own here)','empty cell gets the placeholder');
ok(pkhpAppend(hc.VOICE,'Warm.')==='# coach / VOICE\n\nWarm.','a hat cell appends like any other');
// the paste mapper (v18): bank ids parse on the lenient path, an unknown id is ignored, a choice outside its options is dropped and counted, case folds to the option, 600 characters an answer
const QS=[{id:'core.DO.01',cell:'DO',type:'text',q:'How do I like help?'},{id:'core.VOICE.02',cell:'VOICE',type:'choice',q:'How formal?',opts:['Casual','Formal']},{id:'hat.DONT.03',cell:'DONT',type:'text',q:'Never?'}];
const known=new Set(QS.map(q=>q.id));
const p1=pkagParse('Sure! Here it is:\n{\u201Ccore.DO.01\u201D: \u201CBottom line first.\u201D, "core.VOICE.02": "casual"}\nHope that helps.',known);
ok(p1['core.DO.01']==='Bottom line first.'&&p1['core.VOICE.02']==='casual','curly quotes straightened, prose around the block ignored: '+JSON.stringify(p1));
const p2=pkagParse('{"core.DO.01": "I say "no" a lot.", "core.VOICE.02": "Formal", "hat.DONT.03": "Never flatter."}',known);
ok(p2['core.DO.01']==='I say "no" a lot.'&&p2['hat.DONT.03']==='Never flatter.','unescaped quotes inside an answer survive the key by key read on dotted ids: '+JSON.stringify(p2));
let threw=false; try{ pkagParse('no braces here',known); }catch(e){ threw=true; } ok(threw,'no block throws');
const m1=pkagMap({'core.DO.01':'Bottom line first.','core.VOICE.02':'casual','hat.DONT.03':'','other.DO.01':'stray','core.CONTEXT.09':'x'},QS);
ok(m1.got.length===2&&m1.got[0].id==='core.DO.01'&&m1.got[0].cell==='DO','only known ids land: '+JSON.stringify(m1.got.map(a=>a.id)));
ok(m1.got[1].v==='Casual','a choice folds to its option: '+JSON.stringify(m1.got[1]));
ok(m1.ignored===2,'two unknown ids ignored, not created: '+m1.ignored); ok(m1.dropped===0,'an empty answer is neither landed nor counted');
const m2=pkagMap({'core.VOICE.02':'Blunt','core.DO.01':'x'.repeat(700)},QS);
ok(m2.dropped===1&&m2.got.length===1,'a choice outside its options is dropped and counted: '+JSON.stringify([m2.dropped,m2.got.length]));
ok(m2.got[0].v.length===600,'600 characters an answer');
ok(pkagQLine(QS[1])==='- "core.VOICE.02": How formal? Choose exactly one of: Casual, Formal.','a choice line names its options');
ok(pkagQLine(QS[0])==='- "core.DO.01": How do I like help?','a text line carries no options');
// The terms gate (2026-09-12). Lifted with a stubbed document, because the bug was a disagreement
// between what the card SHOWS and what the guard REQUIRES, and only the rendered row can settle it.
{
  const tsrc=cut("function termsAgreed()","catch(_){} return true; }");
  const mk=(rowHidden,checked)=>{ const el={pkauthterms:{hidden:rowHidden},termsok:{checked:checked,focused:false,focus(){ this.focused=true; }},autherr:{textContent:''}};
    const doc={getElementById:(id)=>el[id]||null};
    const ls={store:{},setItem(k,v){ this.store[k]=v; },getItem(k){ return this.store[k]||null; }};
    const fn=new Function('document','localStorage','TERMS_VERSION', tsrc+'\nreturn termsAgreed;')(doc,ls,'2026-09-07');
    return {el,ls,run:fn}; };

  // the live bug: sign in on a browser that already agreed. The row is hidden, the box under it is
  // unchecked, and Continue with Google called this first. It must pass, not error at an invisible box.
  const a=mk(true,false);
  ok(a.run()===true,'hidden terms row means already agreed, not blocked');
  ok(a.el.autherr.textContent==='','no error is shown for a row that is not on screen');
  ok(a.el.termsok.focused===false,'nothing is focused into a hidden input');

  // the row IS on screen and unticked: still refused, still the same message
  const b=mk(false,false);
  ok(b.run()===false,'a visible unticked box still blocks');
  ok(/tick the box/.test(b.el.autherr.textContent),'and says so: '+JSON.stringify(b.el.autherr.textContent));
  ok(b.el.termsok.focused===true,'and focuses the box the message names');

  // the row is on screen and ticked: passes and records the agreement for this browser
  const c=mk(false,true);
  ok(c.run()===true,'a visible ticked box passes');
  ok(c.ls.store.pk_terms_ok==='2026-09-07','and stamps the terms version');
  ok(c.el.autherr.textContent==='','with no error');
}

// Route exemption guard (2026-09-12). The Room shipped as #49 and broke production within a minute: route()
// sent ?room= to the room, then Supabase fired INITIAL_SESSION, the auth callback was not told the room
// routes itself, and refreshAuth() re-routed the page to the landing (signed out) or Home (signed in).
// Reverted as #50. The exemption list is prose a new route has to remember, so this makes it mechanical:
// every on*Route() that route() dispatches must also appear in the onAuthStateChange callback.
{
  const rS=h.indexOf('function route(){'), rE=h.indexOf("document.body.className='marketing route-landing'; refreshAuth(); }", rS);
  const aS=h.indexOf('SB.auth.onAuthStateChange('), aE=h.indexOf('\n', h.indexOf('refreshAuth();', aS));
  ok(rS>0&&rE>rS,'route() found'); ok(aS>0&&aE>aS,'the auth callback found');
  const names=b=>new Set((b.match(/on[A-Z][A-Za-z]*Route\(\)/g)||[]).map(x=>x.slice(0,-2)));
  const inRoute=names(h.slice(rS,rE)), inAuth=names(h.slice(aS,aE));
  ok(inRoute.size>=5,'route() dispatches its pages ('+inRoute.size+' found)');
  for(const n of inRoute) ok(inAuth.has(n),n+' routes itself but is not exempted in onAuthStateChange, so INITIAL_SESSION will re-route it to the landing or Home');
  // 2026-09-14: ?account shipped in #76 as an inline URLSearchParams test inside route(), which this name check cannot see,
  // and went live rendering Home for every member with no handle. A route is a named on*Route() or it is not a route.
  ok(!/URLSearchParams\(location\.search\)/.test(h.slice(rS,rE)),'route() reads the query only through named on*Route() functions, never inline, so the exemption check can see every route');
}

// Room hero eager-load (2026-09-13). avatarInto lazy-loads every avatar, which is right for a card in a list and
// wrong for the one image the room exists to show: the first frame of a portrait room read as an empty box. The
// room asks for the eager path with high fetch priority; every other caller keeps lazy, and a foreign URL still
// falls back to the initial. Lifted with a stub document, then the room's call is read from the source.
{
  const src=cut("const MEDIA_BASE='","else { el.textContent=initial; } }");
  const doc={createElement:t=>({tag:t,className:'',alt:'',decoding:'',loading:'',src:'',fetchPriority:''})};
  const {avatarInto,MEDIA_BASE}=new Function('document',src+'\nreturn {avatarInto,MEDIA_BASE};')(doc);
  const mkEl=()=>({textContent:'',kids:[],appendChild(n){ this.kids.push(n); }});
  const a=mkEl(); avatarInto(a,MEDIA_BASE+'x.webp','P',true);
  ok(a.kids.length===1&&a.kids[0].loading==='eager','the room hero loads eagerly: '+JSON.stringify(a.kids[0]&&a.kids[0].loading));
  ok(a.kids.length===1&&a.kids[0].fetchPriority==='high','and at high fetch priority');
  const b=mkEl(); avatarInto(b,MEDIA_BASE+'x.webp','P');
  ok(b.kids.length===1&&b.kids[0].loading==='lazy','a card avatar still lazy-loads');
  const c=mkEl(); avatarInto(c,'https://elsewhere.example/x.webp','P',true);
  ok(c.kids.length===0&&c.textContent==='P','a foreign URL still falls back to the initial, eager or not');
  const rS=h.indexOf('async function renderRoom('), rE=h.indexOf('\nfunction route(){',rS);
  ok(rS>0&&rE>rS,'renderRoom found');
  ok(/avatarInto\(face,r\.image_url,initial,true\)/.test(h.slice(rS,rE)),'renderRoom asks for the eager hero');
}

// The room's owner controls (2026-09-13, Dylan's rulings 1 and 2): the mouth is placed by one click on the portrait, read as
// fractions of the face box and clamped to it; the character standing in the room is the owner's pick when it can be honoured,
// else portrait, then doll, then a plate. Both writes go through one data-only save. Helpers lifted, then the room's source read.
{
  const s=h.indexOf('const PK_FACE_DEFAULT='), e=h.indexOf('async function renderRoom(',s);
  ok(s>0&&e>s,'the face helpers found');
  const NL=String.fromCharCode(10);
  const L=new Function(h.slice(s,e)+NL+'return {pkFaceOf:pkFaceOf, fromClick:(typeof pkFaceFromClick==="function")?pkFaceFromClick:null, hero:(typeof pkRoomHero==="function")?pkRoomHero:null};')();
  ok(!!L.fromClick,'pkFaceFromClick exists'); ok(!!L.hero,'pkRoomHero exists');
  if(L.fromClick){
    const fb={left:100,top:200,width:400,height:400};
    const a=L.fromClick(fb,300,320,0.2); ok(!!a&&a.x===0.5&&Math.abs(a.y-0.3)<1e-9&&a.w===0.2,'a click lands as fractions of the face box: '+JSON.stringify(a));
    const b=L.fromClick(fb,20,900,0.2); ok(!!b&&b.x===0&&b.y===1,'a click outside the box clamps to its edge: '+JSON.stringify(b));
    const c=L.fromClick(fb,300,300,NaN); ok(!!c&&c.w===0.2,'a bad width falls back to the default');
    ok(L.fromClick({left:0,top:0,width:0,height:0},1,1,0.2)===null,'a zero box places nothing');
    const f=L.pkFaceOf({face:a}); ok(f.x===0.5&&Math.abs(f.y-0.3)<1e-9,'and the room reads it back through pkFaceOf');
    ok(L.pkFaceOf({face:{x:2,y:-1,w:'a'}}).y===0.63,'an out-of-range face falls back to the default on read');
  }
  if(L.hero){
    ok(L.hero({image_url:'u'},{avatar:{}})==='portrait','portrait first when no pick is saved');
    ok(L.hero({image_url:'u'},{avatar:{},hero:'look'})==='look','the Look when the owner picked it');
    ok(L.hero({image_url:'u'},{hero:'look'})==='portrait','a pick with nothing behind it is not honoured');
    ok(L.hero({image_url:null},{avatar:{},hero:'portrait'})==='look','no portrait: the doll stands');
    ok(L.hero({},{})==='plate','nothing: the plate');
  }
  const rS=h.indexOf('async function renderRoom('), rE=h.indexOf(NL+'function route(){',rS); const room=h.slice(rS,rE);
  ok(room.indexOf('pkRoomHero(')>=0,'the room stands the picked character');
  ok(room.indexOf('pkFaceFromClick(')>=0,'the room places the mouth from a click');
  ok(room.indexOf('pkRoomSave(')>=0,'both go through the one data-only save');
}

// Visitor surfaces are a product, not a console (2026-09-13, Dylan: "a website that is actually usable"). The chat's
// "system prompt = current composition" line is an editor readout and never shows in the Room or on a persona page, and
// Explore carries no hosted-capacity readout at all. Read from the source, because both are strings a visitor would see.
{
  const rc=h.indexOf('function renderChat(){'), rcE=h.indexOf('b.scrollTop=b.scrollHeight;}',rc); const body=h.slice(rc,rcE);
  ok(rc>0&&rcE>rc,'renderChat found');
  ok(body.indexOf('system prompt = current composition')>=0,'the editor readout still exists for the workbench');
  ok(body.indexOf('route-(room|profile)')>=0,'and it is guarded off the Room and the persona page');
  ok(h.indexOf('Hosted capacity this month')<0,'Explore carries no capacity readout');
  ok(h.indexOf('twingrid_capacity_public')<0,'and no longer calls the capacity RPC from the page');
}

// The showpiece (2026-09-13, Dylan: "an actual cool looking website"). The landing's hero card becomes a wall of
// faces from the public view once three or more public personas carry a portrait, every face a link into its room, and
// the persona page leads with the portrait at real size plus a Talk to it button into the room. Read from the source.
{
  const fw=h.indexOf('async function pkFacesWall(');
  ok(fw>0,'pkFacesWall exists');
  const body=fw>0?h.slice(fw,h.indexOf(String.fromCharCode(10)+'async function',fw+10)):'';
  ok(body.indexOf("twingrid_grids_public")>=0,'the wall reads the public view, never the base table');
  ok(body.indexOf('avatarInto(')>=0,'faces go through avatarInto (bucket only)');
  ok(body.indexOf('rows.length<3')>=0,'fewer than three faces keeps the static card');
  ok(body.indexOf("'?room='")>=0,'every face links into its room');
  const rS=h.indexOf('function route(){'), rE=h.indexOf("refreshAuth(); }", rS);
  ok(h.slice(rS,rE+16).indexOf('pkFacesWall()')>=0,'the landing branch of route() renders the wall');
  ok(h.indexOf('id="ptalk"')>=0,'the persona page hero carries a Talk to it button');
  const pS=h.indexOf('async function renderProfile('), pE=h.indexOf(String.fromCharCode(10)+'async function',pS+10);
  ok(h.slice(pS,pE).indexOf("getElementById('ptalk').href='?room='")>=0,'and renderProfile points it at the room');
  ok(h.indexOf('#profile .pavatar:has(img)')>=0,'the portrait gets real size when there is one');
}

// The persona page as the profile (v21, 2026-09-13). The rating line is a pure function of the SQL aggregate's rows, lifted and fed
// every shape it can meet; the section order and the hero's two controls are read from the markup, because the whole point of the
// round is where things sit, and a renderer that works in the wrong place is the bug being fixed.
{
  let rsrc=null; try{ rsrc=cut('function pkRatingText(score)',"none:false}; }"); }catch(_){}
  ok(!!rsrc,'pkRatingText exists');
  if(rsrc){
    const {pkRatingText}=new Function(rsrc+'\nreturn {pkRatingText};')();
    const none=pkRatingText([]); ok(none.none===true&&none.main==='No sparks yet','no rows reads No sparks yet');
    const hu=pkRatingText([{lane:'human',avg_rating:4.6,n:12}]); ok(hu.main==='4.6 of 5 · 12 sparks'&&hu.sub===''&&!hu.none,'humans lead: '+hu.main);
    const both=pkRatingText([{lane:'persona',avg_rating:4,n:3},{lane:'human',avg_rating:'4.5',n:1}]); ok(both.main==='4.5 of 5 · 1 spark','one spark, one decimal, a string survives: '+both.main); ok(both.sub==='personas say 4.0 of 5 (3)','personas follow: '+both.sub);
    const p=pkRatingText([{lane:'persona',avg_rating:3.2,n:2}]); ok(p.main==='Personas say 3.2 of 5 (2)'&&!p.none,'personas alone lead, capitalised: '+p.main);
    ok(pkRatingText(null).none===true&&pkRatingText([{lane:'human'}]).main==='0.0 of 5 · 0 sparks','a bad shape never throws');
  }
  const at=s=>{ const i=h.indexOf(s); ok(i>0,'markup has '+s); return i; };
  const hero=h.indexOf('<div class="phero">'), body=h.indexOf('<div class="wrap pkcol">');
  ok(hero>0&&body>hero,'the hero precedes the column');
  const rating=at('id="pkrating"'), kinbtn=at('id="pkkinbtn"'), talk=at('id="ptalk"'), cover=at('id="pkcover"');
  ok(rating>hero&&rating<body&&kinbtn>hero&&kinbtn<body&&talk>hero&&talk<body&&cover>hero&&cover<body,'the cover, the rating and both buttons sit in the hero');
  const order=['id="phouse"','id="psparks"','id="pkkindred"','id="plately"','id="pkhandbookh"','id="pfacets"'].map(at);
  ok(order.every((v,i)=>i===0||v>order[i-1]),'Home, Guestbook, Kindred, Lately, the handbook, the cards: in that order');
  ok(/<h2 id="psparksh">Guestbook<\/h2>/.test(h),'the Sparks section is the Guestbook');
  const sp=h.indexOf('async function pkRenderSparks('), spE=sp>0?h.indexOf('\n',h.indexOf('sec.hidden=false; }',sp)):-1;
  ok(sp>0&&spE>sp&&/sec\.insertBefore\(box,list\)/.test(h.slice(sp,spE)),'the Spark box is inserted before the list, never after it');
  ok(/#profile \.pkcol\{/.test(h)&&/#profile \.pkcover\{/.test(h),'the column and the cover are styled inside #profile only');
}

// Reviews in the open (v21, 2026-09-13). Three surfaces read one aggregate: the hero (twingrid_spark_score), Explore's cards and the
// Room's bar (twingrid_spark_scores, the same rows keyed by persona). The Spark box opens from the Room through the one box the
// Guestbook uses, with a callback in place of the Guestbook's own refresh. Read from the source, because what is being fixed is
// which surfaces carry the number at all.
{
  const sb=h.indexOf('function pkSparkBox(gridId,onDone)'); ok(sb>0,'pkSparkBox takes a done callback');
  if(sb>0){ const sbE=h.indexOf('\nlet PK_SPARK_OWNER=null;',sb); const body=h.slice(sb,sbE);
    ok(!/pkRenderSparks\(gridId\)/.test(body),'the box never refreshes the Guestbook directly; every path goes through done()');
    ok((body.match(/done\(\)/g)||[]).length>=3,'rating, reaction and note all call done()'); }
  const ex=h.indexOf('async function renderExplore('), exE=h.indexOf('\nconst CELL_LABEL=',ex);
  ok(ex>0&&exE>ex&&/twingrid_spark_scores/.test(h.slice(ex,exE)),'Explore reads twingrid_spark_scores in bulk');
  ok(/class="exrate"/.test(h.slice(ex,exE))||/className='exrate'/.test(h.slice(ex,exE)),'every card gets a rating line');
  const rm=h.indexOf('async function renderRoom('), rmE=h.indexOf('\nfunction route(){',rm);
  ok(rm>0&&rmE>rm&&/pkRoomRate\(id\)/.test(h.slice(rm,rmE)),'the Room reads its rating');
  ok(/pkSparkBox\(id,\(\)=>pkRoomRate\(id\)\)/.test(h.slice(rm,rmE)),'the Room opens the same box and refreshes its own bar');
  ok(/rb\.hidden=!!mine/.test(h.slice(rm,rmE)),'the owner never sees Rate this persona in the room');
  const rr=h.indexOf('async function pkRoomRate('); ok(rr>0&&/twingrid_spark_scores/.test(h.slice(rr,rr+700)),'the Room bar reads the same view as Explore');
  const top=h.indexOf('<div id="pkroom" hidden>'), wrap=h.indexOf('<div class="pkrmwrap">',top);
  ['id="pkrmrate"','id="pkrmratebtn"','id="pkrmratebox"'].forEach(s=>{ const i=h.indexOf(s,top); ok(i>top&&i<wrap,s+' sits above the stage, never over the character'); });
  ok(/#pkroom \.pkrmratebox \.phrbtn\{/.test(h),'the box is styled inside the room');
}

// The Room on a painted stage (v21, 2026-09-13). The backdrop is chosen by the persona's house room KEY through the manifest and
// never by a path from data: the chooser is lifted and fed hostile keys, then the Room and the cover are read from the source.
{
  let ssrc=null; try{ ssrc=cut('const PK_STAGE_RE=',"||null; }"); }catch(_){}
  ok(!!ssrc,'pkStageFor exists');
  if(ssrc){
    const {pkStageFor}=new Function(ssrc+'\nreturn {pkStageFor};')();
    const rooms=[{key:'studio',stage:'/catalog/rooms/stage/studio.jpg'},{key:'library',stage:'/catalog/rooms/stage/library.jpg'},{key:'porch'}];
    ok(pkStageFor(rooms,'library')==='/catalog/rooms/stage/library.jpg','a known room gives its own stage');
    ok(pkStageFor(rooms,'porch')==='/catalog/rooms/stage/studio.jpg','a room with no painting falls to the studio');
    ['../../x','https://evil.example/a.jpg','studio.jpg','',null,undefined,42,{key:'library'}].forEach(k=>ok(pkStageFor(rooms,k)==='/catalog/rooms/stage/studio.jpg','a hostile or missing key falls to the studio: '+JSON.stringify(k)));
    ok(pkStageFor([{key:'studio',stage:'https://evil.example/x.jpg'}],'studio')===null,'a manifest path off the stage prefix is refused, not used');
    ok(pkStageFor(null,'studio')===null&&pkStageFor([],'studio')===null,'no manifest, no stage, no throw');
  }
  const rm=h.indexOf('async function renderRoom('), rmE=h.indexOf('\nfunction route(){',rm);
  ok(rm>0&&/pkStageOf\(d\)/.test(h.slice(rm,rmE)),'the Room picks its stage from the manifest by the house room key');
  ok(/--pkstage/.test(h.slice(rm,rmE))&&/#pkroom \.pkrmstage\{[^}]*var\(--pkstage/.test(h),'the stage paints through one CSS variable on the stage element');
  const cv=h.indexOf('async function pkRenderCover('); ok(cv>0&&/pkStageOf\(g\)/.test(h.slice(cv,cv+900)),'the profile cover takes the same painting when the persona has a house room');
  ok(/pkRenderCover\(data\.image_url,g\)/.test(h),'renderProfile hands the cover the persona data');
}

// Explore as the neighbourhood (v21, 2026-09-13). A card is a face, a name, its rating, its mood and one sentence; the internal
// count, the edit date and the repeated publisher line are gone. Read from the source and the markup: the sweep is about what a
// stranger is shown, and a renderer that still emits the old strings is the defect.
{
  const ex=h.indexOf('async function renderExplore('), exE=h.indexOf('\nconst CELL_LABEL=',ex); const body=h.slice(ex,exE);
  ok(ex>0&&exE>ex,'renderExplore found');
  ok(!/short cells to read/.test(body),'no cell count on a card');
  ok(!/edited '\+new Date/.test(body)&&!/toLocaleDateString\(\)/.test(body),'no edit date on a card');
  ok(!/Published by @/.test(body),'no repeated publisher line');
  ok(/profileSummary\(g,true\)/.test(body),'one sentence per card, the same sentence the persona page leads with');
  ok(/className='exrate'/.test(body)&&/className='exmood'/.test(body),'the rating and the mood line stay');
  ok(/#explore \.exav\{width:72px;height:72px/.test(h),'the face is 72 px');
  const m=h.indexOf('<div id="explore">'), mE=h.indexOf('<button id="helpbtn"',m); const mk=h.slice(m,mE);
  ok(!/grid of plain cells/.test(mk),'the lede no longer says grid of plain cells');
  ok(/Hide the example personas/.test(mk),'the filter is in a stranger\'s words');
}

// The landing (v21, 2026-09-13). Below the fold the product is shown, never mocked: two real screens shipped as files, the hero
// paragraph two sentences, the stale sign-in note gone. The hero's own card keeps its static cells only as the fallback the wall
// of faces replaces once three portraits exist. Read from the markup and the disk.
{
  const l=h.indexOf('<div id="landing">'), lE=h.indexOf('<div id="auth"',l); const mk=h.slice(l,lE);
  ok(l>0&&lE>l,'the landing found');
  ok((mk.match(/class="pk-cells"/g)||[]).length===1,'one mock card left, the hero fallback, none below the fold');
  const shots=[...mk.matchAll(/<img src="\/img\/([a-z0-9-]+\.jpg)"/g)].map(m=>m[1]);
  ok(shots.length===2,'two product frames on the page: '+JSON.stringify(shots));
  shots.forEach(f=>ok(fs.existsSync(new URL('../docs/img/'+f,import.meta.url)),'frame on disk: '+f));
  const sub=(mk.match(/<p class="pk-sub">([\s\S]*?)<\/p>/)||['',''])[1];
  ok((sub.match(/[.!?](\s|$)/g)||[]).length<=2,'the hero paragraph is two sentences at most: '+sub.slice(0,80));
  ok(!/email link/.test(mk),'no stale email-link note');
  ok(/class="pk-shot"/.test(mk)&&/\.pk-shot img\{/.test(h),'the frames are styled as figures');
}

// The 390 pass (v21, 2026-09-13). Every surface was measured at 390 in the round it shipped; the one visitor string still in
// jargon was the chat's placeholder, read by every stranger who opens a Room.
{
  const m=h.match(/<textarea id="chatinput" placeholder="([^"]*)"/); ok(!!m,'the chat input found');
  ok(!!m&&!/composed/i.test(m[1]),'the chat placeholder is in plain words: '+JSON.stringify(m&&m[1]));
}

// The adversarial review's fifteen (v21, 2026-09-13): every one a visitor string, a stale frame or a control shown to the wrong
// viewer. Each is asserted from the source so the checker, not the reviewer, holds the line from here on.
{
  const meta=(h.match(/<meta name="description" content="([^"]*)"/)||['',''])[1];
  ok(!!meta&&!/grid|cells/i.test(meta),'the page description is in the landing’s words: '+meta.slice(0,60));
  ok(!/grid of small, readable cells/.test(h),'no social description says grid of cells');
  const a=h.indexOf('<div id="auth"'), aE=h.indexOf('</div>\n</div>',a); const auth=h.slice(a,aE);
  ok(!/grids|row-level/i.test(auth),'the sign-in card says personas, not grids and row-level security');
  const faq=(h.match(/\{q:'How do I make one\?', a:'([^']*)'/)||['',''])[1];
  ok(!!faq&&!/email link/.test(faq),'the help answer matches the sign-in card');
  const ex=h.indexOf('async function renderExplore('), exE=h.indexOf('\nconst CELL_LABEL=',ex); const exb=h.slice(ex,exE);
  ok(!/starter filter/.test(exb),'the filtered-out empty state names the example personas');
  ok(/profileSummary\(g,true\)/.test(exb),'the card takes the one-sentence form of the summary');
  ok(/function profileSummary\(g,short\)/.test(h)&&/short\?'Its owner has not written the description yet\.'/.test(h),'profileSummary has a short form with no below');
  ok(/It shows on its page with your @handle\./.test(h)&&!/It shows on this page with your @handle\./.test(h),'the note placeholder does not name the page it is on');
  ok(/function pkRenderRating\(score,owner\)/.test(h)&&/if\(t\.none&&!owner\)/.test(h),'the owner gets no Be the first link');
  ok(/pkRenderRating\(sc,uid&&PK_SPARK_OWNER&&uid===PK_SPARK_OWNER\)/.test(h),'pkRenderSparks passes the owner state');
  ok(/async function pkRenderAvatar\(g,portrait\)/.test(h)&&/pkRenderAvatar\(g,!!data\.image_url\)/.test(h),'the doll never stands beside a portrait in the hero');
  const kin=h.indexOf('async function pkRenderKin('), kinE=h.indexOf('\n// the first accepted pair',kin);
  ok(kin>0&&/pkkinbtn.*hidden=isOwner\|\|!!kinPair/.test(h.slice(kin,kinE).replace(/\n/g,' ')),'Request Kindred is hidden for the owner and for a viewer already Kindred');
  ok(/s\.querySelector\('#pkin select'\)/.test(h)&&!/'#pkin select,#pkin button'/.test(h),'the hero button never focuses the paid Have them talk control');
  ok(/pkkindred'\)\.hidden=true/.test(h)&&/pkhandbook'\)\.hidden=true/.test(h),'a not-found persona hides the Kindred and handbook sections');
  // First-run routing (v22.1): the hero primary button takes a new person straight into the
  // questionnaire, not to a signed-in dead end. Both "Build your persona free" CTAs carry data-path.
  const bpf=(h.match(/<button[^>]*>Build your persona free<\/button>/g)||[]);
  ok(bpf.length===2,'two Build your persona free CTAs found ('+bpf.length+')');
  ok(bpf.every(b=>/data-path="questions"/.test(b)),'the hero CTA routes into the questionnaire, not a dead end');
  ok(bpf.every(b=>!/data-auth/.test(b)),'the hero CTA is not a bare auth control');
}

// Explore rating as sparks (v22.4): five glyphs filled to the average, "Be the first" at zero, never a flat dead label.
{
  const src=cut('function exSparkRow(el,score)','  el.appendChild(lab);')+'}';
  const doc={createElement:()=>({className:'',textContent:''})};
  const {exSparkRow}=new Function('document',src+' return {exSparkRow};')(doc);
  const mkEl=()=>{ const o={kids:[],cls:new Set()}; o.appendChild=n=>o.kids.push(n); o.classList={add:c=>o.cls.add(c)}; return o; };
  const z=mkEl(); exSparkRow(z,[]);
  ok(z.kids.length===6,'zero rating renders five sparks and a label ('+z.kids.length+')');
  ok(z.kids.slice(0,5).every(g=>g.className.includes('off')),'all five sparks dim at zero');
  ok(z.kids[5].textContent==='Be the first','zero rating invites, not a flat dead label: '+JSON.stringify(z.kids[5].textContent));
  ok(z.cls.has('exnone'),'zero rating marks the row exnone');
  const r=mkEl(); exSparkRow(r,[{lane:'human',avg_rating:4.2,n:3}]);
  ok(r.kids.slice(0,4).every(g=>!g.className.includes('off'))&&r.kids[4].className.includes('off'),'4.2 fills four sparks and dims one');
  ok(r.kids[5].textContent==='4.2 · 3 sparks','the label carries the average and count: '+JSON.stringify(r.kids[5].textContent));
  ok(!r.cls.has('exnone'),'a rated row is not exnone');
}

// The empty room chat is an invitation, not a void (v22.3): renderChat shows the persona face and name.
ok(/pkrmchatempty/.test(h) && h.includes("chatPeerName?('Say hi to '") && /route-room/.test(h.slice(h.indexOf('function renderChat('),h.indexOf('function renderChat(')+900)),'the empty room chat shows the persona face and name, not a blank void');

// ============================================================
// The review's eighteen (2026-09-13 page-sweep). Every visitor-facing string in plain words, every
// link resolving, the Room's two broken controls working, the page cheaper and more accessible.
// Each fix is asserted here so the checker, not the reviewer, holds the line from here on.
// ============================================================
const aboutHtml=fs.readFileSync(new URL('../docs/about.html',import.meta.url),'utf8');
const pricingHtml=fs.readFileSync(new URL('../docs/pricing.html',import.meta.url),'utf8');
const supportHtml=fs.readFileSync(new URL('../docs/support.html',import.meta.url),'utf8');
const changelogHtml=fs.readFileSync(new URL('../docs/changelog.html',import.meta.url),'utf8');
const headersTxt=fs.readFileSync(new URL('../docs/_headers',import.meta.url),'utf8');

// (a) every href='?<key>=' literal in the module uses a key route() actually dispatches. The known-key
// set is read from the on*Route() predicates themselves, never hardcoded, so a new route stays covered.
{
  const keys=new Set(); const reFn=/function on[A-Za-z]*Route\(\)\{[^\n]*/g; let m;
  while((m=reFn.exec(h))){ const reKey=/\.(?:has|get)\('([a-zA-Z]+)'\)/g; let km; while((km=reKey.exec(m[0]))) keys.add(km[1]); }
  ok(keys.size>=5,'on*Route() keys collected ('+keys.size+'): '+[...keys].join(','));
  const hrefs=[...h.matchAll(/href='\?([a-zA-Z]+)='/g)].map(mm=>mm[1]);
  ok(hrefs.length>0,'href=\'?key=\' literals found in the module ('+hrefs.length+')');
  hrefs.forEach(k=>ok(keys.has(k),"href='?"+k+"=' is not a route() key ("+[...keys].join(',')+')'));
}

// (b) the Room only auto-enables speech for the free browser voice; a paid Gemini voice never switches on for a visitor without the gesture.
{
  const rm=h.indexOf('async function renderRoom('), rmE=h.indexOf('\nfunction route(){',rm);
  ok(rm>0&&rmE>rm,'renderRoom found');
  ok(/if\(!speakOn\s*&&\s*chatVoice===['"]browser['"]\)\{\s*const b=document\.getElementById\('chatspk'\)/.test(h.slice(rm,rmE)),'auto-speak only fires for the free browser voice');
}

// (c) leaving a conversation as a Spark is offered from the Room too, not only the persona page and account view.
ok(/const onPage=onProfileRoute\(\)\|\|onRoomRoute\(\)\|\|\(onAccountRoute\(\)&&accountPersonaParam\(\)\)/.test(h),'pkChatSparkSync includes the Room');

// (d) the three drawer close buttons are real buttons a screen reader can name, and the CSS selector that hides the Room's own close button matches something.
ok(/<button class="x" id="dx" type="button" aria-label="Close">/.test(h),'dx: type=button + aria-label');
ok(/<button class="x" id="chatx" data-roomhide type="button" aria-label="Close">/.test(h),'chatx: data-roomhide + type=button + aria-label');
ok(/<button class="x" id="setx" type="button" aria-label="Close">/.test(h),'setx: type=button + aria-label');

// (e) every .x close button meets the 24px minimum target.
ok(/\.x\{font-size:20px;cursor:pointer;background:none;border:0;color:var\(--muted\);min-width:24px;min-height:24px;display:inline-grid;place-items:center\}/.test(h),'.x carries a 24px minimum target');

// (f) no relative terms.html link is left.
ok(!/href="terms\.html"/.test(h),'no href="terms.html" remains');

// (g) support.html describes the real sign-in flow, not a dead magic link.
ok(!/sign-in link/i.test(supportHtml),'support.html: no stale "sign-in link" wording');
ok(/forgot your password/i.test(supportHtml)&&/google/i.test(supportHtml),'support.html: names Forgot your password and Continue with Google');

// (h) the changelog names the week's shipped work, newest first, in plain words.
ok(/2026-09-13/.test(changelogHtml),'changelog.html: has a 2026-09-13 entry');
['Room','Kindred','Spark','Home','Guestbook','Explore'].forEach(w=>ok(new RegExp(w).test(changelogHtml),'changelog.html: names '+w));

// (i) about.html and pricing.html describe the product in the shipped vocabulary, never grid/cells/facet.
{
  const visible=s=>s.replace(/<!--[\s\S]*?-->/g,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<script[\s\S]*?<\/script>/gi,'');
  ok(!/\b(grid|grids|cells?|facets?)\b/i.test(visible(aboutHtml)),'about.html: no grid/cells/facet in visible text');
  ok(!/\b(grid|grids|cells?|facets?)\b/i.test(visible(pricingHtml)),'pricing.html: no grid/cells/facet in visible text');
}

// (j) a no-script visitor still gets the brand, one sentence, and the way to the static pages.
{
  const ns=(h.match(/<noscript>([\s\S]*?)<\/noscript>/)||['',''])[1];
  ok(!!ns,'a <noscript> block exists');
  ok(/\/about/.test(ns),'the noscript block names /about');
}

// (k) the chat log announces new messages to assistive tech.
ok(/<div class="dbody" id="chatbody" role="log" aria-live="polite" aria-relevant="additions" tabindex="0">/.test(h),'chatbody carries the log/live-region attributes');

// (l) Explore's public query is bounded.
{
  const ex=h.indexOf('async function renderExplore('), exE=h.indexOf('\nconst CELL_LABEL=',ex);
  const flat=(ex>0&&exE>ex)?h.slice(ex,exE).replace(/\s+/g,''):'';
  ok(/\.select\('id,name,data,owner,updated_at,image_url'\)\.eq\('is_public',true\)\.order\('updated_at',\{ascending:false\}\)\.limit\(48\)/.test(flat),"renderExplore's public query carries .limit(48)");
}

// (m) the Room's stage image is asked for eagerly and at its real size, so it never lays out from zero.
{
  const cv=h.indexOf('async function pkRenderCover('), cvE=h.indexOf('\n// the hero',cv);
  const body=(cv>0&&cvE>cv)?h.slice(cv,cvE):'';
  ok(/im\.fetchPriority=['"]high['"]/.test(body)&&/im\.width=1280/.test(body)&&/im\.height=720/.test(body),'pkRenderCover sizes and prioritises the stage image');
}

// (n) Fraunces loads no italic weights; the two rules that set font-style:italic let the browser synthesize it.
{
  const link=(h.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*">/)||[''])[0];
  ok(!!link,'the Google Fonts link found');
  ok(!/ital,1/.test(link)&&!/:ital/.test(link),'the fonts link carries no Fraunces italic entries');
}

// (o) rooms, images and the object catalog are cached at the edge; the OWASP-review security headers are untouched.
ok(/\/catalog\/rooms\/\*\r?\n\s*Cache-Control: public, max-age=604800/.test(headersTxt),'_headers: /catalog/rooms/* cached a week');
ok(/\/img\/\*\r?\n\s*Cache-Control: public, max-age=604800/.test(headersTxt),'_headers: /img/* cached a week');
ok(/\/catalog\/\*\.json\r?\n\s*Cache-Control: public, max-age=3600/.test(headersTxt),'_headers: /catalog/*.json cached an hour');
['X-Frame-Options: SAMEORIGIN','X-Content-Type-Options: nosniff','Content-Security-Policy-Report-Only:'].forEach(s=>ok(headersTxt.indexOf(s)>=0,'_headers: existing security header kept: '+s));

// (p) none of the review's flagged internal words reach a visitor (code comments are exempt).
{
  const codeStripped=h.replace(/\/\*[\s\S]*?\*\//g,'').split('\n').map(l=>l.replace(/\/\/.*/,'')).join('\n');
  ['starter persona','starter filter','email link','composed persona','grid of'].forEach(s=>
    ok(!new RegExp(s,'i').test(codeStripped),'no visitor-facing "'+s+'"'));
}

// (q) INITIAL_SESSION firing after route() already painted Places or the Life log must not repaint or
// recount a visit; each carries the same generation-guard shape as renderHome's __homeGen / pkRenderSparks's sec.__gen.
{
  const chk=(name,genName)=>{ const s=h.indexOf('async function '+name+'('); ok(s>0,name+' found');
    if(s>0){ const e=h.indexOf('\nasync function ',s+10); const body=h.slice(s,e>0?e:s+2000);
      ok(new RegExp(genName).test(body),name+' carries a generation guard ('+genName+')'); } };
  chk('renderPlaces','__placesGen'); chk('renderPlace','__placeGen'); chk('renderLife','__lifeGen');
}

// Dylan's two rulings of 2026-09-13: no real person's grid on the page (review item 16), the billing SDK off the first paint (item 24)
ok(!/id="showdata"/.test(h)&&!/\bSHOW\b/.test(h.slice(h.indexOf('<script type="module">'))),'no showcase grid island ships on the page (review item 16)');
ok(/newshow'\)\.onclick=async\(\)=>\{ const t=await fetch\('\/templates\/founder\.json'\)/.test(h),'New from showcase seeds from the fictional Founder template');
ok(!/^\s*import [^\n]*revenuecat/m.test(h)&&/const rcSdk=\(\)=>import\('https:\/\/esm\.sh\/@revenuecat\/purchases-js@1\.55\.0'\)/.test(h),'the RevenueCat SDK is a dynamic import (review item 24)');
ok(/const \{Purchases\}=await rcSdk\(\);/.test(h)&&/const \{ErrorCode,PurchasesError\}=await rcSdk\(\)/.test(h),'the buy path loads the SDK and its error types on demand');

// Room reply thread (v22): pkChatMsgEl gives a persona reply in the Room a face row; the visitor and non-room stay plain bubbles.
{
  const src=cut("const MEDIA_BASE='",'else { el.textContent=initial; } }')+' '+cut('function pkChatMsgEl(m,inRoom,faceUrl,faceInit)','d.textContent=m.content; return d;')+'}';
  const mk=()=>{ const o={className:'',textContent:'',kids:[]}; o.append=(...n)=>o.kids.push(...n); o.appendChild=n=>o.kids.push(n); return o; };
  const doc={createElement:()=>mk()};
  const {avatarInto,pkChatMsgEl}=new Function('document',src+' return {avatarInto,pkChatMsgEl};')(doc);
  const rowEl=pkChatMsgEl({role:'assistant',content:'Hello.'},true,'','C');
  ok(rowEl.className==='msgrow','a room reply is a face row: '+rowEl.className);
  ok(rowEl.kids.length===2&&rowEl.kids[0].className==='msgav'&&rowEl.kids[1].className==='msg a','the row is avatar then assistant bubble: '+JSON.stringify(rowEl.kids.map(k=>k.className)));
  ok(rowEl.kids[1].textContent==='Hello.','the bubble carries the reply text');
  const uEl=pkChatMsgEl({role:'user',content:'Hi.'},true,'','C');
  ok(uEl.className==='msg u'&&uEl.textContent==='Hi.','the visitor message stays a plain right bubble, no face row');
  const eEl=pkChatMsgEl({role:'assistant',content:'x'},false,'','C');
  ok(eEl.className==='msg a','outside the Room an assistant message is a plain bubble, no face row');
}

// Share link uses the pretty path (v22): a persona with a handle shares /@handle/Persona, which the Worker cards.
{
  const src=cut('function shareUrlFor(id,name,handle)','encodeURIComponent(id); }');
  const {shareUrlFor}=new Function('location',src+' return {shareUrlFor};')({origin:'https://personakind.com',pathname:'/'});
  ok(shareUrlFor("gid","The Coach","coach")==="https://personakind.com/@coach/The%20Coach","a persona with a handle shares the pretty path: "+shareUrlFor("gid","The Coach","coach"));
  ok(shareUrlFor("gid","Nameless","")==="https://personakind.com/?t=gid","no handle falls back to the uuid form: "+shareUrlFor("gid","Nameless",""));
}

// Account settings (2026-09-14, Dylan: "Let's not hide it"). The rows exist in words; plain Sign out is this device only because
// supabase-js defaults signOut() to the GLOBAL scope (the 2026-09-13 scar); global lives only behind Sign out everywhere; a bad or
// stale password change never reaches updateUser. Lifted with a stubbed document and a recording SB.
{
  const box=cut('<section class="acplan" id="acplan"','</section>');
  ['Change password','Change email','Manage subscription','Sign out everywhere','Download my data'].forEach(t=>ok(box.includes('<b>'+t+'</b>'),'settings row labelled in words: '+t));
  ok(!/SB\.auth\.signOut\(\)/.test(h),'no bare signOut(): its default scope is global and would end every device');
  ok((h.match(/scope:'global'/g)||[]).length===1,'the global sign out appears exactly once');
  ok(/\.pkacform\[hidden\]\{display:none\}/.test(h),'a hidden settings form stays hidden under its display:flex rule');
  ok(h.includes(":'?account'"),'Account with no handle opens ?account, not Home');
  const fsrc=cut('function pkAccountSettings(session)','onclick=pkDownloadData;\n}');
  const els={}; const mk=(id)=>els[id]||(els[id]={id,hidden:true,value:'',textContent:'',dataset:{},setAttribute(){},focus(){},reset(){},querySelector(sel){ return sel==='.acmsg'?mk(id+':msg'):null; }});
  const calls=[]; let on=true, opened=0;
  const SB={auth:{getSession:async()=>({data:{session:on?{user:{email:'a@b.co'}}:null}}),updateUser:async(x)=>{ calls.push(['update',x]); return {error:null}; },signOut:async(x)=>{ calls.push(['signOut',x]); return {error:null}; }}};
  const doc={getElementById:mk,querySelectorAll:()=>[]};
  const pkAccountSettings=new Function('document','SB','openAuth','pkAuthSet','pkEmailOk','authReturn','location','pkDownloadData',fsrc+'\nreturn pkAccountSettings;')(doc,SB,()=>{ opened++; },()=>{},v=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),()=>'/',{origin:'',pathname:'/',href:''},()=>{});
  pkAccountSettings({user:{email:'a@b.co'}});
  const ev={preventDefault(){}};
  mk('pkacpw1').value='short'; mk('pkacpw2').value='short'; await els.pkacpw.onsubmit(ev); ok(calls.length===0,'a password under 8 characters never reaches updateUser');
  mk('pkacpw1').value='longenough1'; mk('pkacpw2').value='longenough2'; await els.pkacpw.onsubmit(ev); ok(calls.length===0,'mismatched passwords never reach updateUser');
  on=false; mk('pkacpw2').value='longenough1'; await els.pkacpw.onsubmit(ev); ok(calls.length===0&&opened===1,'a stale session is sent to sign in first');
  on=true; await els.pkacpw.onsubmit(ev); ok(calls.length===1&&calls[0][1].password==='longenough1','a good password is saved');
  mk('pkacem1').value='A@b.co'; await els.pkacem.onsubmit(ev); ok(calls.length===1,'the current email is not re-sent');
  mk('pkacem1').value='new@b.co'; await els.pkacem.onsubmit(ev); ok(calls.length===2&&calls[1][1].email==='new@b.co','a new email goes to updateUser');
  await els.pkacallyes.onclick(); ok(calls.length===3&&calls[2][0]==='signOut'&&calls[2][1].scope==='global','Sign out everywhere uses the global scope');
}

// Delete account (2026-09-14). Step one names what goes from the Worker's own counts; the button stays off until DELETE is typed;
// the plan box is demanded only when a plan is active AND the box is on screen (Rendered-Control, both directions); a shared
// login is sent to support with the input off; the confirm body carries no account id at all.
{
  const box=cut('<section class="acplan" id="acplan"','</section>'); ok(box.includes('<b>Delete account</b>'),'settings row labelled in words: Delete account');
  ok(h.includes('#account .btn.solid.pkdanger{background:#B42318'),'the delete button out-specifies #account .btn.solid, so it renders red, not violet');
  const dsrc=cut('function pkAccountDelete()',"'Nothing was deleted. Try again in a moment.'; ready(); };\n}");
  const els={}; const mk=(id)=>els[id]||(els[id]={id,hidden:false,disabled:false,checked:false,value:'',textContent:'',setAttribute(){},focus(){},querySelector(sel){ return sel==='.acmsg'?mk(id+':msg'):null; }});
  let reply=null; const sent=[]; let signedOut=null;
  const fetchStub=async(url,init)=>{ sent.push({url,body:JSON.parse(init.body),auth:init.headers.Authorization}); return {status:reply.status,json:async()=>reply.j}; };
  const loc={origin:'',pathname:'/',href:''};
  const make=()=>new Function('document','fetch','hostedToken','HOSTED_API','openAuth','pkAuthSet','SB','location',dsrc+'\nreturn pkAccountDelete;')({getElementById:mk},fetchStub,async()=>'jwt','/api',()=>{},()=>{},{auth:{signOut:async(x)=>{ signedOut=x; }}},loc);
  make()();
  mk('pkacdelbox').hidden=true; reply={status:200,j:{summary:{personas:3,published:1,guestbook:4,images:2,kindred:1,sparks_given:0,designs:2,charges_kept:1,plan_active:false}}};
  await els.pkacdel.onclick();
  ok(sent.length===1&&sent[0].body.dry_run===true,'opening the row asks for a dry run first');
  ok(/3 personas \(1 published\)/.test(els.pkacdeltext.textContent)&&/4 sparks/.test(els.pkacdeltext.textContent)&&/2 images/.test(els.pkacdeltext.textContent),'the confirm names what goes: '+els.pkacdeltext.textContent);
  ok(/2 print designs/.test(els.pkacdeltext.textContent)&&/Payment records stay for tax purposes, without your name or contact details/.test(els.pkacdeltext.textContent),'the confirm names print designs and says charges stay for tax, nameless: '+els.pkacdeltext.textContent);
  ok(els.pkacdelplanrow.hidden===true,'no plan, no plan box');
  ok(els.pkacdelgo.disabled===true,'the delete button is off before DELETE is typed');
  els.pkacdelin.value='delete'; els.pkacdelin.oninput(); ok(els.pkacdelgo.disabled===true,'lowercase delete does not arm it');
  els.pkacdelin.value='DELETE'; els.pkacdelin.oninput(); ok(els.pkacdelgo.disabled===false,'DELETE typed arms it when no plan box is on screen');
  reply={status:200,j:{deleted:true}}; await els.pkacdelgo.onclick();
  ok(sent.length===2&&Object.keys(sent[1].body).sort().join(',')==='ack_plan,confirm'&&sent[1].body.confirm==='DELETE','the confirm body carries confirm and ack_plan only, never an account id: '+JSON.stringify(sent[1].body));
  ok(sent[1].auth==='Bearer jwt','the account comes from the caller JWT');
  ok(signedOut&&signedOut.scope==='local'&&/\?deleted=1$/.test(loc.href),'after delete this device signs out locally and lands on the landing');
  mk('pkacdelbox').hidden=true; reply={status:200,j:{summary:{personas:1,published:0,guestbook:0,images:0,kindred:0,sparks_given:0,plan_active:true}}};
  await els.pkacdel.onclick(); ok(els.pkacdelplanrow.hidden===false,'an active plan shows the plan box');
  els.pkacdelin.value='DELETE'; els.pkacdelin.oninput(); ok(els.pkacdelgo.disabled===true,'with the plan box on screen, DELETE alone does not arm it');
  els.pkacdelplan.checked=true; els.pkacdelplan.onchange(); ok(els.pkacdelgo.disabled===false,'ticking the plan box arms it');
  mk('pkacdelbox').hidden=true; reply={status:409,j:{error:'contact_support',summary:{}}};
  await els.pkacdel.onclick(); ok(els.pkacdelin.disabled===true&&/official/.test(els.pkacdeltext.textContent)&&/support@personakind\.com/.test(els.pkacdeltext.textContent),'only an official account goes to support, with the input off');
}
// The sent card's go back button (2026-09-14, Dylan's screenshot): .btn.ghost is transparent and inherits the editor's light button ink,
// so on the white auth card its label was near invisible. The auth card gives it the public ink and line.
ok(/#auth \.authcard \.btn\.ghost\{[^}]*border-color:var\(--ink-soft\)/.test(h),'the go back outline clears 3 to 1 on the white card (--line-w measured 1.34 to 1)');
ok(/#auth \.authcard \.btn\.ghost\{[^}]*color:var\(--ink\)/.test(h),'the auth card ghost button (go back) uses the public ink, not the editor ink');

// Persona of the day (2026-09-14, the splash plan S1). The hero leads with one published persona a visitor can read, hear and step
// into, rotating daily and identical for everyone that day. Lifted with stubs: the pick only takes bucket portraits, the lines come
// from the persona's own public core cells, and Hear it renders only where the browser can speak (Rendered-Control, both directions).
{
  const src=cut('function cellBody(v){','return out || t.trim(); }')+'\n'+cut('function profileSummary(g,short){',"+'\\u2026';\n}")+'\n'+cut('function pkSpotPick(rows,day){','return ok[i]; }')+'\n'+cut('function pkSpotLines(g){','wont:first(cells.DONT)}; }');
  const MB='https://bucket.example/';
  const {pkSpotPick,pkSpotLines}=new Function('MEDIA_BASE',src+'\nreturn {pkSpotPick,pkSpotLines};')(MB);
  const rows=[{id:'a',image_url:MB+'a.webp'},{id:'x',image_url:'https://elsewhere.example/x.png'},{id:'b',image_url:MB+'b.webp'},{id:'c',image_url:null},{id:'d',image_url:MB+'d.webp'}];
  ok(pkSpotPick(rows,0).id==='a'&&pkSpotPick(rows,1).id==='b'&&pkSpotPick(rows,2).id==='d'&&pkSpotPick(rows,3).id==='a','the pick rotates by day over bucket portraits only');
  ok(pkSpotPick(rows,20000).id===pkSpotPick(rows,20000).id,'the same day picks the same persona for everyone');
  ok(pkSpotPick([{id:'x',image_url:'https://elsewhere.example/x.png'}],5)===null&&pkSpotPick([],1)===null,'no bucket portrait, no pick');
  const g={facets:[{name:'core',cells:{CONTEXT:'# core / CONTEXT\n\nYou are an early-stage startup founder running lean with limited runway. Everything else follows.',DO:'# core / DO\n\nBias hard to action: ship the smallest thing that tests the real question, then let evidence steer. Protect the team.',DONT:'# core / DONT\n\n(add your own here)'}},{name:'vibe',cells:{DO:'Keep it loose.'}}]};
  const L=pkSpotLines(g);
  ok(L.summary==='An early-stage startup founder running lean with limited runway.','the summary is the persona\'s own first sentence: '+JSON.stringify(L.summary));
  ok(L.does==='Bias hard to action: ship the smallest thing that tests the real question, then let evidence steer.','Does is the first sentence of its DO: '+JSON.stringify(L.does));
  ok(L.wont==='','a placeholder cell gives no Won\'t line');
  const long=pkSpotLines({facets:[{name:'core',cells:{DO:'# core / DO\n\n'+'word '.repeat(60)}}]}).does;
  ok(long.length<=121&&long.endsWith('\u2026'),'a long line is cut at a word with an ellipsis: '+long.length);
  const card=cut('function pkSpotCard(r){','return box; }'), wall=cut('async function pkFacesWall(){','card.appendChild(grid); }');
  ok(!/innerHTML/.test(card+wall+cut('function pkSpotLines(g){','wont:first(cells.DONT)}; }')),'the hero spotlight writes text with textContent only');
  ok(/if\(rows\.length<3\) return;/.test(wall)&&/pkSpotPick\(rows,Math\.floor\(Date\.now\(\)\/86400000\)\)/.test(wall)&&wall.includes("'Persona of the day'"),'the wall still needs three portraits, then leads with the persona of the day');
  ok(!/\/api\/chat|twingrid_use_credit|openChat\(/.test(card+wall),'the hero spends no hosted credit: no chat call from the spotlight');
  // Hear it: rendered only where speech exists, and present where it does
  const mk=()=>{ const e={tag:'',kids:[],attrs:{},textContent:'',className:'',href:'',type:'',append(...k){ this.kids.push(...k); },appendChild(k){ this.kids.push(k); return k; },setAttribute(a,v){ this.attrs[a]=v; }}; return e; };
  const doc={createElement:t=>Object.assign(mk(),{tag:t})};
  const all=n=>[n].concat(...(n.kids||[]).map(all));
  const build=speak=>new Function('document','avatarInto','pkSpotLines','pkCanSpeak','pkSpotSpeak',card+'\nreturn pkSpotCard;')(doc,()=>{},()=>({summary:'A founder.',does:'Ship.',wont:'Stall.'}),()=>speak,()=>{})({id:'g1',name:'The Founder',image_url:MB+'a.webp',data:{facets:[]}});
  const withSpeech=all(build(true)), without=all(build(false));
  ok(withSpeech.some(n=>n.tag==='button'&&n.textContent==='Hear it'),'Hear it renders where the browser can speak');
  ok(!without.some(n=>n.textContent==='Hear it'),'Hear it is absent, not dead, where it cannot');
  ok(withSpeech.some(n=>n.tag==='a'&&n.textContent==='Talk to it'&&n.href==='?room=g1')&&withSpeech.some(n=>n.tag==='a'&&n.textContent==='Read it'&&n.href==='?t=g1'),'Talk to it opens the Room and Read it opens the page');
  ok(withSpeech.some(n=>n.className==='pkspot-line'),'the Does and Won\'t lines render');
}
// Name guard and Room reporting (2026-09-15). The #rpt dialog used to live inside #profile, which carries
// #profile{display:none} outside route-profile; that ID selector beats .rpt.open{display:flex} on
// specificity alone (100 vs 20), so a dialog nested there could never be opened from the Room. It is now a
// top-level sibling, opened by one shared openReportDialog() from either control. Read from the source.
{
  const profS=h.indexOf('<div id="profile">'), profE=h.indexOf('\n<!-- Moved out of #profile',profS);
  ok(profS>0&&profE>profS,'#profile found, closing before the moved dialog');
  const rptS=h.indexOf('<div class="rpt" id="rpt"');
  ok(rptS>profE,'#rpt now sits after #profile closes, not inside it');
  ok(!/<div class="rpt" id="rpt"[\s\S]{0,4000}<\/section>\s*<div class="pctrl"/.test(h.slice(profS,profE+50)),'no stray copy of #rpt left inside #profile');
  ok(/function openReportDialog\(msgEl\)/.test(h),'openReportDialog exists as the one place that opens #rpt');
  ok(/rep\.onclick=\(\)=>openReportDialog\(msg\)/.test(h),"the persona page's Report opens it with its status line");
  ok(/if\(rrep\) rrep\.onclick=\(\)=>openReportDialog\(null\)/.test(h),"the Room's Report opens it with no status line");
  const top=h.indexOf('<div id="pkroom" hidden>'), wrap=h.indexOf('<div class="pkrmwrap">',top);
  const btnI=h.indexOf('id="pkrrreport"',top);
  ok(btnI>top&&btnI<wrap,'#pkrrreport sits above the stage');
  // measured 2026-09-15: in the top strip it pushed .pkrmtop to 433 px at 390 and clipped "Read the persona"; the rate row wraps
  const tStrip=h.indexOf('<div class="pkrmtop">',top), tStripE=h.indexOf('</div>',tStrip), rRow=h.indexOf('<div class="pkrmraterow">',top), rRowE=h.indexOf('</div>',rRow);
  ok(!(btnI>tStrip&&btnI<tStripE)&&btnI>rRow&&btnI<rRowE,'#pkrrreport lives in the wrapping rate row, never the nowrap top strip');
  ok(/<button class="btn" id="pkrrreport" type="button" hidden>Report<\/button>/.test(h),'the Room Report control is a real button, hidden by default (shown only for a visitor)');
  const rm=h.indexOf('async function renderRoom('), rmE=h.indexOf('\nfunction route(){',rm);
  ok(rm>0&&rmE>rm&&/rrep\.hidden=!!mine/.test(h.slice(rm,rmE)),'the Room hides Report from the owner, shows it to a visitor');
  // the same dialog inserts the same row shape (grid_id, reporter, reason, note) whichever control opened it
  const sendS=h.indexOf("send.onclick=async()=>{"), sendE=h.indexOf('\n})();',sendS);
  ok(sendS>0&&sendE>sendS&&/from\('twingrid_reports'\)\.insert\(\{/.test(h.slice(sendS,sendE)),'the one send handler inserts into twingrid_reports for either caller');
}
// name_reserved (2026-09-15 migration): mapped to the SQL hint text at both places a grid's is_public is
// written from the page, alongside the existing adult_confirmation_required mapping, textContent only.
{
  ok(/name_reserved.*belongs to a real person or brand.*support@personakind\.com/.test(h.replace(/\n/g,' ')),'the Home publish-toggle path maps name_reserved to the hint');
  ok(/error&&\/name_reserved\/\.test\(String\(error\.message\|\|''\)\)/.test(h),'the editor save path checks name_reserved the same way it checks adult_confirmation_required');
  ok((h.match(/name_reserved.*?support@personakind\.com from an address that proves it is yours\./g)||[]).length>=2||(h.match(/name_reserved/g)||[]).length>=3,'name_reserved is handled at both write sites, not just one');
}

console.log(fails?('inplace_check: '+fails+' failed'):'inplace_check OK'); process.exit(fails?1:0);
