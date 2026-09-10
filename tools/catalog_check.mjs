// Validates objects.json against the personakind catalog contract.
// No dependencies. Run: node catalog_check.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const problems = [];

let raw, data;
try {
  raw = readFileSync(join(dir, '..', 'docs', 'catalog', 'objects.json'), 'utf8');
} catch (e) {
  console.log('FAILED TO READ objects.json:', e.message);
  process.exit(1);
}
try {
  data = JSON.parse(raw);
} catch (e) {
  console.log('objects.json is not valid JSON:', e.message);
  process.exit(1);
}

const EXPECTED_MOOD_KEYS = ['calm', 'curious', 'focused', 'playful', 'tired', 'fired-up', 'quiet', 'celebrating'];
const EXPECTED_ROOM_KEYS = ['studio', 'library', 'workshop', 'porch', 'observatory', 'kitchen', 'garden', 'office'];
const EXPECTED_ZONE_KEYS = ['thinking', 'resting', 'memory', 'social'];
const ID_RE = /^[a-z][a-z0-9-]{1,30}$/;
const DASH_RE = /[–—-]/; // en dash, em dash, ascii hyphen

const SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const SVG_CLOSE = '</svg>';
const ALLOWED_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'ellipse', 'polyline', 'polygon']);
const ALLOWED_ATTRS = new Set([
  'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'aria-hidden',
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'points', 'opacity',
]);
const FORBIDDEN_SUBSTRINGS = ['<script', 'href', 'url(', '<style', '<text', '<image', '<use'];
const ACCENT_FILL = 'fill="var(--pk-obj-accent, currentColor)"';

function fail(msg) {
  problems.push(msg);
}

// --- top-level shape ---
if (data.version !== 1) fail(`version must be 1, got ${JSON.stringify(data.version)}`);
if (!Array.isArray(data.moods)) fail('moods must be an array');
if (!Array.isArray(data.rooms)) fail('rooms must be an array');
if (typeof data.zones !== 'object' || data.zones === null || Array.isArray(data.zones)) fail('zones must be an object');
if (!Array.isArray(data.objects)) fail('objects must be an array');

// --- moods ---
if (Array.isArray(data.moods)) {
  const keys = data.moods.map((m) => m && m.key);
  if (JSON.stringify(keys) !== JSON.stringify(EXPECTED_MOOD_KEYS)) {
    fail(`moods keys mismatch. expected ${JSON.stringify(EXPECTED_MOOD_KEYS)}, got ${JSON.stringify(keys)}`);
  }
  for (const m of data.moods) {
    if (!m || typeof m.key !== 'string' || typeof m.label !== 'string') {
      fail(`mood entry malformed: ${JSON.stringify(m)}`);
    } else if (DASH_RE.test(m.label)) {
      fail(`mood label "${m.label}" contains a dash`);
    }
  }
}

// --- rooms ---
if (Array.isArray(data.rooms)) {
  const keys = data.rooms.map((r) => r && r.key);
  if (JSON.stringify(keys) !== JSON.stringify(EXPECTED_ROOM_KEYS)) {
    fail(`rooms keys mismatch. expected ${JSON.stringify(EXPECTED_ROOM_KEYS)}, got ${JSON.stringify(keys)}`);
  }
  for (const r of data.rooms) {
    if (!r || typeof r.key !== 'string' || typeof r.label !== 'string') {
      fail(`room entry malformed: ${JSON.stringify(r)}`);
    } else if (DASH_RE.test(r.label)) {
      fail(`room label "${r.label}" contains a dash`);
    }
  }
}

// --- zones ---
if (data.zones && typeof data.zones === 'object') {
  const zoneKeys = Object.keys(data.zones);
  const missing = EXPECTED_ZONE_KEYS.filter((k) => !zoneKeys.includes(k));
  const extra = zoneKeys.filter((k) => !EXPECTED_ZONE_KEYS.includes(k));
  if (missing.length) fail(`zones missing keys: ${missing.join(', ')}`);
  if (extra.length) fail(`zones has unexpected keys: ${extra.join(', ')}`);
  for (const k of EXPECTED_ZONE_KEYS) {
    const z = data.zones[k];
    if (!z) continue;
    if (typeof z.label !== 'string' || typeof z.blurb !== 'string') {
      fail(`zone "${k}" missing label or blurb string`);
      continue;
    }
    if (z.blurb.length >= 90) fail(`zone "${k}" blurb is ${z.blurb.length} chars, must be under 90`);
    if (DASH_RE.test(z.blurb)) fail(`zone "${k}" blurb contains a dash`);
    if (DASH_RE.test(z.label)) fail(`zone "${k}" label contains a dash`);
  }
}

// --- objects ---
if (Array.isArray(data.objects)) {
  if (data.objects.length !== 40) {
    fail(`expected exactly 40 objects, got ${data.objects.length}`);
  }

  const counts = { thinking: 0, resting: 0, memory: 0, social: 0 };
  const seenIds = new Set();

  for (const [i, obj] of data.objects.entries()) {
    const where = `objects[${i}]${obj && obj.id ? ` (${obj.id})` : ''}`;
    if (!obj || typeof obj !== 'object') {
      fail(`${where} is not an object`);
      continue;
    }
    const { id, zone, label, svg } = obj;

    if (typeof id !== 'string' || !ID_RE.test(id)) {
      fail(`${where} id "${id}" fails regex ${ID_RE}`);
    } else if (seenIds.has(id)) {
      fail(`duplicate object id "${id}"`);
    } else {
      seenIds.add(id);
    }

    if (!EXPECTED_ZONE_KEYS.includes(zone) || zone === 'social') {
      fail(`${where} has invalid zone "${zone}" (must be thinking, resting, or memory)`);
    } else if (Object.prototype.hasOwnProperty.call(counts, zone)) {
      counts[zone]++;
    }

    if (typeof label !== 'string') {
      fail(`${where} label is not a string`);
    } else {
      if (label.length > 24) fail(`${where} label "${label}" is ${label.length} chars, max 24`);
      if (DASH_RE.test(label)) fail(`${where} label "${label}" contains a dash`);
    }

    if (typeof svg !== 'string') {
      fail(`${where} svg is not a string`);
      continue;
    }
    validateSvg(where, svg);
  }

  if (counts.thinking !== 14) fail(`thinking zone has ${counts.thinking} objects, expected 14`);
  if (counts.resting !== 12) fail(`resting zone has ${counts.resting} objects, expected 12`);
  if (counts.memory !== 14) fail(`memory zone has ${counts.memory} objects, expected 14`);
  if (counts.social !== 0) fail(`social zone has ${counts.social} objects, expected 0`);
}

function validateSvg(where, svg) {
  if (!svg.startsWith(SVG_OPEN)) {
    fail(`${where} svg does not start with the exact required opening tag`);
  }
  if (!svg.endsWith(SVG_CLOSE)) {
    fail(`${where} svg does not end with ${SVG_CLOSE}`);
  }

  for (const bad of FORBIDDEN_SUBSTRINGS) {
    if (svg.includes(bad)) fail(`${where} svg contains forbidden substring "${bad}"`);
  }

  // Reject any "on*" event-handler attribute anywhere (case-insensitive attr name starting with "on").
  if (/\son[a-z]+\s*=/i.test(svg)) {
    fail(`${where} svg contains an on* event attribute`);
  }

  // Parse every tag (opening tags with attrs, and self-closing forms). This regex finds tag names.
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  let m;
  let accentFillCount = 0;
  while ((m = tagRe.exec(svg)) !== null) {
    const tagName = m[1];
    const attrsBlob = m[2];
    if (!ALLOWED_TAGS.has(tagName)) {
      fail(`${where} svg has disallowed element <${tagName}>`);
      continue;
    }
    // extract attribute names
    const attrRe = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*=\s*"([^"]*)"/g;
    let am;
    while ((am = attrRe.exec(attrsBlob)) !== null) {
      const attrName = am[1];
      const attrValue = am[2];
      if (!ALLOWED_ATTRS.has(attrName)) {
        fail(`${where} svg has disallowed attribute "${attrName}" on <${tagName}>`);
      }
      if (attrName === 'fill' && attrValue !== 'none') {
        if (attrValue === 'var(--pk-obj-accent, currentColor)') {
          accentFillCount++;
        } else {
          fail(`${where} svg has a fill value that is neither "none" nor the exact accent value: "${attrValue}"`);
        }
      }
    }
  }
  if (accentFillCount > 1) {
    fail(`${where} svg has ${accentFillCount} accent-fill elements, at most 1 allowed`);
  }

  // child element count (exclude the outer svg tag itself)
  const childOpenTags = (svg.match(/<(?!\/)(?!svg\b)[a-zA-Z][a-zA-Z0-9]*\b/g) || []).length;
  if (childOpenTags > 6) {
    fail(`${where} svg has ${childOpenTags} child elements, max 6`);
  }
}

if (problems.length) {
  console.log(`CATALOG CHECK FAILED (${problems.length} problem(s)):`);
  for (const p of problems) console.log(' - ' + p);
  process.exit(1);
} else {
  // The SQL validator embeds the same lists (sql/2026-09-07_home.sql). Every key must appear there, quoted.
{
  let sql = '';
  try { sql = readFileSync(join(dir, '..', 'sql', '2026-09-07_home.sql'), 'utf8'); } catch (e) { problems.push('cannot read sql/2026-09-07_home.sql: ' + e.message); }
  if (sql) {
    for (const o of (data && data.objects) || []) if (!sql.includes('"' + o.id + '"')) problems.push('object id missing from the SQL validator: ' + o.id);
    for (const m of (data && data.moods) || []) if (!sql.includes("'" + m.key + "'")) problems.push('mood missing from the SQL validator: ' + m.key);
    for (const r of (data && data.rooms) || []) if (!sql.includes("'" + r.key + "'")) problems.push('room missing from the SQL validator: ' + r.key);
  }
  if (problems.length) { for (const p of problems) console.log('PROBLEM: ' + p); process.exit(1); }
}
// The sprite manifest (A2, 2026-09-10): every catalog id has one row of primitives that docs/iso.js draws; the material
// keys are read off iso.js itself so the two files cannot drift. Rules: footprint 1 or 2 tiles a side, parts inside the
// footprint and under the height, 1 to 12 parts, table objects 1 by 1 and at most 1 high, an accent-tinted sprite carries
// one or two accent parts and an untinted one none, eight room shells in the catalog's room order.
{
  let man = null, iso = '';
  try { man = JSON.parse(readFileSync(join(dir, '..', 'docs', 'catalog', 'sprites.json'), 'utf8')); } catch (e) { problems.push('sprites.json: ' + e.message); }
  try { iso = readFileSync(join(dir, '..', 'docs', 'iso.js'), 'utf8'); } catch (e) { problems.push('docs/iso.js: ' + e.message); }
  const mats = new Set(['accent']); const mm = /var MAT=\{([^}]*)\}/.exec(iso); if (mm) for (const k of mm[1].split(',')) mats.add(k.split(':')[0].trim()); else problems.push('iso.js: MAT table not found');
  if (man) {
    if (man.version !== 1) problems.push('sprites.json version must be 1');
    if (JSON.stringify(man.tile) !== '[64,32]' || man.unit !== 32) problems.push('sprites.json tile must be [64,32] and unit 32');
    if (typeof man.source !== 'string' || typeof man.license !== 'string') problems.push('sprites.json needs source and license strings');
    const rooms = Array.isArray(man.rooms) ? man.rooms : []; const rk = rooms.map((r) => r && r.key);
    if (JSON.stringify(rk) !== JSON.stringify(EXPECTED_ROOM_KEYS)) problems.push('sprites.json rooms must be ' + JSON.stringify(EXPECTED_ROOM_KEYS) + ', got ' + JSON.stringify(rk));
    for (const r of rooms) { if (!r) continue; for (const f of ['floor', 'wall', 'trim']) if (!mats.has(r[f]) || r[f] === 'accent') problems.push('room ' + r.key + ' ' + f + ' is not a material: ' + r[f]);
      if (typeof r.window !== 'boolean') problems.push('room ' + r.key + ' window must be boolean');
      if (typeof r.note !== 'string' || r.note.length >= 60 || DASH_RE.test(r.note)) problems.push('room ' + r.key + ' note must be a short string with no dash'); }
    const sprites = Array.isArray(man.sprites) ? man.sprites : []; const ids = new Set((data && data.objects || []).map((o) => o.id)); const seen = new Set();
    for (const sp of sprites) { const w = 'sprite ' + (sp && sp.id);
      if (!sp || !ids.has(sp.id)) { problems.push(w + ' is not a catalog id'); continue; }
      if (seen.has(sp.id)) problems.push(w + ' is listed twice'); seen.add(sp.id);
      const fp = sp.footprint; if (!Array.isArray(fp) || fp.length !== 2 || !fp.every((n) => Number.isInteger(n) && n >= 1 && n <= 2)) problems.push(w + ' footprint must be two integers 1 to 2');
      if (typeof sp.height !== 'number' || sp.height <= 0 || sp.height > 2) problems.push(w + ' height must be a number in (0, 2]');
      if (sp.anchor !== 'front') problems.push(w + ' anchor must be front');
      if (!['floor', 'wall', 'table', 'hanging'].includes(sp.layer)) problems.push(w + ' layer is not floor, wall, table or hanging');
      if (sp.tint !== null && sp.tint !== 'accent') problems.push(w + ' tint must be null or accent');
      if (sp.layer === 'table' && (JSON.stringify(fp) !== '[1,1]' || sp.height > 1)) problems.push(w + ' is a table object and must be 1 by 1 and at most 1 high');
      const parts = Array.isArray(sp.parts) ? sp.parts : []; if (parts.length < 1 || parts.length > 12) problems.push(w + ' must have 1 to 12 parts');
      let acc = 0; const W = fp && fp[0], D = fp && fp[1];
      for (const p of parts) { if (!p || !['box', 'cyl', 'ball'].includes(p.t)) { problems.push(w + ' has a part that is not box, cyl or ball'); continue; }
        if (!mats.has(p.m)) problems.push(w + ' part uses unknown material ' + p.m); if (p.m === 'accent') acc++;
        const num = (k) => typeof p[k] === 'number' && isFinite(p[k]); const z = p.z || 0;
        if (p.t === 'box') { if (!['x', 'y', 'w', 'd', 'h'].every(num) || p.x < 0 || p.y < 0 || p.w <= 0 || p.d <= 0 || p.h <= 0 || p.x + p.w > W + 1e-9 || p.y + p.d > D + 1e-9 || z + p.h > sp.height + 1e-9) problems.push(w + ' box part leaves the footprint or the height'); }
        else if (p.t === 'cyl') { if (!['x', 'y', 'r', 'h'].every(num) || p.r <= 0 || p.h <= 0 || p.x - p.r < -1e-9 || p.y - p.r < -1e-9 || p.x + p.r > W + 1e-9 || p.y + p.r > D + 1e-9 || z + p.h > sp.height + 1e-9) problems.push(w + ' cyl part leaves the footprint or the height'); }
        else { if (!['x', 'y', 'r'].every(num) || p.r <= 0 || p.x - p.r < -1e-9 || p.y - p.r < -1e-9 || p.x + p.r > W + 1e-9 || p.y + p.r > D + 1e-9 || z + p.r > sp.height + 1e-9 || z - p.r < -1e-9) problems.push(w + ' ball part leaves the footprint or the height'); } }
      if (sp.tint === 'accent' && (acc < 1 || acc > 2)) problems.push(w + ' is accent tinted and must carry 1 or 2 accent parts, has ' + acc);
      if (sp.tint === null && acc) problems.push(w + ' is untinted and carries an accent part'); }
    for (const id of ids) if (!seen.has(id)) problems.push('catalog id has no sprite row: ' + id);
  }
  if (problems.length) { for (const p of problems) console.log('PROBLEM: ' + p); process.exit(1); }
  console.log('SPRITES OK ' + man.sprites.length + ' sprites, ' + man.rooms.length + ' rooms');
}
console.log('CATALOG OK 40 objects');
  process.exit(0);
}
