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
  ok(/profileSummary\(g\)/.test(body),'one sentence per card, the same sentence the persona page leads with');
  ok(/className='exrate'/.test(body)&&/className='exmood'/.test(body),'the rating and the mood line stay');
  ok(/#explore \.exav\{width:72px;height:72px/.test(h),'the face is 72 px');
  const m=h.indexOf('<div id="explore">'), mE=h.indexOf('<button id="helpbtn"',m); const mk=h.slice(m,mE);
  ok(!/grid of plain cells/.test(mk),'the lede no longer says grid of plain cells');
  ok(/Hide the example personas/.test(mk),'the filter is in a stranger\'s words');
}

console.log(fails?('inplace_check: '+fails+' failed'):'inplace_check OK'); process.exit(fails?1:0);
