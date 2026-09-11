/* Personakind, the Home as a cutaway (Dylan's ruling, 2026-09-10 evening, replacing the isometric draw of the same morning).
   Classic script, defines window.pkScene. A side-on cutaway of a house, three floors stacked: the visiting room out front
   at the top (the public scope), the Home floor (the Kindred scope), the basement (the Whole house scope, the depth). One
   light upper left, three tones per material plus an outline, the accent tinted from the owner's colour (the A1 sheet).
   Sprites are the same part lists as docs/catalog/sprites.json, drawn front-on. Never a URL, never user text: labels go
   through the page's textContent path; facet doors are anonymous plaques and the page names them on hover. */
(function(){
'use strict';
var W=560, H=430, COLS=8, CW=60, UNIT=40, DEPTH=7, LEFT=40, TOP=34, FH=120, TOOLW=32;
var RIGHT=LEFT+COLS*CW; /* 520; tools live in the strip 520..552, the outer wall at 556 */
var MAT={wood:'#8B5A2B',paper:'#EDEBF2',ink:'#2A2A36',leaf:'#3E8E5B',metal:'#8A8F98',glass:'#A7D8F0',cloth:'#C96A6A',stone:'#9A9AA6',brass:'#C9A227',sky:'#BFE3F5',sand:'#D9C7A0'};
var PAPER='#F7F7FA', INK='#1B1B22';
function rgb(h){ h=String(h||'').replace('#',''); if(!/^[0-9a-fA-F]{6}$/.test(h)) h='5B45E0'; return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function hex(c){ return '#'+c.map(function(v){ v=Math.max(0,Math.min(255,Math.round(v))); return (v<16?'0':'')+v.toString(16); }).join(''); }
function mix(a,b,t){ var x=rgb(a), y=rgb(b); return hex([x[0]+(y[0]-x[0])*t, x[1]+(y[1]-x[1])*t, x[2]+(y[2]-x[2])*t]); }
function tones(mid){ return {light:mix(mid,PAPER,.38), mid:mid, shadow:mix(mid,INK,.38), line:mix(mid,INK,.72)}; }
function matTones(m,accent){ var mid=(m==='accent')?accent:(MAT[m]||MAT.stone); return tones(mid); }
function rect(ctx,x,y,w,h,fill,line){ if(w<=0||h<=0) return; ctx.beginPath(); ctx.rect(x,y,w,h); if(fill){ ctx.fillStyle=fill; ctx.fill(); } if(line){ ctx.strokeStyle=line; ctx.lineWidth=1; ctx.stroke(); } }
function ell(ctx,cx,cy,rx,ry,fill,line){ ctx.beginPath(); ctx.ellipse(cx,cy,Math.max(.5,rx),Math.max(.5,ry),0,0,Math.PI*2); if(fill){ ctx.fillStyle=fill; ctx.fill(); } if(line){ ctx.strokeStyle=line; ctx.lineWidth=1; ctx.stroke(); } }
function grow(bb,x0,y0,x1,y1){ if(x0<bb[0]) bb[0]=x0; if(y0<bb[1]) bb[1]=y0; if(x1>bb[2]) bb[2]=x1; if(y1>bb[3]) bb[3]=y1; }
function floorOf(i){ var top=TOP+i*FH; return {i:i, top:top, bottom:top+FH, base:top+FH-8, left:LEFT, right:RIGHT}; }
/* one part, front-on: the front face in the mid tone, a top strip in the light tone (its depth), a shadow band at the foot */
function partFront(ctx,p,ox,base,t,bb){ var yo=(p.y||0)*DEPTH, z=(p.z||0)*UNIT;
  if(p.t==='box'){ var x=ox+p.x*CW, w=p.w*CW, h=p.h*UNIT, y=base-yo-z-h, d=Math.max(2,p.d*DEPTH);
    rect(ctx,x,y-d,w,d,t.light,t.line); rect(ctx,x,y,w,h,t.mid,t.line); rect(ctx,x+.5,y+h*.78,w-1,h*.22,t.shadow,null); grow(bb,x,y-d,x+w,y+h); }
  else if(p.t==='cyl'){ var r=p.r*CW, cx=ox+p.x*CW, w2=2*r, h2=p.h*UNIT, y2=base-yo-z-h2, ry=Math.max(2,p.r*DEPTH);
    rect(ctx,cx-r,y2,w2,h2,t.mid,t.line); rect(ctx,cx+r*.35,y2+.5,r*.65-.5,h2-1,t.shadow,null); ell(ctx,cx,y2,r,ry,t.light,t.line); grow(bb,cx-r,y2-ry,cx+r,y2+h2); }
  else if(p.t==='ball'){ var rr=p.r*CW, bx=ox+p.x*CW, by=base-yo-z-rr; ell(ctx,bx,by,rr,rr,t.mid,t.line);
    ctx.save(); ctx.beginPath(); ctx.arc(bx,by,rr-.5,0,Math.PI*2); ctx.clip(); ell(ctx,bx+rr*.35,by+rr*.35,rr*.95,rr*.95,t.shadow,null); ell(ctx,bx-rr*.05,by-rr*.05,rr*.72,rr*.72,t.mid,null); ell(ctx,bx-rr*.4,by-rr*.4,rr*.28,rr*.22,t.light,null); ctx.restore(); grow(bb,bx-rr,by-rr,bx+rr,by+rr); } }
function partKey(p){ var dy=(p.t==='box')?(p.y+p.d/2):p.y; return -dy*10+(p.z||0); }
/* one sprite with its footprint origin at column col on floor fl; returns the screen bbox */
function sprite(ctx,sp,col,fl,accent){ var f=floorOf(fl), ox=LEFT+col*CW, bb=[1e9,1e9,-1e9,-1e9];
  var parts=(sp.parts||[]).slice().sort(function(a,b){ return partKey(a)-partKey(b); });
  for(var i=0;i<parts.length;i++) partFront(ctx,parts[i],ox,f.base,matTones(parts[i].m,accent),bb); return bb; }
/* the house: sky and a roof above, earth around the basement, three floors with wall, baseboard and trim; the visiting room
   gets an awning and an open front, the basement gets stone. An unlit floor is drawn, then dimmed with a lock. */
var FLOOR_KEYS=['visiting','main','basement'];
function drawHouse(ctx,rm,accent,lit){ var f0=floorOf(0), f2=floorOf(2), ground=floorOf(1).bottom;
  rect(ctx,0,0,W,H,mix(MAT.sky,PAPER,.55),null); rect(ctx,0,ground,W,H-ground,mix(MAT.stone,INK,.35),null);
  ctx.beginPath(); ctx.moveTo(-6,f0.top); ctx.lineTo(W/2,4); ctx.lineTo(RIGHT+TOOLW+18,f0.top); ctx.closePath(); ctx.fillStyle=mix(accent,INK,.45); ctx.fill(); ctx.strokeStyle=INK; ctx.lineWidth=1; ctx.stroke();
  for(var i=0;i<3;i++){ var f=floorOf(i); var wallM=(i===2)?MAT.stone:(rm.wall||'paper'); var t=tones(mix(MAT[wallM]||MAT.paper,accent,.08)); var fl=(i===2)?MAT.stone:(MAT[rm.floor||'paper']||MAT.paper); var ft=tones(fl); var tr=matTones(rm.trim||'wood',accent);
    rect(ctx,4,f.top,RIGHT+TOOLW+4,FH,t.mid,null);
    rect(ctx,4,f.top,RIGHT+TOOLW+4,f.base-f.top,t.light,null);
    rect(ctx,4,f.base,RIGHT+TOOLW+4,FH-(f.base-f.top),ft.mid,null); rect(ctx,4,f.base,RIGHT+TOOLW+4,3,ft.light,null);
    rect(ctx,4,f.base-4,RIGHT+TOOLW+4,4,tr.mid,tr.line);
    if(i===0){ for(var k=0;k<12;k++) rect(ctx,4+k*(RIGHT+TOOLW+4)/12,f.top,(RIGHT+TOOLW+4)/12,10,(k%2)?accent:mix(accent,PAPER,.6),null); }
    if(i===1&&rm.window!==false){ var g=matTones('glass',accent); rect(ctx,LEFT+CW*2.6,f.top+18,CW*1.4,44,g.light,tr.line); rect(ctx,LEFT+CW*3.28,f.top+18,3,44,tr.mid,null); }
    rect(ctx,4,f.top,RIGHT+TOOLW+4,FH,null,INK); }
  rect(ctx,2,f0.top,4,f2.bottom-f0.top,mix(accent,INK,.5),INK); rect(ctx,RIGHT+TOOLW+4,f0.top,4,f2.bottom-f0.top,mix(accent,INK,.5),INK); }
function dimFloor(ctx,i){ var f=floorOf(i); ctx.fillStyle='rgba(27,27,34,.62)'; ctx.fillRect(4,f.top,RIGHT+TOOLW+4,FH);
  var cx=(LEFT+RIGHT)/2, cy=f.top+FH/2; rect(ctx,cx-10,cy-2,20,16,PAPER,INK); ctx.beginPath(); ctx.arc(cx,cy-4,7,Math.PI,0); ctx.strokeStyle=PAPER; ctx.lineWidth=3; ctx.stroke(); }
/* facet doors: anonymous plaques on the back wall of the floor that owns the scope; the first (core) is wider */
function drawDoors(ctx,i,names,accent,hots){ var f=floorOf(i), x=LEFT+8, y=f.top+16, lt=tones(accent);
  for(var k=0;k<names.length&&k<14;k++){ var w=(k===0&&names[k]==='core')?40:26, h=36; if(x+w>RIGHT-4) break;
    rect(ctx,x,y,w,h,mix(accent,PAPER,.55),lt.line); rect(ctx,x+3,y+3,w-6,h-6,null,mix(accent,PAPER,.3)); ell(ctx,x+w-7,y+h/2,2,2,lt.shadow,null);
    hots.push({kind:'door',facet:names[k],floor:i,bb:[x,y,x+w,y+h]}); x+=w+8; } }
/* tools in the right strip: the Workshop hatch (basement), the core desk and the snapshot chest (Home floor), the shelf (visiting) */
function drawTool(ctx,i,id,accent,hots,side){ var f=floorOf(i), x=(side==='left')?8:RIGHT+3, w=TOOLW-6, lt=tones(accent), wd=matTones('wood',accent), mt=matTones('metal',accent);
  if(id==='workshop'){ rect(ctx,x,f.base-30,w,30,mix(INK,accent,.25),INK); rect(ctx,x+4,f.base-26,w-8,22,INK,lt.line); ell(ctx,x+w/2,f.base-15,5,5,null,lt.light); hots.push({kind:'tool',id:id,floor:i,bb:[x,f.base-30,x+w,f.base]}); }
  else if(id==='core'){ rect(ctx,x,f.base-34,w,6,wd.light,wd.line); rect(ctx,x+3,f.base-28,w-6,28,wd.mid,wd.line); rect(ctx,x+6,f.base-44,w-12,10,mix(accent,PAPER,.5),lt.line); hots.push({kind:'tool',id:id,floor:i,bb:[x,f.base-44,x+w,f.base]}); }
  else if(id==='obsidian'){ rect(ctx,x,f.base-22,w,22,wd.mid,wd.line); rect(ctx,x,f.base-28,w,8,wd.light,wd.line); rect(ctx,x+w/2-3,f.base-20,6,6,mt.mid,mt.line); hots.push({kind:'tool',id:id,floor:i,bb:[x,f.base-28,x+w,f.base]}); }
  else if(id==='shelf'){ rect(ctx,x-2,f.top+40,w+4,4,wd.mid,wd.line); rect(ctx,x-2,f.top+66,w+4,4,wd.mid,wd.line); rect(ctx,x+2,f.top+22,10,16,mix(accent,PAPER,.5),lt.line); rect(ctx,x+15,f.top+26,9,12,MAT.brass,tones(MAT.brass).line); rect(ctx,x+3,f.top+50,18,14,PAPER,INK); hots.push({kind:'tool',id:id,floor:i,bb:[x-2,f.top+20,x+w+2,f.top+72]}); } }
/* placement: a saved column and floor are kept when they fit; the rest fill their zone's floor from the left */
var ZONE_FLOOR={resting:0,thinking:1,memory:2};
function fits(items,x,y,w){ if(x<0||y<0||y>2||x+w>COLS) return false; for(var i=0;i<items.length;i++){ var it=items[i]; if(it.x===undefined) continue; if(it.y===y&&x<it.x+it.w&&it.x<x+w) return false; } return true; }
function place(house,man){ var by={}; (man.sprites||[]).forEach(function(s){ by[s.id]=s; }); var items=[]; var z=(house&&house.zones&&typeof house.zones==='object')?house.zones:{};
  ['thinking','resting','memory'].forEach(function(zk){ var list=Array.isArray(z[zk])?z[zk]:[]; list.forEach(function(it,i){ if(!it||typeof it!=='object') return; var sp=by[it.obj]; if(!sp) return;
    var w=sp.footprint?sp.footprint[0]:1; var rec={zone:zk,idx:i,ref:it,id:it.obj,sp:sp,w:w,d:sp.footprint?sp.footprint[1]:1};
    if(Number.isInteger(it.x)&&Number.isInteger(it.y)&&it.x>=0&&it.y>=0&&it.y<=2&&it.x+w<=COLS){ rec.x=it.x; rec.y=it.y; } items.push(rec); }); });
  items.forEach(function(rec){ if(rec.x!==undefined&&!fits(items.filter(function(q){ return q!==rec; }),rec.x,rec.y,rec.w)){ rec.x=undefined; rec.y=undefined; } });
  items.forEach(function(rec){ if(rec.x!==undefined) return; var fl=ZONE_FLOOR[rec.zone]||0, found=false;
    for(var pass=0;pass<3&&!found;pass++){ var y=(fl+pass)%3; for(var x=0;x<=COLS-rec.w&&!found;x++) if(fits(items,x,y,rec.w)){ rec.x=x; rec.y=y; found=true; } }
    if(!found){ rec.x=0; rec.y=fl; } });
  return items; }
function sortKey(it){ return -(it.y*1000)-(it.d||1)*10+it.x; }
/* the scene: one canvas; hotspots are objects, facet doors, tools and unlit floors; hover, click, keyboard, optional drag.
   opts: {manifest, house, room, accent, lit:[bool x3], facets:{lobby:[],visiting:[],house:[]}, tools:[{floor,id}], editable,
          linked (Set of facet names that open), avatar:{img,h}, onOpen(hot), onChange(item), label(hot|null)} */
function scene(canvas,opts){ var dpr=Math.max(1,Math.min(3,window.devicePixelRatio||1)); canvas.width=W*dpr; canvas.height=H*dpr; var ctx=canvas.getContext('2d'); if(!ctx) return null;
  var st={items:[],hots:[],sel:-1,hover:-1,drag:null};
  function rm(){ var rooms=(opts.manifest&&opts.manifest.rooms)||[]; for(var i=0;i<rooms.length;i++) if(rooms[i].key===opts.room) return rooms[i]; return rooms[0]||{}; }
  function lit(i){ return !(opts.lit&&opts.lit[i]===false); }
  function draw(){ ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H); ctx.lineJoin='round'; drawHouse(ctx,rm(),opts.accent,opts.lit); var hots=[];
    var scopes=['lobby','visiting','house']; for(var i=0;i<3;i++){ if(!lit(i)) continue; var names=(opts.facets&&opts.facets[scopes[i]])||[]; drawDoors(ctx,i,names,opts.accent,hots); }
    (opts.tools||[]).forEach(function(t){ if(lit(t.floor)) drawTool(ctx,t.floor,t.id,opts.accent,hots,t.side); });
    var order=st.items.map(function(it,i){ return i; }).sort(function(a,b){ return sortKey(st.items[a])-sortKey(st.items[b]); });
    var selHot=st.hots[st.sel], hovHot=st.hots[st.hover];
    order.forEach(function(k){ var it=st.items[k]; if(!lit(it.y)) return; var f=floorOf(it.y); var isSel=(selHot&&selHot.item===it)||(hovHot&&hovHot.item===it);
      if(isSel) rect(ctx,LEFT+it.x*CW+1,f.base-6,it.w*CW-2,6,mix(opts.accent,PAPER,.45),opts.accent);
      it.bb=sprite(ctx,it.sp,it.x,it.y,opts.accent); hots.push({kind:'obj',item:it,floor:it.y,bb:it.bb}); });
    var av=opts.avatar; if(av&&av.img&&av.img.complete&&av.img.naturalWidth&&lit(0)){ var f0=floorOf(0), ah=av.h||64, aw=ah*2/3, ax=LEFT+(av.col||0)*CW+CW/2; ctx.drawImage(av.img,ax-aw/2,f0.base-ah+2,aw,ah); }
    for(var j=0;j<3;j++) if(!lit(j)){ dimFloor(ctx,j); hots.push({kind:'floor',floor:j,bb:[4,floorOf(j).top,RIGHT+TOOLW+8,floorOf(j).bottom]}); }
    st.hots=hots; if(selHot){ st.sel=hots.findIndex(function(h){ return same(h,selHot); }); } if(hovHot){ st.hover=hots.findIndex(function(h){ return same(h,hovHot); }); }
    if(st.sel>=0){ var b=st.hots[st.sel].bb; rect(ctx,b[0]-3,b[1]-3,b[2]-b[0]+6,b[3]-b[1]+6,null,opts.accent); ctx.lineWidth=1; } }
  function same(a,b){ return a.kind===b.kind&&a.item===b.item&&a.facet===b.facet&&a.id===b.id&&a.floor===b.floor; }
  function hit(px,py){ for(var k=st.hots.length-1;k>=0;k--){ var h=st.hots[k]; if(h.kind==='floor') continue; var bb=h.bb; if(px>=bb[0]-2&&px<=bb[2]+2&&py>=bb[1]-2&&py<=bb[3]+2) return k; }
    for(var m=0;m<st.hots.length;m++){ var hf=st.hots[m]; if(hf.kind==='floor'&&py>=hf.bb[1]&&py<=hf.bb[3]) return m; } return -1; }
  function pos(e){ var r=canvas.getBoundingClientRect(); return [(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height]; }
  function say(i){ if(opts.label) opts.label(i>=0?st.hots[i]:null); }
  function move(it,x,y){ if(!fits(st.items.filter(function(q){ return q!==it; }),x,y,it.w)) return false; it.x=x; it.y=y; it.ref.x=x; it.ref.y=y; placeAvatar(); draw(); if(opts.onChange) opts.onChange(it); return true; }
  function placeAvatar(){ if(!opts.avatar||opts.avatar.fixed) return; var pref=[3,4,2,5,1,6,0,7]; for(var i=0;i<pref.length;i++) if(fits(st.items,pref[i],0,1)){ opts.avatar.col=pref[i]; return; } opts.avatar.col=3; }
  canvas.addEventListener('pointermove',function(e){ var p=pos(e);
    if(st.drag){ var it=st.drag.item; var nx=Math.round((p[0]-LEFT)/CW-st.drag.dx), ny=Math.floor((p[1]-TOP)/FH); nx=Math.max(0,Math.min(COLS-it.w,nx)); ny=Math.max(0,Math.min(2,ny)); if(nx!==it.x||ny!==it.y) move(it,nx,ny); return; }
    var h=hit(p[0],p[1]); if(h!==st.hover){ st.hover=h; var hs=st.hots[h]; canvas.style.cursor=hs?(opts.editable&&hs.kind==='obj'?'grab':((hs.kind==='door'&&opts.linked&&opts.linked.has(hs.facet))||hs.kind==='tool'?'pointer':'default')):'default'; draw(); say(h>=0?h:st.sel); } });
  canvas.addEventListener('pointerleave',function(){ if(st.drag) return; st.hover=-1; draw(); say(st.sel); });
  canvas.addEventListener('pointerdown',function(e){ var p=pos(e), h=hit(p[0],p[1]); st.sel=h; draw(); say(h); try{ canvas.focus({preventScroll:true}); }catch(_){}
    var hs=st.hots[h]; if(hs&&hs.kind==='obj'&&opts.editable){ st.drag={item:hs.item,dx:(p[0]-LEFT)/CW-hs.item.x}; try{ canvas.setPointerCapture(e.pointerId); }catch(_){} canvas.style.cursor='grabbing'; e.preventDefault(); } });
  canvas.addEventListener('pointerup',function(e){ if(st.drag){ st.drag=null; canvas.style.cursor='grab'; try{ canvas.releasePointerCapture(e.pointerId); }catch(_){} return; }
    var p=pos(e), h=hit(p[0],p[1]); var hs=st.hots[h]; if(hs&&hs.kind!=='obj'&&hs.kind!=='floor'&&opts.onOpen) opts.onOpen(hs); });
  canvas.addEventListener('keydown',function(e){ var n=st.hots.length; if(!n) return; var k=e.key; var hs=st.hots[st.sel];
    if(opts.editable&&hs&&hs.kind==='obj'&&(k==='ArrowLeft'||k==='ArrowRight'||k==='ArrowUp'||k==='ArrowDown')){ var it=hs.item; var nx=it.x+(k==='ArrowRight'?1:k==='ArrowLeft'?-1:0), ny=it.y+(k==='ArrowDown'?1:k==='ArrowUp'?-1:0);
      nx=Math.max(0,Math.min(COLS-it.w,nx)); ny=Math.max(0,Math.min(2,ny)); move(it,nx,ny); say(st.sel); e.preventDefault(); return; }
    var next=null; if(k==='ArrowRight'||k==='ArrowDown'||k==='.'||k==='PageDown') next=(st.sel+1)%n; else if(k==='ArrowLeft'||k==='ArrowUp'||k===','||k==='PageUp') next=(st.sel-1+n)%n; else if(k==='Home') next=0; else if(k==='End') next=n-1;
    if(next!==null){ st.sel=next; draw(); say(next); e.preventDefault(); return; }
    if((k==='Enter'||k===' ')&&hs&&hs.kind!=='obj'&&hs.kind!=='floor'&&opts.onOpen){ opts.onOpen(hs); e.preventDefault(); } });
  canvas.addEventListener('focus',function(){ if(st.sel<0&&st.hots.length){ st.sel=0; draw(); } say(st.sel); });
  canvas.addEventListener('blur',function(){ say(-1); });
  function set(house,linked){ st.items=place(house,opts.manifest||{}); if(linked) opts.linked=linked; st.sel=-1; st.hover=-1; placeAvatar(); draw(); }
  function setAvatar(a){ opts.avatar=a; placeAvatar(); if(a&&a.img) a.img.addEventListener('load',draw); draw(); }
  set(opts.house,opts.linked); if(opts.avatar&&opts.avatar.img) opts.avatar.img.addEventListener('load',draw);
  return {draw:draw,set:set,setAvatar:setAvatar,state:st,size:[W,H]}; }
/* the Lobby as a street (Dylan, 2026-09-10; Jennifer's brief, version 2): one house front per Kindred persona on a strip.
   houses: [{accent, name (never drawn), img (the Look, optional), show (the house is public)}]; returns hotspots with bboxes
   so the page can send a click to the persona page. Decorative on screen; the cards under it are the accessible path. */
function street(canvas,houses,opts){ var dpr=Math.max(1,Math.min(3,window.devicePixelRatio||1)); var n=Math.max(1,houses.length), HW=96, GAP=14, SW=Math.max(560,(opts&&opts.minWidth)||0,n*(HW+GAP)+GAP), SH=150;
  canvas.width=SW*dpr; canvas.height=SH*dpr; canvas.style.aspectRatio=SW+' / '+SH; var ctx=canvas.getContext('2d'); if(!ctx) return null; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.lineJoin='round';
  rect(ctx,0,0,SW,SH,mix(MAT.sky,PAPER,.55),null); rect(ctx,0,SH-26,SW,26,mix(MAT.stone,INK,.2),null); rect(ctx,0,SH-26,SW,3,mix(MAT.stone,PAPER,.3),null);
  var hots=[];
  houses.forEach(function(hs,i){ var x=GAP+i*(HW+GAP), acc=hs.accent||'#5B45E0', wt=tones(mix(PAPER,acc,.12)), rt=tones(mix(acc,INK,.4)), base=SH-26, top=base-74;
    rect(ctx,x,top,HW,74,wt.mid,wt.line); rect(ctx,x,top,HW,6,wt.light,null);
    ctx.beginPath(); ctx.moveTo(x-6,top); ctx.lineTo(x+HW/2,top-28); ctx.lineTo(x+HW+6,top); ctx.closePath(); ctx.fillStyle=rt.mid; ctx.fill(); ctx.strokeStyle=rt.line; ctx.lineWidth=1; ctx.stroke();
    rect(ctx,x+12,top+22,20,20,matTones('glass',acc).light,wt.line); rect(ctx,x+HW-32,top+22,20,20,matTones('glass',acc).light,wt.line);
    rect(ctx,x+HW/2-13,base-44,26,44,mix(acc,INK,.25),rt.line); ell(ctx,x+HW/2+8,base-22,2,2,PAPER,null);
    if(hs.img&&hs.img.complete&&hs.img.naturalWidth){ var ah=52, aw=ah*2/3; ctx.drawImage(hs.img,x+HW/2-aw/2,base-ah,aw,ah); }
    if(hs.show===false){ ctx.fillStyle='rgba(27,27,34,.35)'; ctx.fillRect(x-6,top-28,HW+12,102); }
    hots.push({i:i,bb:[x-6,top-28,x+HW+6,base]}); });
  return {hots:hots,size:[SW,SH],hit:function(px,py){ for(var k=0;k<hots.length;k++){ var b=hots[k].bb; if(px>=b[0]&&px<=b[2]&&py>=b[1]&&py<=b[3]) return k; } return -1; }}; }
window.pkScene={scene:scene,street:street,place:place,tones:tones,mix:mix,materials:MAT,drawSprite:sprite,drawHouse:drawHouse,floorOf:floorOf,COLS:COLS,FLOOR_KEYS:FLOOR_KEYS};
})();
