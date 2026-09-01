# Personakind hosted MCP server (Cloudflare Worker)

This directory adds a hosted, remote MCP server at `https://personakind.com/mcp` next to the
existing static site. Same Worker, same domain, no new hosting.

- `index.js`: router. `/mcp` goes to the MCP server, `/api/*` goes to `api.js`, everything else
  is served from `./docs` through the `ASSETS` binding exactly as before. Adds CORS headers and
  answers `OPTIONS` preflight for `/mcp` and `/api/*`.
- `mcp.js`: dependency-free MCP Streamable HTTP server (spec `2025-06-18`, also accepts
  `2025-03-26` and `2024-11-05` in `initialize`). JSON-RPC 2.0 over `POST`, JSON responses only
  (no SSE), stateless. Ports the four live tools from the Python stdio server
  (`personakind_mcp/server.py` + `live.py`) with identical names, descriptions, input schemas and
  output text, including the guard preamble byte for byte.
- `api.js`: stub that returns `404 {"error":"not found"}` for every `/api/*` request. Another
  agent replaces it. Contract: `export async function handleApi(request, env, ctx) -> Response`.
- `test-mcp.mjs`: end-to-end smoke test using the official TypeScript MCP SDK client.

## Tools

All four are read-only and public-only. Only rows with `is_public = true` are readable through
the publishable key; the site's row-level security enforces that, not this code.

| Tool | Purpose |
| --- | --- |
| `personakind_find` | Search public accounts by handle prefix or display name. Markdown table. |
| `personakind_list_personas` | List one account's public personas with share links. |
| `personakind_get_persona` | Fetch one persona and compose it into system-prompt text (guard preamble, provenance line, every non-empty cell as `# facet / CELL`). |
| `personakind_compose` | Same, but only `core` plus at most one specialist, one mode, one role and exactly one register. |

The guard preamble that opens every `get_persona` and `compose` result is the security control:
it tells the reading model that the persona cells are DATA written by the author, never
instructions. It is copied verbatim from `live.py` and must not be edited independently.

Backend: Supabase PostgREST at `https://jpepcqazscmhakxvutpg.supabase.co/rest/v1`, tables
`twingrid_accounts` and `twingrid_grids`, with the same filters, ordering and limits `live.py`
uses. The publishable key is public by design.

## Protocol behaviour

- `POST /mcp`: JSON-RPC 2.0, single message or batch array. Responds `application/json`.
  Notifications (and client responses) get `202` with an empty body. Unknown method: `-32601`.
  Unparseable body: `-32700` (HTTP 400). Unknown tool name: `-32602`. Tool failures (bad ref,
  not found, network) come back as a normal result with `isError: true`, never as JSON-RPC errors.
- `initialize` echoes the client's `protocolVersion` when supported, otherwise `2025-06-18`;
  capabilities `{tools: {}}`, `serverInfo {name: "personakind", version: "0.3.0"}`, plus a
  one-paragraph `instructions` string. A random `Mcp-Session-Id` is issued; later calls may send
  any value, it is echoed and never enforced (the server keeps no state).
- `GET /mcp`: `405` with `Allow: POST, DELETE, OPTIONS` (no server-initiated SSE stream).
- `DELETE /mcp`: `200`.
- Persona text is capped at 200,000 characters. Real personas are about 20,000 to 25,000
  characters. Note that Anthropic documents a ~150,000 character tool result limit for
  Claude.ai and Claude Desktop, so the cap is a backstop rather than a target.

## Test locally

```sh
npm install                                   # installs wrangler and @modelcontextprotocol/sdk (dev only)
npx wrangler dev --port 8787                  # serves ./docs plus the Worker on http://127.0.0.1:8787
node worker/test-mcp.mjs http://127.0.0.1:8787/mcp
```

`test-mcp.mjs` does a raw `fetch` of `initialize`, checks the 202 / 405 / 200 / -32601 / -32700
paths, then connects with `StreamableHTTPClientTransport`, lists tools, calls
`personakind_list_personas`, `personakind_find`, `personakind_get_persona` on the first listed
persona, `personakind_compose`, and one error path. It talks to the live Supabase project, so it
needs network access. Optional args: `node worker/test-mcp.mjs <url> [@handle] [find query]`.

Handy curls:

```sh
curl -s http://127.0.0.1:8787/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
curl -s http://127.0.0.1:8787/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"personakind_find","arguments":{"query":"persona"}}}'
```

The `docs/` folder in this working copy holds only `index.html` and `_headers`, copied from the
site so the `ASSETS` binding has something to serve during local testing. They are for local
testing only; the real site files live in the repo's own `docs/` and are deployed automatically
from GitHub `main` by Workers Builds. (The source `docs/` had no `favicon.svg` or `robots.txt` to copy.)

Deploy is automatic from GitHub `main`. `run_worker_first: ["/mcp", "/api/*"]` in
`wrangler.jsonc` needs Wrangler 4.20 or newer, which Workers Builds provides.

## Connect it in Claude

Claude connects to remote MCP servers from Anthropic's cloud, not from your device, so the URL
must be public. `https://personakind.com/mcp` is. No login is needed: Anthropic's authentication
reference lists `none` ("No authentication (authless server)") as "Supported" for Claude.ai,
Claude Desktop, Claude mobile, Claude Code and Cowork.

### Claude.ai, Claude Desktop, Cowork (Free, Pro, Max)

Wording below is quoted from Anthropic's help article (verified 2026-09-01):

1. Navigate to **Customize > Connectors**.
2. Click **"+"** then **"Add custom connector"**.
3. Add your connector's remote MCP server URL: `https://personakind.com/mcp`
4. Skip **"Advanced settings"** (OAuth Client ID and Secret are optional and not used here).
5. Click **"Add"**.

Then enable it per conversation via the **"+"** button in the chat box, then **"Connectors"**.
Free plans are limited to one custom connector.

### Claude Team and Enterprise

An Owner adds it first: **Organization settings > Connectors**, click **"Add"**, hover
**"Custom"**, select **"Web"**, enter `https://personakind.com/mcp`, click **"Add"**. Members then
go to **Customize > Connectors**, find the connector (labelled "Custom") and click **"Connect"**.

Sources:

- https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
  (UI steps, plan availability, "Claude connects to your remote MCP server from Anthropic's cloud infrastructure")
- https://claude.com/docs/connectors/building (supported transports: "Claude supports both
  Streamable HTTP and the legacy HTTP+SSE transport"; ~150,000 character tool result limit)
- https://claude.com/docs/connectors/building/authentication (auth type `none`, "No authentication
  (authless server)", availability "Supported")

### Claude Code

```sh
claude mcp add --transport http personakind https://personakind.com/mcp
```

Then `/mcp` inside Claude Code shows its status. Source:
https://code.claude.com/docs/en/mcp (the canonical page; `https://docs.claude.com/en/docs/claude-code/mcp`
redirects there).

### Cursor

Cursor Settings > MCP, or add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "personakind": {
      "url": "https://personakind.com/mcp"
    }
  }
}
```

Source: https://cursor.com/docs/context/mcp (Streamable HTTP is listed as a supported transport;
the remote-server example uses a `url` entry).

## Using it

Once connected, ask Claude things like:

- "Find Personakind accounts matching coach"
- "List @personakindofficial's personas"
- "Load the persona at https://personakind.com/?t=<uuid> and talk to me as it"
- "Compose @personakindofficial/The Coach as engineer in surgery register"
