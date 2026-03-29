import AuditLogger from "./audit_logger.js";
import { RuntimePolicy } from "./config.js";
import {
  PolicyError,
  enforceWritePolicy,
  getRuntimePolicy,
  validateCommand,
  validatePaneId,
} from "./policy.js";
import { McpResponse, getErrorMessage, textResponse } from "./types.js";
import { CliResult, executeWeztermCli } from "./wezterm_cli.js";

type CliExecutor = (
  weztermCliPath: string,
  args: string[],
  options: { timeoutMs: number; maxOutputBytes: number }
) => Promise<CliResult>;

export default class WeztermExecutor {
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

  async writeToTerminal(commandInput: unknown): Promise<McpResponse> {
    const startedAt = Date.now();

    try {
      const command = validateCommand(commandInput);
      await enforceWritePolicy(
        this.policy,
        this.logger,
        "write_to_terminal",
        command
      );

      await this.execute(["send-text", "--no-paste", `${command}\n`]);
      await this.logger.record({
        tool: "write_to_terminal",
        status: "allowed",
        durationMs: Date.now() - startedAt,
        details: { command },
      });

      return textResponse(`Command sent to WezTerm: ${command}`);
    } catch (error) {
      await this.logger.record({
        tool: "write_to_terminal",
        status: error instanceof PolicyError ? "denied" : "error",
        durationMs: Date.now() - startedAt,
        details: { message: getErrorMessage(error) },
      });
      return textResponse(
        `Failed to write to terminal: ${getErrorMessage(error)}\nMake sure WezTerm is running and the mux server is enabled.`,
        { isError: true }
      );
    }
  }

  async writeToSpecificPane(
    commandInput: unknown,
    paneIdInput: unknown
  ): Promise<McpResponse> {
    const startedAt = Date.now();

    try {
      const command = validateCommand(commandInput);
      const paneId = Number(paneIdInput);
      validatePaneId(paneId);
      await enforceWritePolicy(
        this.policy,
        this.logger,
        "write_to_specific_pane",
        command,
        paneId
      );

      await this.execute([
        "send-text",
        "--pane-id",
        String(paneId),
        "--no-paste",
        `${command}\n`,
      ]);
      await this.logger.record({
        tool: "write_to_specific_pane",
        status: "allowed",
        durationMs: Date.now() - startedAt,
        paneId,
        details: { command },
      });

      return textResponse(`Command sent to pane ${paneId}: ${command}`);
    } catch (error) {
      const paneId =
        typeof paneIdInput === "number" || typeof paneIdInput === "string"
          ? Number(paneIdInput)
          : undefined;
      await this.logger.record({
        tool: "write_to_specific_pane",
        status: error instanceof PolicyError ? "denied" : "error",
        durationMs: Date.now() - startedAt,
        paneId: Number.isFinite(paneId) ? paneId : undefined,
        details: { message: getErrorMessage(error) },
      });
      return textResponse(
        `Failed to write to pane ${String(paneIdInput)}: ${getErrorMessage(error)}`,
        { isError: true }
      );
    }
  }

  async listPanes(): Promise<McpResponse> {
    const startedAt = Date.now();

    try {
      const { stdout } = await this.execute(["list"]);
      await this.logger.record({
        tool: "list_panes",
        status: "allowed",
        durationMs: Date.now() - startedAt,
      });
      return textResponse(stdout || "(empty output)");
    } catch (error) {
      await this.logger.record({
        tool: "list_panes",
        status: "error",
        durationMs: Date.now() - startedAt,
        details: { message: getErrorMessage(error) },
      });
      return textResponse(
        `Failed to list panes: ${getErrorMessage(error)}\nMake sure WezTerm is running and the mux server is enabled.`,
        { isError: true }
      );
    }
  }

  async switchPane(paneIdInput: unknown): Promise<McpResponse> {
    const startedAt = Date.now();

    try {
      const paneId = Number(paneIdInput);
      validatePaneId(paneId);
      await this.execute(["activate-pane", "--pane-id", String(paneId)]);
      await this.logger.record({
        tool: "switch_pane",
        status: "allowed",
        durationMs: Date.now() - startedAt,
        paneId,
      });
      return textResponse(`Switched to pane ${paneId}`);
    } catch (error) {
      const paneId =
        typeof paneIdInput === "number" || typeof paneIdInput === "string"
          ? Number(paneIdInput)
          : undefined;
      await this.logger.record({
        tool: "switch_pane",
        status: error instanceof PolicyError ? "denied" : "error",
        durationMs: Date.now() - startedAt,
        paneId: Number.isFinite(paneId) ? paneId : undefined,
        details: { message: getErrorMessage(error) },
      });
      return textResponse(
        `Failed to switch pane: ${getErrorMessage(error)}\nMake sure the pane ID ${String(
          paneIdInput
        )} exists.`,
        { isError: true }
      );
    }
  }
}
