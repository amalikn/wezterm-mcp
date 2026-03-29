## Scope

- Repo: `wezterm-mcp`
- Immediate goal: determine why the MCP server may appear without discoverable tools and apply the smallest safe fix.

## Assumptions

- Codex is launching the checked-out repo via `node build/index.js`.
- Tool discovery depends on the server answering MCP initialization and `tools/list` promptly.

## Findings

- The server entrypoint awaited `runStartupDiagnostics()` before calling `server.connect()`.
- Startup diagnostics call `wezterm --version` and `wezterm cli list`, so MCP discovery was gated on external CLI responsiveness.
- Local config and repo path were already aligned; the issue was in startup ordering rather than registration drift.

## Direct Edits Required

- Move diagnostics logging off the critical path so `server.connect()` happens first.

## Impacted Consumers

- Codex and any other stdio MCP client that expects prompt tool discovery from this server.

## Validation

- `npm run build`
- `npm test -- --runInBand`
- MCP SDK client probe against `node build/index.js`

## Risks / Caveats

- This does not repair local WezTerm mux/socket failures; it only prevents them from delaying tool discovery.
