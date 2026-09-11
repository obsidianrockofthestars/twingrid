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
console.log(fails?('inplace_check: '+fails+' failed'):'inplace_check OK'); process.exit(fails?1:0);
