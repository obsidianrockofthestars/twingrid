// Runs the page module's TOP LEVEL under a stubbed DOM and prints TOP-LEVEL OK.
// Why: node --check is syntax only. On 2026-09-03 a first-paint call placed above the const it read
// passed node --check and blanked the live site for 21 minutes. This catches that class: any throw
// while the module body executes (TDZ, missing const, typo in a top-level call) exits non-zero.
// No dependencies on purpose. Usage: node tools/run_stub.mjs docs/index.html
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const file = process.argv[2] || "docs/index.html";
const html = readFileSync(file, "utf8");
const m = /<script type="module">([\s\S]*?)<\/script>/.exec(html);
if (!m) { console.error("no <script type=\"module\"> in " + file); process.exit(2); }
let mod = m[1];

// The two esm.sh imports cannot load in node; swap them for local stubs with the same names.
mod = mod.replace(/^\s*import \{ createClient \} from 'https:\/\/esm\.sh\/[^']+';.*$/m, "const createClient = globalThis.__stubCreateClient;");
mod = mod.replace(/^\s*import \{ Purchases, ErrorCode, PurchasesError \} from 'https:\/\/esm\.sh\/[^']+';.*$/m,
  "const Purchases = globalThis.__stubPurchases, ErrorCode = {}, PurchasesError = class extends Error {};");
if (/^\s*import /m.test(mod)) { console.error("unstubbed import in the module: " + /^\s*import .*$/m.exec(mod)[0]); process.exit(2); }

// JSON data islands the module parses at boot (showdata, blankdata): serve their real text.
const islands = {};
for (const mm of html.matchAll(/<script type="application\/json" id="([^"]+)">([\s\S]*?)<\/script>/g)) islands[mm[1]] = mm[2];

// A permissive element: strings read as '', booleans as false, numbers as 0, everything else is a callable stub.
const STR = new Set(["textContent", "innerHTML", "innerText", "value", "id", "className", "placeholder", "title", "href", "src", "tagName", "nodeName", "type", "name", "lang", "dir"]);
const BOOL = new Set(["hidden", "checked", "disabled", "open", "readOnly", "required", "isConnected", "paused", "ended", "muted"]);
const NUM = new Set(["offsetWidth", "offsetHeight", "clientWidth", "clientHeight", "scrollTop", "scrollLeft", "scrollWidth", "scrollHeight", "offsetTop", "offsetLeft", "length", "tabIndex", "selectionStart", "selectionEnd", "duration", "currentTime", "volume", "naturalWidth", "naturalHeight", "width", "height", "childElementCount"]);
const ARR = new Set(["children", "childNodes", "options", "files", "attributes", "labels"]);
const REL = new Set(["parentElement", "parentNode", "firstElementChild", "lastElementChild", "nextElementSibling", "previousElementSibling", "firstChild", "lastChild", "ownerDocument"]);
function el(tag, id) {
  const own = { tagName: String(tag || "div").toUpperCase(), id: id || "", dataset: {}, style: styleStub(),
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; }, replace() {} },
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
    getContext: () => null, querySelectorAll: () => [], getElementsByTagName: () => [], getElementsByClassName: () => [],
    querySelector: () => el("div"), closest: () => null, contains: () => false, matches: () => false,
    getAttribute: () => null, hasAttribute: () => false, cloneNode: () => el(tag),
    appendChild: (c) => c, insertBefore: (c) => c, removeChild: (c) => c, replaceChild: (c) => c,
    play: () => Promise.resolve(), select() {}, then: undefined };
  if (id && islands[id] != null) own.textContent = islands[id];
  return new Proxy(own, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k !== "string") return undefined;
      if (STR.has(k)) return "";
      if (BOOL.has(k)) return false;
      if (NUM.has(k)) return 0;
      if (ARR.has(k)) return [];
      if (REL.has(k)) return el("div");
      const f = function () { return el("div"); }; t[k] = f; return f;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function styleStub() { return new Proxy({ setProperty() {}, removeProperty() {}, getPropertyValue: () => "" }, { get(t, k) { return k in t ? t[k] : ""; }, set(t, k, v) { t[k] = v; return true; } }); }
const storage = () => { const s = new Map(); return { getItem: (k) => (s.has(k) ? s.get(k) : null), setItem: (k, v) => s.set(k, String(v)), removeItem: (k) => s.delete(k), clear: () => s.clear(), key: () => null, get length() { return s.size; } }; };

const location = new URL("https://personakind.com/");
const document = el("html");
Object.assign(document, {
  getElementById: (id) => el("div", id), createElement: (t) => el(t), createElementNS: (_n, t) => el(t), createTextNode: (s) => ({ textContent: String(s), nodeType: 3 }),
  createDocumentFragment: () => el("fragment"), body: el("body"), documentElement: el("html"), head: el("head"), title: "", cookie: "", readyState: "complete",
  activeElement: el("body"), visibilityState: "visible", hidden: false, fonts: { ready: Promise.resolve(), load: () => Promise.resolve([]) },
  execCommand: () => false, hasFocus: () => true, elementFromPoint: () => null, getSelection: () => ({ removeAllRanges() {}, addRange() {}, toString: () => "" }),
});
const win = {
  document, location, localStorage: storage(), sessionStorage: storage(), innerWidth: 1100, innerHeight: 740, devicePixelRatio: 1, scrollY: 0, scrollX: 0,
  history: { pushState() {}, replaceState() {}, back() {}, state: null, length: 1 },
  navigator: { clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.resolve("") }, userAgent: "node-stub", language: "en-US", languages: ["en-US"], onLine: true, maxTouchPoints: 0, platform: "node", vibrate() {} },
  matchMedia: () => ({ matches: false, media: "", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  requestAnimationFrame: (f) => setTimeout(() => f(0), 0), cancelAnimationFrame: (h) => clearTimeout(h), requestIdleCallback: (f) => setTimeout(() => f({ didTimeout: false, timeRemaining: () => 1 }), 0),
  getComputedStyle: () => styleStub(), scrollTo() {}, scroll() {}, scrollBy() {}, alert() {}, confirm: () => false, prompt: () => null, open: () => null, print() {}, focus() {}, blur() {}, close() {},
  addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true, postMessage() {}, screen: { width: 1100, height: 740 }, visualViewport: { width: 1100, height: 740, addEventListener() {}, removeEventListener() {} },
  speechSynthesis: { speak() {}, cancel() {}, getVoices: () => [], addEventListener() {}, onvoiceschanged: null, speaking: false },
  SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
  Audio: class { constructor() { this.play = () => Promise.resolve(); this.pause = () => {}; this.addEventListener = () => {}; } },
  Image: class { constructor() { this.addEventListener = () => {}; } }, FileReader: class { readAsDataURL() {} readAsText() {} addEventListener() {} },
  ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} }, MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
  AudioContext: class { constructor() { this.state = "suspended"; this.destination = {}; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } createBufferSource() { return { connect() {}, start() {}, stop() {}, addEventListener() {} }; } decodeAudioData() { return Promise.resolve({}); } },
  fetch: async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
  CSS: { supports: () => false, escape: (s) => String(s) }, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } }, Event: class { constructor(t) { this.type = t; } },
  HTMLElement: class {}, Element: class {}, Node: class {}, DOMParser: class { parseFromString() { return document; } }, XMLSerializer: class { serializeToString() { return ""; } },
  onerror: null, onunhandledrejection: null, name: "",
};
const window = new Proxy(win, {
  get(t, k) { if (k in t) return t[k]; if (k in globalThis) return globalThis[k]; if (typeof k === "string" && /^on/.test(k)) return null; return undefined; },
  set(t, k, v) { t[k] = v; return true; },
  has(t, k) { return k in t || k in globalThis; },
});
for (const k of Object.keys(win)) { if (!(k in globalThis) || k === "fetch") { try { Object.defineProperty(globalThis, k, { value: win[k], writable: true, configurable: true }); } catch (_) {} } }
globalThis.window = window; globalThis.self = window; globalThis.document = document; globalThis.location = location;

// Supabase client stub: every query chain is thenable and resolves empty; auth has no session.
const chain = () => new Proxy(function () {}, {
  get(_t, k) { if (k === "then") return (res) => res({ data: [], error: null, count: 0 }); if (k === "catch" || k === "finally") return () => chain(); return () => chain(); },
  apply() { return chain(); },
});
globalThis.__stubCreateClient = () => ({
  from: () => chain(), rpc: async () => ({ data: null, error: null }), functions: { invoke: async () => ({ data: null, error: null }) },
  storage: { from: () => ({ upload: async () => ({ data: null, error: null }), remove: async () => ({ data: null, error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  channel: () => ({ on() { return this; }, subscribe() { return this; }, unsubscribe() {} }), removeChannel() {},
  auth: { getSession: async () => ({ data: { session: null }, error: null }), getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({ error: null }), signInWithOtp: async () => ({ error: null }),
    signInWithOAuth: async () => ({ error: null }), signInWithPassword: async () => ({ error: null }), updateUser: async () => ({ error: null }), exchangeCodeForSession: async () => ({ error: null }) },
});
globalThis.__stubPurchases = { configure: () => ({}), isConfigured: () => false, getSharedInstance: () => ({}), setLogLevel() {}, generateRevenueCatAnonymousAppUserId: () => "anon" };

// Import the transformed module so its top level runs. A throw here is exactly what we are hunting.
const dir = mkdtempSync(join(tmpdir(), "pk-stub-"));
const out = join(dir, "module.mjs");
writeFileSync(out, mod);
let failed = null;
process.on("unhandledRejection", () => {}); // async rejections after boot are not top-level throws
try {
  await import(pathToFileURL(out).href);
} catch (e) {
  failed = e;
} finally {
  try { rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}
if (failed) { console.error("TOP-LEVEL THREW: " + (failed && failed.stack ? failed.stack.split("\n").slice(0, 4).join("\n") : String(failed))); process.exit(1); }
console.log("TOP-LEVEL OK");
process.exit(0);
