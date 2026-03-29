## Scope

- Repo: `wezterm-mcp`
- Change: make tool discovery independent from startup diagnostics latency.

## Assumptions

- Clients can tolerate diagnostics on stderr after connection, but should not be forced to wait for them before `tools/list`.

## Findings

- `src/index.ts` now connects the stdio transport before running startup diagnostics.
- Startup diagnostics are still preserved and logged asynchronously.
- MCP SDK verification connected in `182ms` and listed six tools:
  - `write_to_terminal`
  - `read_terminal_output`
  - `send_control_character`
  - `list_panes`
  - `switch_pane`
  - `write_to_specific_pane`

## Direct Edits Required

- Implemented in [`src/index.ts`](/Volumes/Data/_ai/_mcp/mcp_stuff/wezterm-mcp/src/index.ts).

## Impacted Consumers

- MCP clients benefit from faster discovery.
- Runtime pane operations may still fail if the local WezTerm GUI socket is unhealthy.

## Validation

- `npm run build`
- `npm test -- --runInBand`
- Node SDK probe using `StdioClientTransport` and `Client.listTools()`

## Risks / Caveats

- The local `wezterm cli list` probe still reported a mux socket connection failure on this machine, so this change improves discovery but does not claim full runtime health.
