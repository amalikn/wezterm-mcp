#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import WeztermExecutor from "./wezterm_executor.js";
import WeztermOutputReader from "./wezterm_output_reader.js";
import SendControlCharacter from "./send_control_character.js";
import { loadRuntimePolicy } from "./config.js";
import { runStartupDiagnostics } from "./wezterm_cli.js";

function createServer() {
  const server = new McpServer({
    name: "wezterm-mcp",
    version: "0.1.1",
  });

  server.registerTool(
    "write_to_terminal",
    {
      description:
        "Writes text to the active WezTerm pane - often used to run commands",
      inputSchema: {
        command: z
          .string()
          .describe("The command to run or text to write to the terminal"),
      },
    },
    async ({ command }) => {
      const executor = new WeztermExecutor();
      return executor.writeToTerminal(command);
    }
  );

  server.registerTool(
    "read_terminal_output",
    {
      description: "Reads output from the active WezTerm pane",
      inputSchema: {
        lines: z
          .number()
          .optional()
          .describe("Number of lines to read from the terminal (default: 50)"),
      },
    },
    async ({ lines }) => {
      const outputReader = new WeztermOutputReader();
      return outputReader.readOutput(lines);
    }
  );

  server.registerTool(
    "send_control_character",
    {
      description: "Sends control characters to the active WezTerm pane",
      inputSchema: {
        character: z
          .string()
          .describe("Control character to send (e.g., 'c' for Ctrl+C)"),
      },
    },
    async ({ character }) => {
      const controlCharSender = new SendControlCharacter();
      return controlCharSender.send(character);
    }
  );

  server.registerTool(
    "list_panes",
    {
      description: "Lists all panes in the current WezTerm window",
      inputSchema: {},
    },
    async () => {
      const executor = new WeztermExecutor();
      return executor.listPanes();
    }
  );

  server.registerTool(
    "switch_pane",
    {
      description: "Switches to a specific pane in WezTerm",
      inputSchema: {
        pane_id: z.number().describe("ID of the pane to switch to"),
      },
    },
    async ({ pane_id }) => {
      const executor = new WeztermExecutor();
      return executor.switchPane(pane_id);
    }
  );

  server.registerTool(
    "write_to_specific_pane",
    {
      description: "Writes text to a specific WezTerm pane by pane ID",
      inputSchema: {
        command: z
          .string()
          .describe("The command to run or text to write to the terminal"),
        pane_id: z.number().describe("ID of the pane to write to"),
      },
    },
    async ({ command, pane_id }) => {
      const executor = new WeztermExecutor();
      return executor.writeToSpecificPane(command, pane_id);
    }
  );

  return server;
}

async function logStartupPolicy(): Promise<void> {
  const policy = loadRuntimePolicy();
  const diagnostics = await runStartupDiagnostics(
    policy.weztermCliPath,
    policy.timeoutMs,
    policy.maxOutputBytes
  );

  console.error(
    "wezterm-mcp startup policy:",
    JSON.stringify({
      writeEnabled: policy.writeEnabled,
      controlEnabled: policy.controlEnabled,
      allowedPaneCount: policy.allowedPanes.size,
      hasCommandAllowlist: policy.allowedCommands.length > 0,
      defaultReadLines: policy.defaultReadLines,
      maxLines: policy.maxLines,
      timeoutMs: policy.timeoutMs,
      maxOutputBytes: policy.maxOutputBytes,
      auditLogPath: policy.auditLogPath,
      diagnostics,
    })
  );
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  void logStartupPolicy().catch((error) => {
    console.error("Failed to collect startup diagnostics:", error);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
