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
import { handleApi, handleSitemap } from "./api.js";

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

    // /@handle and /@handle/persona are page routes: serve the shell with a 200 and let the page fold the
    // path into ?u=handle&p=persona. Everything else is asset-first; an unknown path now gets docs/404.html
    // with a real 404 (wrangler not_found_handling "404-page", 2026-09-06) instead of the shell with a 200.
    if (isHandlePath(path)) {
      const shell = await env.ASSETS.fetch(new Request(url.origin + "/", { method: "GET", headers: request.headers }));
      return new Response(shell.body, { status: 200, statusText: "OK", headers: shell.headers });
    }
    return env.ASSETS.fetch(request);
  },
};
