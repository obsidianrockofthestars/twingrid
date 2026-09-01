#!/usr/bin/env node
// End-to-end smoke test for the Personakind hosted MCP server.
//
//   node worker/test-mcp.mjs http://127.0.0.1:8787/mcp
//   node worker/test-mcp.mjs https://personakind.com/mcp
//
// 1. Raw fetch: POST initialize and print status, headers and body.
// 2. SDK: connect with StreamableHTTPClientTransport, list tools, call
//    personakind_list_personas, personakind_find, then personakind_get_persona
//    on the first result, printing each result (persona text trimmed).
//
// Requires: npm install @modelcontextprotocol/sdk (run in the repo root; node_modules is not committed).

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.argv[2];
if (!url) {
  console.error("usage: node worker/test-mcp.mjs <mcp url>");
  process.exit(2);
}
const HANDLE = process.argv[3] || "@personakindofficial";
const QUERY = process.argv[4] || "persona";

function section(title) {
  console.log("\n=== " + title + " ===");
}

function trim(text, n) {
  n = n || 600;
  return text.length > n ? text.slice(0, n) + " ... [" + (text.length - n) + " more chars]" : text;
}

async function rawInitialize() {
  section("raw fetch: initialize");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-mcp.mjs", version: "0.0.1" },
      },
    }),
  });
  console.log("status:", res.status);
  console.log("content-type:", res.headers.get("content-type"));
  console.log("mcp-session-id:", res.headers.get("mcp-session-id"));
  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));
  if (!body.result || body.result.serverInfo?.name !== "personakind") {
    throw new Error("initialize did not return the personakind serverInfo");
  }

  section("raw fetch: notifications/initialized (expect 202)");
  const n = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "mcp-session-id": res.headers.get("mcp-session-id") || "" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  console.log("status:", n.status);

  section("raw fetch: unknown method (expect -32601) and parse error (expect -32700)");
  const u = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "nope/nothing" }),
  });
  console.log("unknown method:", u.status, JSON.stringify(await u.json()));
  const p = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
  console.log("parse error:", p.status, JSON.stringify(await p.json()));

  section("raw fetch: GET (expect 405) and DELETE (expect 200)");
  const g = await fetch(url, { method: "GET" });
  console.log("GET:", g.status, "allow:", g.headers.get("allow"));
  const d = await fetch(url, { method: "DELETE", headers: { "mcp-session-id": "anything" } });
  console.log("DELETE:", d.status);
}

async function sdkFlow() {
  section("sdk: connect");
  const client = new Client({ name: "test-mcp.mjs", version: "0.0.1" });
  const transport = new StreamableHTTPClientTransport(new URL(url));
  await client.connect(transport);
  console.log("server:", JSON.stringify(client.getServerVersion()));
  console.log("capabilities:", JSON.stringify(client.getServerCapabilities()));
  console.log("session id:", transport.sessionId);

  section("sdk: tools/list");
  const tools = await client.listTools();
  for (const t of tools.tools) {
    console.log("-", t.name, "| required:", JSON.stringify(t.inputSchema.required), "| props:", Object.keys(t.inputSchema.properties).join(","));
  }

  section("sdk: personakind_list_personas " + HANDLE);
  const listed = await client.callTool({ name: "personakind_list_personas", arguments: { handle: HANDLE } });
  console.log(listed.content[0].text);
  console.log("structuredContent keys:", Object.keys(listed.structuredContent || {}));

  section("sdk: personakind_find " + JSON.stringify(QUERY));
  const found = await client.callTool({ name: "personakind_find", arguments: { query: QUERY, limit: 5 } });
  console.log(found.content[0].text);

  // First share link in the list_personas output is the first result to load.
  const m = listed.content[0].text.match(/https:\/\/personakind\.com\/\?t=([0-9a-f-]{36})/);
  if (!m) throw new Error("no share link found in list_personas output");
  section("sdk: personakind_get_persona " + m[0]);
  const persona = await client.callTool({ name: "personakind_get_persona", arguments: { ref: m[0] } });
  const text = persona.content[0].text;
  console.log("isError:", persona.isError === true);
  console.log("text length:", text.length);
  console.log("guard preamble first:", text.startsWith("You are role-playing a published Personakind persona"));
  console.log(trim(text, 700));
  const sc = persona.structuredContent || {};
  console.log("structuredContent: persona_name=" + sc.persona_name + " handle=" + sc.handle + " facets=" + (sc.facets || []).length);

  section("sdk: personakind_compose (engineer + surgery)");
  const composed = await client.callTool({
    name: "personakind_compose",
    arguments: { ref: m[1], specialist: "engineer", register: "surgery" },
  });
  console.log("isError:", composed.isError === true);
  console.log("facets:", (composed.structuredContent?.facets || []).map((f) => f.name).join(","));
  console.log("composition:", JSON.stringify(composed.structuredContent?.composition));

  section("sdk: error path (unknown handle, expect isError)");
  const bad = await client.callTool({ name: "personakind_get_persona", arguments: { ref: "@nobody_here_xyz" } });
  console.log("isError:", bad.isError === true, "|", bad.content[0].text);

  await client.close();
  section("done");
}

try {
  await rawInitialize();
  await sdkFlow();
} catch (exc) {
  console.error("\nFAILED:", exc && exc.stack ? exc.stack : exc);
  process.exit(1);
}
