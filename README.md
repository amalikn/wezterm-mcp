# WezTerm MCP Server

`wezterm-mcp` is a local MCP server that controls a running WezTerm session.
It can:

- write text to the active pane
- read recent pane output
- send control characters
- list panes
- switch panes
- write to a specific pane by id

This server should be treated as a privileged local automation surface. The
default hardening profile keeps read access available while denying write and
control actions until you opt in explicitly.

## Tools

The server exposes these MCP tools:

| Tool Name | Description | Notes |
| --- | --- | --- |
| `read_terminal_output` | Read recent output from the active WezTerm pane. | Available by default. Supports optional `lines` argument. |
| `list_panes` | List panes in the current WezTerm window. | Available by default. Useful for discovering pane ids before switching or writing. |
| `write_to_terminal` | Write text to the active WezTerm pane. | Disabled by default unless `WEZTERM_MCP_ENABLE_WRITE=true`. |
| `write_to_specific_pane` | Write text to a specific WezTerm pane by pane id. | Disabled by default unless `WEZTERM_MCP_ENABLE_WRITE=true`. |
| `switch_pane` | Switch focus to a specific WezTerm pane. | Available by default. Requires a valid `pane_id`. |
| `send_control_character` | Send a control character such as `Ctrl+C` to the active pane. | Disabled by default unless `WEZTERM_MCP_ENABLE_CONTROL=true`. |

Write and control tools are policy-gated even though they are advertised by the
server. A client can discover them through MCP `tools/list`, but calls will fail
closed unless the corresponding runtime policy flags are enabled.

## Secure Local Installation

The existing local Codex install should launch the server from the checked-out
repo:

```toml
[mcp_servers.wezterm-mcp]
command = "bash"
args = [
  "-lc",
  "mkdir -p /Volumes/Data/_ai/_mcp/mcp-data/wezterm-mcp && cd /Volumes/Data/_ai/_mcp/mcp_stuff/wezterm-mcp && exec node build/index.js"
]
```

Recommended hardened environment:

```bash
export WEZTERM_MCP_ENABLE_WRITE=false
export WEZTERM_MCP_ENABLE_CONTROL=false
export WEZTERM_MCP_DEFAULT_READ_LINES=50
export WEZTERM_MCP_MAX_LINES=200
export WEZTERM_MCP_TIMEOUT_MS=10000
export WEZTERM_MCP_MAX_OUTPUT_BYTES=65536
export WEZTERM_MCP_AUDIT_LOG_PATH=/Volumes/Data/_ai/_mcp/mcp-data/wezterm-mcp/audit.log
```

Enable write access only when you need it:

```bash
export WEZTERM_MCP_ENABLE_WRITE=true
```

Enable control characters only when you need them:

```bash
export WEZTERM_MCP_ENABLE_CONTROL=true
```

Restrict writes to specific panes:

```bash
export WEZTERM_MCP_ALLOWED_PANES=12,14
```

Restrict writes to an explicit command allowlist:

```bash
export WEZTERM_MCP_ALLOWED_COMMANDS='pwd,ls -la,regex:^git status$'
```

## Runtime Controls

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEZTERM_CLI_PATH` | `wezterm` | Path to the WezTerm executable. |
| `WEZTERM_MCP_ENABLE_WRITE` | `false` | Enables `write_to_terminal` and `write_to_specific_pane`. |
| `WEZTERM_MCP_ENABLE_CONTROL` | `false` | Enables `send_control_character`. |
| `WEZTERM_MCP_ALLOWED_PANES` | empty | Optional comma/space-separated pane allowlist. |
| `WEZTERM_MCP_ALLOWED_COMMANDS` | empty | Optional literal or `regex:` command allowlist. |
| `WEZTERM_MCP_DEFAULT_READ_LINES` | `50` | Default scrollback lines for `read_terminal_output`. |
| `WEZTERM_MCP_MAX_LINES` | `500` | Maximum scrollback lines allowed per read. |
| `WEZTERM_MCP_TIMEOUT_MS` | `30000` | Timeout for each WezTerm CLI call. |
| `WEZTERM_MCP_MAX_OUTPUT_BYTES` | `1048576` | Maximum stdout/stderr captured per call. |
| `WEZTERM_MCP_AUDIT_LOG_PATH` | OS temp dir | Audit log file path. |

## Operational Guidance

- Keep this server local-only. Do not expose it over a network.
- Use it only with MCP clients you trust.
- Keep sensitive work in separate panes or separate WezTerm windows.
- Do not enable write/control access by default in your everyday profile.
- Prefer pane allowlists and command allowlists when enabling writes.
- Review the audit log if a client behavior looks suspicious.

At startup, the server logs:

- the effective hardening profile
- whether `wezterm --version` succeeded
- whether `wezterm cli list` could reach the mux socket

## Development

Install dependencies and rebuild:

```bash
npm install
npm run build
```

Run tests:

```bash
npm test -- --runInBand
```

Run a scanner pass from the sibling `mcp-scanner` repo:

```bash
uv run python -m mcpscanner.cli \
  --analyzers yara,readiness \
  --format summary \
  stdio \
  --stdio-command node \
  --stdio-arg /Volumes/Data/_ai/_mcp/mcp_stuff/wezterm-mcp/build/index.js
```

## Security

See [SECURITY.md](./SECURITY.md) for the threat model, known limits, and safe
usage guidance.
