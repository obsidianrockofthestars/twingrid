// Personakind Worker router.
//
//   /mcp     -> hosted MCP server (Streamable HTTP, JSON-RPC 2.0), see ./mcp.js
//   /api/*   -> JSON API, see ./api.js (a stub today; another agent replaces it)
//   anything else -> the static site in ./docs via the ASSETS binding
//
// wrangler.jsonc lists /mcp and /api/* under assets.run_worker_first, so those two
// routes always reach this script; every other path is served asset-first and only
// falls through to env.ASSETS.fetch here when no asset matched (same 404 as before).

import { handleMcp } from "./mcp.js";
import { handleApi, handleSitemap, runAutopilotTick, personaOgCard, handleEmbed } from "./api.js";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, mcp-session-id, mcp-protocol-version",
  "access-control-expose-headers": "mcp-session-id",
  "access-control-max-age": "86400",
};

// Returns a copy of the response with CORS headers added (Response headers may be immutable).
export function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: headers });
}

function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function isMcpPath(pathname) {
  return pathname === "/mcp" || pathname === "/mcp/";
}

function isApiPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function isHandlePath(pathname) {
  return pathname.startsWith("/@") || pathname.toLowerCase().startsWith("/%40");
}

// Parses an "@handle/Name" (or "%40handle/Name") path tail into {handle, name}, URL-decoded. Shared by the
// /@handle/Name page route (via personaSel below) and the /embed/@handle/Name embed route.
function parseHandleName(pathTail) {
  if (!isHandlePath(pathTail)) return null;
  let raw;
  try { raw = decodeURIComponent(pathTail.replace(/^\/(@|%40)/i, "")); } catch (_) { raw = pathTail.replace(/^\/(@|%40)/i, ""); }
  const parts = raw.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { handle: parts[0], name: parts.slice(1).join("/") };
}

// /embed/@handle/PersonaName or /embed/%40handle/PersonaName (2026-09-15, founder ruling "let's do it").
function isEmbedPath(pathname) {
  return pathname.startsWith("/embed/@") || pathname.toLowerCase().startsWith("/embed/%40");
}

// Which persona/room a URL points at, for the share card. Query forms (?t=, ?room=, ?u=&p=) and the
// pretty path /@handle/Persona. Returns null for everything else (including a bare /@handle account page).
function personaSel(url) {
  const p = url.pathname;
  const sp = url.searchParams;
  if (p === "/" || p === "") {
    if (sp.get("t")) return { gridId: sp.get("t") };
    if (sp.get("room")) return { gridId: sp.get("room") };
    if (sp.get("u") && sp.get("p")) return { handle: sp.get("u"), name: sp.get("p") };
    return null;
  }
  const hn = parseHandleName(p);
  if (hn) return hn;
  return null;
}

// Inject the persona's title, description and portrait into the shell's head with HTMLRewriter, so a
// shared link shows the persona instead of the generic Personakind card. The body is untouched.
function withPersonaCard(shell, card, href) {
  const setContent = (val) => ({ element(e) { e.setAttribute("content", val); } });
  let rw = new HTMLRewriter()
    .on("title", { element(e) { e.setInnerContent(card.title); } })
    .on('meta[property="og:title"]', setContent(card.title))
    .on('meta[name="twitter:title"]', setContent(card.title))
    .on('meta[property="og:description"]', setContent(card.description))
    .on('meta[name="twitter:description"]', setContent(card.description))
    .on('meta[property="og:url"]', setContent(href))
    .on('link[rel="canonical"]', { element(e) { e.setAttribute("href", href); } });
  if (card.image) {
    rw = rw
      .on('meta[property="og:image"]', setContent(card.image))
      .on('meta[name="twitter:image"]', setContent(card.image));
  }
  const out = rw.transform(shell);
  return new Response(out.body, { status: 200, statusText: "OK", headers: out.headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (isMcpPath(path)) {
      if (request.method === "OPTIONS") return preflight();
      try {
        return withCors(await handleMcp(request, env));
      } catch (exc) {
        // Never leak a stack trace; a JSON-RPC client only needs to know the server failed.
        const body = JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal error" } });
        return withCors(new Response(body, { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }));
      }
    }

    if (isEmbedPath(path)) {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
      const hn = parseHandleName(path.slice("/embed".length));
      if (!hn) return new Response(null, { status: 404 });
      try {
        return await handleEmbed(env, hn.handle, hn.name);
      } catch (_) {
        return new Response(null, { status: 500 });
      }
    }

    if (isApiPath(path)) {
      if (request.method === "OPTIONS") return preflight();
      try {
        return withCors(await handleApi(request, env, ctx));
      } catch (exc) {
        return withCors(new Response(JSON.stringify({ error: "internal error" }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        }));
      }
    }

    // Sitemap from the database (2026-09-06); the static docs/sitemap.xml is gone.
    if (path === "/sitemap.xml") {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
      return handleSitemap(env);
    }

    // Per-persona share card (v22, review 20): a shared persona/room link gets the persona's own head tags.
    // Public rows only (personaOgCard reads the Lobby view), and any miss or error falls through to plain serving.
    if (request.method === "GET" || request.method === "HEAD") {
      const sel = personaSel(url);
      if (sel) {
        try {
          const card = await personaOgCard(env, sel);
          if (card) {
            const shell = await env.ASSETS.fetch(new Request(url.origin + "/", { method: "GET", headers: request.headers }));
            return withPersonaCard(shell, card, url.href);
          }
        } catch (_) { /* fall through to plain serving below */ }
      }
    }

    // /@handle and /@handle/persona are page routes: serve the shell with a 200 and let the page fold the
    // path into ?u=handle&p=persona. Everything else is asset-first; an unknown path now gets docs/404.html
    // with a real 404 (wrangler not_found_handling "404-page", 2026-09-06) instead of the shell with a 200.
    if (isHandlePath(path)) {
      const shell = await env.ASSETS.fetch(new Request(url.origin + "/", { method: "GET", headers: request.headers }));
      return new Response(shell.body, { status: 200, statusText: "OK", headers: shell.headers });
    }
    return env.ASSETS.fetch(request);
  },
  // Cron Trigger (wrangler.jsonc triggers.crons, hourly). The tick is idempotent within the hour and writes its own receipt.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAutopilotTick(env, new Date(event.scheduledTime)));
  },
};
