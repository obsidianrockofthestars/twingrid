/* Personakind, the isometric Home renderer (A3, 2026-09-10). Classic script, defines window.pkIso.
   One angle (2 to 1 dimetric, 64 by 32 tiles), one light (upper left), three tones per material plus an
   outline, palette tinted from the owner's accent (A1 style sheet, 2026-09-08). Sprites are lists of
   primitives from docs/catalog/sprites.json, never pixels and never URLs; the page hands this file catalog
   keys only. No user text is ever drawn here: labels go through the page's textContent path. */
(function(){
'use strict';
var TW=64, TH=32, UNIT=32, GRID=8, WALL=3;
var MAT={wood:'#8B5A2B',paper:'#EDEBF2',ink:'#2A2A36',leaf:'#3E8E5B',metal:'#8A8F98',glass:'#A7D8F0',cloth:'#C96A6A',stone:'#9A9AA6',brass:'#C9A227',sky:'#BFE3F5',sand:'#D9C7A0'};
var PAPER='#F7F7FA', INK='#1B1B22';
function rgb(h){ h=String(h||'').replace('#',''); if(!/^[0-9a-fA-F]{6}$/.test(h)) h='5B45E0'; return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function hex(c){ return '#'+c.map(function(v){ v=Math.max(0,Math.min(255,Math.round(v))); return (v<16?'0':'')+v.toString(16); }).join(''); }
function mix(a,b,t){ var x=rgb(a), y=rgb(b); return hex([x[0]+(y[0]-x[0])*t, x[1]+(y[1]-x[1])*t, x[2]+(y[2]-x[2])*t]); }
/* three tones plus outline from one mid colour: light blends toward paper, shadow toward ink, outline near ink (A1) */
function tones(mid){ return {light:mix(mid,PAPER,.38), mid:mid, shadow:mix(mid,INK,.38), line:mix(mid,INK,.72)}; }
function matTones(m,accent){ var mid=(m==='accent')?accent:(MAT[m]||MAT.stone); return tones(mid); }
function P(o,x,y,z){ return [o.ox+(x-y)*TW/2, o.oy+(x+y)*TH/2-(z||0)*UNIT]; }
function poly(ctx,pts,fill,line){ ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); for(var i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]); ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); if(line){ ctx.strokeStyle=line; ctx.lineWidth=1; ctx.stroke(); } }
function ell(ctx,cx,cy,rx,ry,fill,line){ ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fillStyle=fill; ctx.fill(); if(line){ ctx.strokeStyle=line; ctx.lineWidth=1; ctx.stroke(); } }
var RX=TW/2/Math.SQRT2, RY=TH/2/Math.SQRT2; /* a circle of radius 1 tile on the floor */
function box(ctx,o,p,t,bb){ var x=p.x,y=p.y,z=p.z||0,w=p.w,d=p.d,h=p.h;
  var a=P(o,x,y,z),b=P(o,x+w,y,z),c=P(o,x+w,y+d,z),e=P(o,x,y+d,z), a2=P(o,x,y,z+h),b2=P(o,x+w,y,z+h),c2=P(o,x+w,y+d,z+h),e2=P(o,x,y+d,z+h);
  poly(ctx,[e,c,c2,e2],t.mid,t.line); poly(ctx,[b,c,c2,b2],t.shadow,t.line); poly(ctx,[a2,b2,c2,e2],t.light,t.line);
  grow(bb,[a,b,c,e,a2,b2,c2,e2]); }
function cyl(ctx,o,p,t,bb){ var c=P(o,p.x,p.y,p.z||0), r=p.r, rx=r*RX, ry=r*RY, top=P(o,p.x,p.y,(p.z||0)+p.h);
  ctx.beginPath(); ctx.moveTo(c[0]-rx,c[1]); ctx.lineTo(c[0]-rx,top[1]); ctx.lineTo(c[0],top[1]); ctx.lineTo(c[0],c[1]); ctx.closePath(); ctx.fillStyle=t.mid; ctx.fill();
  ctx.beginPath(); ctx.moveTo(c[0],c[1]); ctx.lineTo(c[0],top[1]); ctx.lineTo(c[0]+rx,top[1]); ctx.lineTo(c[0]+rx,c[1]); ctx.closePath(); ctx.fillStyle=t.shadow; ctx.fill();
  ctx.beginPath(); ctx.ellipse(c[0],c[1],rx,ry,0,0,Math.PI); ctx.fillStyle=t.shadow; ctx.fill();
  ctx.beginPath(); ctx.moveTo(c[0]-rx,top[1]); ctx.lineTo(c[0]-rx,c[1]); ctx.ellipse(c[0],c[1],rx,ry,0,Math.PI,0,true); ctx.lineTo(c[0]+rx,top[1]); ctx.strokeStyle=t.line; ctx.lineWidth=1; ctx.stroke();
  ell(ctx,top[0],top[1],rx,ry,t.light,t.line);
  grow(bb,[[c[0]-rx,c[1]+ry],[c[0]+rx,top[1]-ry]]); }
function ball(ctx,o,p,t,bb){ var c=P(o,p.x,p.y,p.z||0), r=p.r*RX; ell(ctx,c[0],c[1],r,r,t.mid,t.line);
  ctx.save(); ctx.beginPath(); ctx.arc(c[0],c[1],r-.5,0,Math.PI*2); ctx.clip();
  ell(ctx,c[0]+r*.35,c[1]+r*.35,r*.95,r*.95,t.shadow,null); ell(ctx,c[0]-r*.05,c[1]-r*.05,r*.72,r*.72,t.mid,null); ell(ctx,c[0]-r*.4,c[1]-r*.4,r*.28,r*.22,t.light,null); ctx.restore();
  grow(bb,[[c[0]-r,c[1]-r],[c[0]+r,c[1]+r]]); }
function grow(bb,pts){ for(var i=0;i<pts.length;i++){ var q=pts[i]; if(q[0]<bb[0]) bb[0]=q[0]; if(q[1]<bb[1]) bb[1]=q[1]; if(q[0]>bb[2]) bb[2]=q[0]; if(q[1]>bb[3]) bb[3]=q[1]; } }
function partKey(p){ var cx=(p.t==='box')?p.x+p.w/2:p.x, cy=(p.t==='box')?p.y+p.d/2:p.y; return cx+cy+(p.z||0)*.25; }
/* draw one sprite with its footprint origin at tile (tx,ty); returns the screen bbox */
function sprite(ctx,o,sp,tx,ty,accent){ var bb=[1e9,1e9,-1e9,-1e9]; var parts=(sp.parts||[]).slice().sort(function(a,b){ return partKey(a)-partKey(b); });
  for(var i=0;i<parts.length;i++){ var p=parts[i], q={}; for(var k in p) q[k]=p[k]; q.x=(p.x||0)+tx; q.y=(p.y||0)+ty; var t=matTones(p.m,accent);
    if(p.t==='box') box(ctx,o,q,t,bb); else if(p.t==='cyl') cyl(ctx,o,q,t,bb); else if(p.t==='ball') ball(ctx,o,q,t,bb); }
  return bb; }
function diamond(ctx,o,x,y,w,d,z,fill,line,width){ var pts=[P(o,x,y,z),P(o,x+w,y,z),P(o,x+w,y+d,z),P(o,x,y+d,z)]; ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); for(var i=1;i<4;i++) ctx.lineTo(pts[i][0],pts[i][1]); ctx.closePath(); if(fill){ ctx.fillStyle=fill; ctx.fill(); } if(line){ ctx.strokeStyle=line; ctx.lineWidth=width||1; ctx.stroke(); } }
/* the room shell: floor tiles, two back walls (x = 0 and y = 0), a baseboard, one window on the y = 0 wall */
function room(ctx,o,rm,accent){ var f=matTones(rm.floor||'paper',accent), w=matTones(rm.wall||'paper',accent), tr=matTones(rm.trim||'wood',accent);
  var wl=tones(mix(w.mid,accent,.08));
  poly(ctx,[P(o,0,0,0),P(o,0,GRID,0),P(o,0,GRID,WALL),P(o,0,0,WALL)],wl.shadow,wl.line);
  poly(ctx,[P(o,0,0,0),P(o,GRID,0,0),P(o,GRID,0,WALL),P(o,0,0,WALL)],wl.mid,wl.line);
  poly(ctx,[P(o,0,0,0),P(o,0,GRID,0),P(o,0,GRID,.18),P(o,0,0,.18)],tr.shadow,tr.line);
  poly(ctx,[P(o,0,0,0),P(o,GRID,0,0),P(o,GRID,0,.18),P(o,0,0,.18)],tr.mid,tr.line);
  if(rm.window!==false){ var g=matTones('glass',accent); poly(ctx,[P(o,2.5,0,1.2),P(o,5.5,0,1.2),P(o,5.5,0,2.5),P(o,2.5,0,2.5)],g.light,tr.line); poly(ctx,[P(o,4,0,1.2),P(o,4.1,0,1.2),P(o,4.1,0,2.5),P(o,4,0,2.5)],tr.mid,null); }
  for(var x=0;x<GRID;x++) for(var y=0;y<GRID;y++) diamond(ctx,o,x,y,1,1,0,((x+y)%2)?f.mid:mix(f.mid,f.light,.35),mix(f.mid,f.shadow,.5),1); }
/* zones own regions of the floor; an object with a saved tile keeps it, the rest fill their region in order */
var REGION={thinking:[0,0,4,4],resting:[4,0,4,4],memory:[0,4,8,4]};
function fits(items,x,y,w,d){ if(x<0||y<0||x+w>GRID||y+d>GRID) return false; for(var i=0;i<items.length;i++){ var it=items[i]; if(it.x===undefined) continue; if(x<it.x+it.w&&it.x<x+w&&y<it.y+it.d&&it.y<y+d) return false; } return true; }
function place(house,man){ var by={}; (man.sprites||[]).forEach(function(s){ by[s.id]=s; }); var items=[]; var z=(house&&house.zones&&typeof house.zones==='object')?house.zones:{};
  ['thinking','resting','memory'].forEach(function(zk){ var list=Array.isArray(z[zk])?z[zk]:[]; list.forEach(function(it,i){ if(!it||typeof it!=='object') return; var sp=by[it.obj]; if(!sp) return;
    var w=sp.footprint?sp.footprint[0]:1, d=sp.footprint?sp.footprint[1]:1; var rec={zone:zk,idx:i,ref:it,id:it.obj,sp:sp,w:w,d:d};
    if(Number.isInteger(it.x)&&Number.isInteger(it.y)&&it.x>=0&&it.y>=0&&it.x+w<=GRID&&it.y+d<=GRID){ rec.x=it.x; rec.y=it.y; } items.push(rec); }); });
  items.forEach(function(rec){ if(rec.x!==undefined&&!fits(items.filter(function(q){ return q!==rec; }),rec.x,rec.y,rec.w,rec.d)){ rec.x=undefined; rec.y=undefined; } });
  items.forEach(function(rec){ if(rec.x!==undefined) return; var r=REGION[rec.zone]; var found=false;
    for(var yy=r[1]; yy<r[1]+r[3]&&!found; yy++) for(var xx=r[0]; xx<r[0]+r[2]&&!found; xx++) if(fits(items,xx,yy,rec.w,rec.d)){ rec.x=xx; rec.y=yy; found=true; }
    if(!found) for(var y2=0;y2<GRID&&!found;y2++) for(var x2=0;x2<GRID&&!found;x2++) if(fits(items,x2,y2,rec.w,rec.d)){ rec.x=x2; rec.y=y2; found=true; }
    if(!found){ rec.x=0; rec.y=0; } });
  return items; }
function toTile(o,px,py){ var sx=px-o.ox, sy=py-o.oy; return [(sx/(TW/2)+sy/(TH/2))/2, (sy/(TH/2)-sx/(TW/2))/2]; }
function sortKey(it){ return it.x+it.w/2+it.y+it.d/2; }
/* the scene: one canvas, hover, click, keyboard, optional drag.
   opts: {manifest, house, room, accent, editable, linked (Set of facet names), avatar:{img,x,y,h}, onOpen(item), onChange(item), label(item|null)} */
function scene(canvas,opts){ var W=560,H=380, o={ox:W/2, oy:WALL*UNIT+12}; var dpr=Math.max(1,Math.min(3,window.devicePixelRatio||1));
  canvas.width=W*dpr; canvas.height=H*dpr; var ctx=canvas.getContext('2d'); if(!ctx) return null;
  var st={items:[],sel:-1,hover:-1,drag:null};
  function rm(){ var rooms=(opts.manifest&&opts.manifest.rooms)||[]; for(var i=0;i<rooms.length;i++) if(rooms[i].key===opts.room) return rooms[i]; return rooms[0]||{}; }
  function draw(){ ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H); ctx.lineJoin='round';
    room(ctx,o,rm(),opts.accent); var items=st.items;
    var order=items.map(function(it,i){ return i; }).sort(function(a,b){ return sortKey(items[a])-sortKey(items[b]); });
    var av=opts.avatar, avKey=av?av.x+av.y+1:null, avDrawn=false;
    for(var k=0;k<=order.length;k++){ var it=k<order.length?items[order[k]]:null; var key=it?sortKey(it):1e9;
      if(av&&!avDrawn&&avKey<=key){ avDrawn=true; var fc=P(o,av.x+.5,av.y+.5,0), ah=av.h||60, aw=ah*2/3; if(av.img&&av.img.complete&&av.img.naturalWidth) ctx.drawImage(av.img,fc[0]-aw/2,fc[1]-ah+4,aw,ah); }
      if(!it) break;
      if(order[k]===st.sel||order[k]===st.hover) diamond(ctx,o,it.x,it.y,it.w,it.d,0,mix(opts.accent,PAPER,.55),opts.accent,2);
      it.bb=sprite(ctx,o,it.sp,it.x,it.y,opts.accent); } }
  function hit(px,py){ var order=st.items.map(function(it,i){ return i; }).sort(function(a,b){ return sortKey(st.items[b])-sortKey(st.items[a]); });
    for(var k=0;k<order.length;k++){ var bb=st.items[order[k]].bb; if(bb&&px>=bb[0]&&px<=bb[2]&&py>=bb[1]&&py<=bb[3]) return order[k]; } return -1; }
  function pos(e){ var r=canvas.getBoundingClientRect(); return [(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height]; }
  function say(i){ if(opts.label) opts.label(i>=0?st.items[i]:null); }
  function move(i,x,y){ var it=st.items[i]; if(!fits(st.items.filter(function(q){ return q!==it; }),x,y,it.w,it.d)) return false; it.x=x; it.y=y; it.ref.x=x; it.ref.y=y; draw(); if(opts.onChange) opts.onChange(it); return true; }
  canvas.addEventListener('pointermove',function(e){ var p=pos(e);
    if(st.drag){ var t=toTile(o,p[0],p[1]), it=st.items[st.drag.i]; var nx=Math.round(t[0]-st.drag.dx), ny=Math.round(t[1]-st.drag.dy); nx=Math.max(0,Math.min(GRID-it.w,nx)); ny=Math.max(0,Math.min(GRID-it.d,ny)); if(nx!==it.x||ny!==it.y) move(st.drag.i,nx,ny); return; }
    var h=hit(p[0],p[1]); if(h!==st.hover){ st.hover=h; canvas.style.cursor=h>=0?(opts.editable?'grab':(st.items[h].linked?'pointer':'default')):'default'; draw(); say(h>=0?h:st.sel); } });
  canvas.addEventListener('pointerleave',function(){ if(st.drag) return; st.hover=-1; draw(); say(st.sel); });
  canvas.addEventListener('pointerdown',function(e){ var p=pos(e), h=hit(p[0],p[1]); st.sel=h; draw(); say(h); try{ canvas.focus({preventScroll:true}); }catch(_){}
    if(h>=0&&opts.editable){ var t=toTile(o,p[0],p[1]); st.drag={i:h,dx:t[0]-st.items[h].x,dy:t[1]-st.items[h].y}; try{ canvas.setPointerCapture(e.pointerId); }catch(_){} canvas.style.cursor='grabbing'; e.preventDefault(); } });
  canvas.addEventListener('pointerup',function(e){ if(st.drag){ st.drag=null; canvas.style.cursor='grab'; try{ canvas.releasePointerCapture(e.pointerId); }catch(_){} return; }
    var p=pos(e), h=hit(p[0],p[1]); if(h>=0&&st.items[h].linked&&opts.onOpen) opts.onOpen(st.items[h]); });
  canvas.addEventListener('keydown',function(e){ var n=st.items.length; if(!n) return; var k=e.key;
    if(opts.editable&&st.sel>=0&&(k==='ArrowLeft'||k==='ArrowRight'||k==='ArrowUp'||k==='ArrowDown')){ var it=st.items[st.sel]; var nx=it.x+(k==='ArrowRight'?1:k==='ArrowLeft'?-1:0), ny=it.y+(k==='ArrowDown'?1:k==='ArrowUp'?-1:0);
      nx=Math.max(0,Math.min(GRID-it.w,nx)); ny=Math.max(0,Math.min(GRID-it.d,ny)); move(st.sel,nx,ny); say(st.sel); e.preventDefault(); return; }
    var next=null; if(k==='ArrowRight'||k==='ArrowDown'||k==='.'||k==='PageDown') next=(st.sel+1)%n; else if(k==='ArrowLeft'||k==='ArrowUp'||k===','||k==='PageUp') next=(st.sel-1+n)%n; else if(k==='Home') next=0; else if(k==='End') next=n-1;
    if(next!==null){ st.sel=next; draw(); say(next); e.preventDefault(); return; }
    if((k==='Enter'||k===' ')&&st.sel>=0){ if(st.items[st.sel].linked&&opts.onOpen) opts.onOpen(st.items[st.sel]); e.preventDefault(); } });
  canvas.addEventListener('focus',function(){ if(st.sel<0&&st.items.length){ st.sel=0; draw(); } say(st.sel); });
  canvas.addEventListener('blur',function(){ say(-1); });
  function set(house,linked){ st.items=place(house,opts.manifest||{}); st.items.forEach(function(it){ it.linked=!!(linked&&typeof it.ref.facet==='string'&&linked.has(it.ref.facet)); }); st.sel=-1; st.hover=-1; draw(); }
  function setAvatar(a){ opts.avatar=a; if(a&&a.img) a.img.addEventListener('load',draw); draw(); }
  set(opts.house,opts.linked); if(opts.avatar&&opts.avatar.img) opts.avatar.img.addEventListener('load',draw);
  return {draw:draw,set:set,setAvatar:setAvatar,state:st,size:[W,H]};
}
window.pkIso={scene:scene,place:place,tones:tones,mix:mix,materials:MAT,GRID:GRID,drawSprite:sprite,drawRoom:room,project:P,diamond:diamond};
})();
