import os from "os";

const DEFAULT_READ_LINES = 50;
const DEFAULT_MAX_LINES = 500;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576;
const DEFAULT_AUDIT_LOG_PATH = `${os.tmpdir()}/wezterm-mcp-audit.log`;

type CommandMatcher = {
  raw: string;
  regex?: RegExp;
};

export type RuntimePolicy = {
  weztermCliPath: string;
  writeEnabled: boolean;
  controlEnabled: boolean;
  allowedPanes: Set<number>;
  allowedCommands: CommandMatcher[];
  defaultReadLines: number;
  maxLines: number;
  timeoutMs: number;
  maxOutputBytes: number;
  auditLogPath: string;
};

function parseBooleanEnv(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function parseIntegerEnv(
  value: string | undefined,
  defaultValue: number,
  minimum: number
): number {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    return defaultValue;
  }

  return parsed;
}

function parsePaneAllowlist(value: string | undefined): Set<number> {
  if (!value) {
    return new Set<number>();
  }

  const panes = new Set<number>();
  for (const token of value.split(/[,\s]+/)) {
    if (!token) {
      continue;
    }

    const paneId = Number.parseInt(token, 10);
    if (Number.isInteger(paneId) && paneId >= 0) {
      panes.add(paneId);
    }
  }

  return panes;
}

function parseCommandMatchers(value: string | undefined): CommandMatcher[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry.startsWith("regex:")) {
        return {
          raw: entry,
          regex: new RegExp(entry.slice("regex:".length)),
        };
      }

      if (entry.startsWith("/") && entry.endsWith("/") && entry.length > 2) {
        return {
          raw: entry,
          regex: new RegExp(entry.slice(1, -1)),
        };
      }

      return { raw: entry };
    });
}

export function loadRuntimePolicy(): RuntimePolicy {
  const maxLines = parseIntegerEnv(
    process.env.WEZTERM_MCP_MAX_LINES,
    DEFAULT_MAX_LINES,
    1
  );

  return {
    weztermCliPath: process.env.WEZTERM_CLI_PATH?.trim() || "wezterm",
    writeEnabled: parseBooleanEnv(process.env.WEZTERM_MCP_ENABLE_WRITE, false),
    controlEnabled: parseBooleanEnv(
      process.env.WEZTERM_MCP_ENABLE_CONTROL,
      false
    ),
    allowedPanes: parsePaneAllowlist(process.env.WEZTERM_MCP_ALLOWED_PANES),
    allowedCommands: parseCommandMatchers(
      process.env.WEZTERM_MCP_ALLOWED_COMMANDS
    ),
    defaultReadLines: Math.min(
      parseIntegerEnv(
        process.env.WEZTERM_MCP_DEFAULT_READ_LINES,
        DEFAULT_READ_LINES,
        1
      ),
      maxLines
    ),
    maxLines,
    timeoutMs: parseIntegerEnv(
      process.env.WEZTERM_MCP_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      1_000
    ),
    maxOutputBytes: parseIntegerEnv(
      process.env.WEZTERM_MCP_MAX_OUTPUT_BYTES,
      DEFAULT_MAX_OUTPUT_BYTES,
      1_024
    ),
    auditLogPath:
      process.env.WEZTERM_MCP_AUDIT_LOG_PATH?.trim() || DEFAULT_AUDIT_LOG_PATH,
  };
}

export function isPaneAllowed(
  policy: RuntimePolicy,
  paneId: number | undefined
): boolean {
  if (paneId === undefined || policy.allowedPanes.size === 0) {
    return true;
  }

  return policy.allowedPanes.has(paneId);
}

export function isCommandAllowed(
  policy: RuntimePolicy,
  command: string | undefined
): boolean {
  if (command === undefined || policy.allowedCommands.length === 0) {
    return true;
  }

  return policy.allowedCommands.some((matcher) => {
    if (matcher.regex) {
      return matcher.regex.test(command);
    }

    return matcher.raw === command;
  });
}
