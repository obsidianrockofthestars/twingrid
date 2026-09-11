/* Personakind, the avatar (A4, 2026-09-10). Classic script, defines window.pkAvatar. A flat, front-facing paper doll
   composed from docs/catalog/avatar.json: every choice is a catalog key, every colour is a catalog hex or a blend of
   one, every shape is a path from the catalog. Nothing an owner typed reaches this file. Jennifer's Step 2 and Step 3
   specs (2026-09-07) are the source: face, skin depth and undertone, hair, eyes, a layered wardrobe, adaptive items in
   the main lists, accessibility items never paid. Rendered client-side, no hosted compute. */
(function(){
'use strict';
var PAPER='#F7F7FA', INK='#1B1B22', WHITE='#FFFFFF', METAL='#8A8F98', WOOD='#8B5A2B';
function rgb(h){ h=String(h||'').replace('#',''); if(!/^[0-9a-fA-F]{6}$/.test(h)) h='888888'; return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function hex(c){ return '#'+c.map(function(v){ v=Math.max(0,Math.min(255,Math.round(v))); return (v<16?'0':'')+v.toString(16); }).join(''); }
function mix(a,b,t){ var x=rgb(a), y=rgb(b); return hex([x[0]+(y[0]-x[0])*t, x[1]+(y[1]-x[1])*t, x[2]+(y[2]-x[2])*t]); }
function find(list,key){ list=Array.isArray(list)?list:[]; for(var i=0;i<list.length;i++) if(list[i]&&list[i].key===key) return list[i]; return null; }
function first(list){ return (Array.isArray(list)&&list.length)?list[0]:null; }
var D_RE=/^[MLCQAZmlcqaz0-9 .,-]+$/;
function path(p,slots,outline){ if(!p||typeof p.d!=='string'||!D_RE.test(p.d)) return ''; var f=slots[p.f]||INK; var edge=(p.f==='c1'||p.f==='skin'||p.f==='hair'||p.f==='white'||p.f==='metal'||p.f==='wood'||p.f==='ink');
  return '<path d="'+p.d+'" fill="'+f+'"'+(edge&&outline?' stroke="'+outline+'" stroke-width=".7" stroke-linejoin="round"':'')+'/>'; }
function group(list,slots,outline){ list=Array.isArray(list)?list:[]; var out=''; for(var i=0;i<list.length;i++) out+=path(list[i],slots,outline); return out; }
/* the default avatar: the first key of every list, a middle skin depth, a neutral undertone */
function defaults(cat){ var f=function(l){ var x=first(cat[l]); return x?x.key:''; };
  return {body:'standing',height:'mid',face:f('faces'),skin:{depth:'d4',undertone:'neutral'},hair:{style:'short',color:'brown'},facialHair:'none',eyes:'brown',
    look:{top:f('tops'),bottom:f('bottoms'),onePiece:'',outer:'none',shoes:f('shoes'),head:'none',accessories:[],colors:{top:'violet',bottom:'navy',onePiece:'violet',outer:'grey',shoes:'black',head:'grey'},fit:{}}}; }
/* normalise: every key is checked against the catalog; an unknown key falls back to the default, extra keys are dropped */
function norm(av,cat){ var d=defaults(cat); av=(av&&typeof av==='object')?av:{}; var look=(av.look&&typeof av.look==='object')?av.look:{}; var col=(look.colors&&typeof look.colors==='object')?look.colors:{}; var fit=(look.fit&&typeof look.fit==='object')?look.fit:{};
  var k=function(list,v,dflt){ return find(cat[list],v)?v:dflt; };
  var out={body:k('bodies',av.body,d.body),height:k('heights',av.height,d.height),face:k('faces',av.face,d.face),
    skin:{depth:k('skinDepths',av.skin&&av.skin.depth,d.skin.depth),undertone:k('undertones',av.skin&&av.skin.undertone,d.skin.undertone)},
    hair:{style:k('hairs',av.hair&&av.hair.style,d.hair.style),color:k('hairColors',av.hair&&av.hair.color,d.hair.color)},
    facialHair:k('facialHairs',av.facialHair,d.facialHair),eyes:k('eyes',av.eyes,d.eyes),
    look:{top:k('tops',look.top,d.look.top),bottom:k('bottoms',look.bottom,d.look.bottom),onePiece:find(cat.onePieces,look.onePiece)?look.onePiece:'',outer:k('outers',look.outer,d.look.outer),shoes:k('shoes',look.shoes,d.look.shoes),head:k('heads',look.head,d.look.head),
      accessories:(Array.isArray(look.accessories)?look.accessories:[]).filter(function(a){ return !!find(cat.accessories,a); }).slice(0,4),
      colors:{top:k('colors',col.top,d.look.colors.top),bottom:k('colors',col.bottom,d.look.colors.bottom),onePiece:k('colors',col.onePiece,d.look.colors.onePiece),outer:k('colors',col.outer,d.look.colors.outer),shoes:k('colors',col.shoes,d.look.colors.shoes),head:k('colors',col.head,d.look.colors.head)},
      fit:{}}};
  ['seatedCut','sideOpening','easyClosures','prostheticAccess','braceRoom','sensoryFriendly'].forEach(function(f){ if(fit[f]===true) out.look.fit[f]=true; });
  return out; }
function garment(hexv){ return {c1:hexv,c2:mix(hexv,INK,.35),c3:mix(hexv,PAPER,.35)}; }
/* the SVG: hair back first, then body, bottoms or one piece, shoes, top, outer, face, eyes, facial hair, hair front, headwear, accessories */
function svg(av,cat,size){ if(!cat) return ''; av=norm(av,cat); var body=find(cat.bodies,av.body), pose=body&&body.pose==='sit'?'sit':'stand';
  var skinHex=mix(find(cat.skinDepths,av.skin.depth).hex, find(cat.undertones,av.skin.undertone).shift||'#D9D0C8', .15); var hairHex=find(cat.hairColors,av.hair.color).hex;
  var base={skin:skinHex,skin2:mix(skinHex,INK,.3),hair:hairHex,hair2:mix(hairHex,INK,.35),ink:INK,white:WHITE,metal:METAL,wood:WOOD};
  var col=function(k){ var c=find(cat.colors,av.look.colors[k]); var g=garment(c?c.hex:'#888888'); for(var q in base) g[q]=base[q]; return g; };
  var out=''; var hair=find(cat.hairs,av.hair.style)||{};
  out+=group(hair.back,base,null);
  out+=group(body&&body.parts,base,INK);
  if(av.look.onePiece){ var op=find(cat.onePieces,av.look.onePiece); out+=group(op&&op[pose],col('onePiece'),INK); }
  else { var bt=find(cat.bottoms,av.look.bottom); out+=group(bt&&bt[pose],col('bottom'),INK); }
  var sh=find(cat.shoes,av.look.shoes); out+=group(sh&&sh[pose],col('shoes'),INK);
  if(!av.look.onePiece){ var tp=find(cat.tops,av.look.top); out+=group(tp&&tp.parts,col('top'),INK); }
  var ou=find(cat.outers,av.look.outer); if(ou&&av.look.outer!=='none') out+=group(ou.parts,col('outer'),INK);
  var face=find(cat.faces,av.face); if(face&&typeof face.d==='string'&&D_RE.test(face.d)) out+='<path d="'+face.d+'" fill="'+skinHex+'" stroke="'+INK+'" stroke-width=".7"/>';
  var eye=find(cat.eyes,av.eyes); var eh=eye?eye.hex:'#5A3A25';
  out+='<ellipse cx="27.5" cy="19.5" rx="2.6" ry="2" fill="'+WHITE+'"/><ellipse cx="36.5" cy="19.5" rx="2.6" ry="2" fill="'+WHITE+'"/><circle cx="27.8" cy="19.6" r="1.6" fill="'+eh+'"/><circle cx="36.8" cy="19.6" r="1.6" fill="'+eh+'"/><circle cx="28" cy="19.6" r=".7" fill="'+INK+'"/><circle cx="37" cy="19.6" r=".7" fill="'+INK+'"/>';
  out+='<path d="M 24.5 15.5 Q 27.5 14 30.5 15.2" fill="none" stroke="'+base.hair2+'" stroke-width="1" stroke-linecap="round"/><path d="M 33.5 15.2 Q 36.5 14 39.5 15.5" fill="none" stroke="'+base.hair2+'" stroke-width="1" stroke-linecap="round"/><path d="M 29.5 25.5 Q 32 27.5 34.5 25.5" fill="none" stroke="'+INK+'" stroke-width=".8" stroke-linecap="round"/>';
  var fh=find(cat.facialHairs,av.facialHair); if(fh&&av.facialHair!=='none') out+=group(fh.parts,base,null);
  out+=group(hair.front,base,null);
  var hd=find(cat.heads,av.look.head); if(hd&&av.look.head!=='none') out+=group(hd.parts,col('head'),INK);
  var acc={c1:'#3A3A48',c2:'#26262F',c3:'#5A5A6C'}; for(var q in base) acc[q]=base[q];
  av.look.accessories.forEach(function(a){ var x=find(cat.accessories,a); if(x) out+=group(x.parts,acc,null); });
  var ht=find(cat.heights,av.height); var sc=(ht&&typeof ht.scale==='number')?Math.max(.8,Math.min(1.15,ht.scale)):1;
  var w=size||64, h=Math.round(w*1.5);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96" width="'+w+'" height="'+h+'" role="img" aria-hidden="true"><g transform="translate(32 94) scale('+sc+') translate(-32 -94)">'+out+'</g></svg>'; }
function img(svgText){ var im=new Image(); im.decoding='async'; im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgText); return im; }
window.pkAvatar={svg:svg,img:img,norm:norm,defaults:defaults,find:find};
})();
