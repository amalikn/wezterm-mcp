import AuditLogger from "./audit_logger.js";
import { RuntimePolicy } from "./config.js";
import {
  PolicyError,
  enforceControlPolicy,
  getRuntimePolicy,
  validateControlCharacter,
} from "./policy.js";
import { McpResponse, getErrorMessage, textResponse } from "./types.js";
import { CliResult, executeWeztermCli } from "./wezterm_cli.js";

type CliExecutor = (
  weztermCliPath: string,
  args: string[],
  options: { timeoutMs: number; maxOutputBytes: number }
) => Promise<CliResult>;

const CONTROL_MAP: Record<string, string> = {
  a: "\x01",
  b: "\x02",
  c: "\x03",
  d: "\x04",
  e: "\x05",
  f: "\x06",
  g: "\x07",
  k: "\x0b",
  l: "\x0c",
  n: "\x0e",
  p: "\x10",
  q: "\x11",
  r: "\x12",
  s: "\x13",
  t: "\x14",
  u: "\x15",
  v: "\x16",
  w: "\x17",
  x: "\x18",
  y: "\x19",
  z: "\x1a",
};

export default class SendControlCharacter {
  private readonly logger: AuditLogger;

  constructor(
    private readonly policy: RuntimePolicy = getRuntimePolicy(),
    private readonly runCli: CliExecutor = executeWeztermCli
  ) {
    this.logger = new AuditLogger(this.policy.auditLogPath);
  }

  async send(characterInput: unknown): Promise<McpResponse> {
    const startedAt = Date.now();

    try {
      const character = validateControlCharacter(characterInput);
      const controlSequence = CONTROL_MAP[character];
      if (!controlSequence) {
        throw new PolicyError(
          `Unknown control character: ${character}. Supported characters: ${Object.keys(
            CONTROL_MAP
          )
            .sort()
            .join(", ")}`
        );
      }

      await enforceControlPolicy(
        this.policy,
        this.logger,
        "send_control_character"
      );

      await this.runCli(this.policy.weztermCliPath, ["send-text", controlSequence], {
        timeoutMs: this.policy.timeoutMs,
        maxOutputBytes: this.policy.maxOutputBytes,
      });
      await this.logger.record({
        tool: "send_control_character",
        status: "allowed",
        durationMs: Date.now() - startedAt,
        details: { character },
      });

      return textResponse(`Sent control character: Ctrl+${character.toUpperCase()}`);
    } catch (error) {
      await this.logger.record({
        tool: "send_control_character",
        status: error instanceof PolicyError ? "denied" : "error",
        durationMs: Date.now() - startedAt,
        details: { message: getErrorMessage(error) },
      });
      return textResponse(
        `Failed to send control character: ${getErrorMessage(error)}`,
        { isError: true }
      );
    }
  }
}
