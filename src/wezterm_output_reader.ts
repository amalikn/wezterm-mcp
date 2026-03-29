import AuditLogger from "./audit_logger.js";
import { RuntimePolicy } from "./config.js";
import { getRuntimePolicy, validateReadLines } from "./policy.js";
import { McpResponse, getErrorMessage, textResponse } from "./types.js";
import { CliResult, executeWeztermCli } from "./wezterm_cli.js";

type CliExecutor = (
  weztermCliPath: string,
  args: string[],
  options: { timeoutMs: number; maxOutputBytes: number }
) => Promise<CliResult>;

export default class WeztermOutputReader {
  private readonly logger: AuditLogger;

  constructor(
    private readonly policy: RuntimePolicy = getRuntimePolicy(),
    private readonly runCli: CliExecutor = executeWeztermCli
  ) {
    this.logger = new AuditLogger(this.policy.auditLogPath);
  }

  private async execute(args: string[]): Promise<CliResult> {
    return this.runCli(this.policy.weztermCliPath, args, {
      timeoutMs: this.policy.timeoutMs,
      maxOutputBytes: this.policy.maxOutputBytes,
    });
  }

  async readOutput(linesInput?: unknown): Promise<McpResponse> {
    const startedAt = Date.now();

    try {
      const lines = validateReadLines(linesInput, this.policy);
      const { stdout } = await this.execute([
        "get-text",
        "--escapes",
        "--start-line",
        String(-lines),
      ]);
      await this.logger.record({
        tool: "read_terminal_output",
        status: "allowed",
        durationMs: Date.now() - startedAt,
        details: { lines },
      });

      return textResponse(stdout || "(empty output)");
    } catch (error) {
      await this.logger.record({
        tool: "read_terminal_output",
        status: "error",
        durationMs: Date.now() - startedAt,
        details: { message: getErrorMessage(error) },
      });
      return textResponse(
        `Failed to read terminal output: ${getErrorMessage(error)}\nMake sure WezTerm is running and the mux server is enabled.\nTry running: wezterm cli list`,
        { isError: true }
      );
    }
  }

  async readCurrentScreen(): Promise<McpResponse> {
    const startedAt = Date.now();

    try {
      const { stdout } = await this.execute(["get-text", "--escapes"]);
      await this.logger.record({
        tool: "read_current_screen",
        status: "allowed",
        durationMs: Date.now() - startedAt,
      });
      return textResponse(stdout || "(empty output)");
    } catch (error) {
      await this.logger.record({
        tool: "read_current_screen",
        status: "error",
        durationMs: Date.now() - startedAt,
        details: { message: getErrorMessage(error) },
      });
      return textResponse(
        `Failed to read current screen: ${getErrorMessage(error)}`,
        { isError: true }
      );
    }
  }
}
