# Security Policy

## Trust Model

`wezterm-mcp` is a privileged local terminal-control server.

- Any allowed write tool can inject text into a live terminal.
- `read_terminal_output` can expose anything visible in terminal scrollback.
- `send_control_character` can interrupt or alter interactive sessions.

This server is only appropriate for local use with trusted MCP clients.

## Secure Defaults

The hardened server starts with:

- `WEZTERM_MCP_ENABLE_WRITE=false`
- `WEZTERM_MCP_ENABLE_CONTROL=false`
- bounded output reads
- command execution timeouts
- output size limits
- audit logging

Write and control actions require explicit opt-in.

## Implemented Mitigations

- No shell-string execution. All WezTerm invocations use argv-safe process spawning.
- Pane ids are validated as non-negative integers.
- Read requests are bounded by configurable line and output limits.
- Write tools fail closed unless enabled by policy.
- Control-character tools fail closed unless enabled by policy.
- Optional command allowlist and pane allowlist support narrower execution scope.
- Audit events record tool usage, denials, and errors without storing raw terminal output.

## Remaining Risks

- If you enable writes, a trusted MCP client can still send destructive commands.
- `read_terminal_output` can still reveal sensitive data already visible in the pane.
- This server does not sandbox commands beyond the configured allowlists.
- Audit logs are local records, not tamper-proof forensic evidence.

## Recommended Operating Model

- Keep `write` and `control` disabled in your default profile.
- Enable them only for a dedicated trusted workflow.
- Restrict writes to explicit panes with `WEZTERM_MCP_ALLOWED_PANES`.
- Restrict writes to known commands with `WEZTERM_MCP_ALLOWED_COMMANDS`.
- Use separate panes or windows for production shells and sensitive sessions.
- Never expose this MCP server over a remote transport.

## Reporting

If you find a security issue in this fork, record the exact payload, affected
tool, expected behavior, and observed behavior, then file it against the
operator-owned fork before enabling the feature broadly.
