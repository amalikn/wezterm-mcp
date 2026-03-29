import crypto from "crypto";
import { appendFile } from "fs/promises";

type AuditStatus = "allowed" | "denied" | "error";

export type AuditEvent = {
  tool: string;
  status: AuditStatus;
  durationMs?: number;
  paneId?: number;
  details?: Record<string, unknown>;
};

function summarizeString(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const preview =
    normalized.length > 80 ? `${normalized.slice(0, 80)}...` : normalized;
  const hash = crypto.createHash("sha256").update(value).digest("hex");
  return `${preview} [sha256:${hash.slice(0, 12)}]`;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return summarizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeValue(item)])
    );
  }

  return value;
}

export default class AuditLogger {
  constructor(private readonly auditLogPath: string) {}

  async record(event: AuditEvent): Promise<void> {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      tool: event.tool,
      status: event.status,
      durationMs: event.durationMs,
      paneId: event.paneId,
      details: sanitizeValue(event.details),
    });

    try {
      await appendFile(this.auditLogPath, `${line}\n`, "utf8");
    } catch (error) {
      console.error("Failed to write wezterm-mcp audit log:", error);
    }
  }
}
