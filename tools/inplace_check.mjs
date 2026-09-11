// The desk on the signed-in Home (v16): nfCompose writes the five core cells from the fourteen answers, pkhpInvert reads them back,
// pkhpWriteBack rebuilds a cell it can explain and appends under one it cannot. Exit 1 on any miss. Functions are lifted from the page.
import fs from 'node:fs';
const h=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const cut=(from,to)=>{ const i=h.indexOf(from); const j=h.indexOf(to,i); if(i<0||j<0) throw new Error('anchor missing: '+from.slice(0,40)); return h.slice(i,j+to.length); };
const src=[cut('function nfCell(name,parts)','(add your own here)"); }'),cut('function nfCompose(A)',"GATES:nfCell('GATES',[A('rule'), A('line')]) }; }"),cut('const PK_CORE_HDR=','/i;'),cut('function pkhpInvert(cells)','return {a,ok}; }'),cut('function pkhpWriteBack(cells,ans,ok)','return out; }')].join('\n');
const {nfCompose,pkhpInvert,pkhpWriteBack}=new Function(src+'\nreturn {nfCompose,pkhpInvert,pkhpWriteBack};')();
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
console.log(fails?('inplace_check: '+fails+' failed'):'inplace_check OK'); process.exit(fails?1:0);
