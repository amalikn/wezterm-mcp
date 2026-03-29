import AuditLogger from "./audit_logger.js";
import {
  RuntimePolicy,
  isCommandAllowed,
  isPaneAllowed,
  loadRuntimePolicy,
} from "./config.js";

export class PolicyError extends Error {}

export function validatePaneId(paneId: number): void {
  if (!Number.isInteger(paneId) || paneId < 0) {
    throw new PolicyError(
      `Invalid pane ID: ${paneId}. Pane ID must be a non-negative integer.`
    );
  }
}

export function validateCommand(command: unknown): string {
  if (typeof command !== "string") {
    throw new PolicyError("Command must be a string.");
  }
  if (command.length === 0) {
    throw new PolicyError("Command must not be empty.");
  }
  if (command.length > 4096) {
    throw new PolicyError("Command exceeds the 4096 character limit.");
  }
  if (command.includes("\0")) {
    throw new PolicyError("Command must not contain NUL bytes.");
  }

  return command;
}

export function validateReadLines(lines: unknown, policy: RuntimePolicy): number {
  const value =
    lines === undefined || lines === null ? policy.defaultReadLines : lines;

  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new PolicyError("lines must be a positive integer.");
  }
  if (Number(value) > policy.maxLines) {
    throw new PolicyError(
      `lines exceeds the configured limit of ${policy.maxLines}.`
    );
  }

  return Number(value);
}

export function validateControlCharacter(character: unknown): string {
  if (typeof character !== "string" || character.trim() === "") {
    throw new PolicyError("character must be a non-empty string.");
  }

  return character.trim().toLowerCase();
}

export async function enforceWritePolicy(
  policy: RuntimePolicy,
  logger: AuditLogger,
  tool: string,
  command: string,
  paneId?: number
): Promise<void> {
  if (!policy.writeEnabled) {
    await logger.record({
      tool,
      status: "denied",
      paneId,
      details: { reason: "write_disabled" },
    });
    throw new PolicyError(
      "Write tools are disabled. Set WEZTERM_MCP_ENABLE_WRITE=true to enable them."
    );
  }

  if (!isPaneAllowed(policy, paneId)) {
    await logger.record({
      tool,
      status: "denied",
      paneId,
      details: { reason: "pane_not_allowed" },
    });
    throw new PolicyError(
      `Pane ${paneId} is not in WEZTERM_MCP_ALLOWED_PANES.`
    );
  }

  if (!isCommandAllowed(policy, command)) {
    await logger.record({
      tool,
      status: "denied",
      paneId,
      details: { reason: "command_not_allowed", command },
    });
    throw new PolicyError(
      "Command is not permitted by WEZTERM_MCP_ALLOWED_COMMANDS."
    );
  }
}

export async function enforceControlPolicy(
  policy: RuntimePolicy,
  logger: AuditLogger,
  tool: string
): Promise<void> {
  if (!policy.controlEnabled) {
    await logger.record({
      tool,
      status: "denied",
      details: { reason: "control_disabled" },
    });
    throw new PolicyError(
      "Control-character tools are disabled. Set WEZTERM_MCP_ENABLE_CONTROL=true to enable them."
    );
  }
}

export function getRuntimePolicy(): RuntimePolicy {
  return loadRuntimePolicy();
}
