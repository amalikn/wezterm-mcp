import WeztermExecutor from "../src/wezterm_executor";
import WeztermOutputReader from "../src/wezterm_output_reader";
import SendControlCharacter from "../src/send_control_character";
import { RuntimePolicy } from "../src/config";

function createPolicy(overrides?: Partial<RuntimePolicy>): RuntimePolicy {
  return {
    weztermCliPath: "wezterm",
    writeEnabled: true,
    controlEnabled: true,
    allowedPanes: new Set<number>(),
    allowedCommands: [],
    defaultReadLines: 50,
    maxLines: 500,
    timeoutMs: 30_000,
    maxOutputBytes: 1024 * 1024,
    auditLogPath: "/tmp/wezterm-mcp-test-audit.log",
    ...overrides,
  };
}

describe("Integration Tests", () => {
  it("supports write, read, and control operations through the shared CLI runner contract", async () => {
    const cliCalls: string[][] = [];
    const runner = async (
      _weztermCliPath: string,
      args: string[],
      _options: { timeoutMs: number; maxOutputBytes: number }
    ) => {
      cliCalls.push(args);
      if (args[0] === "get-text") {
        return { stdout: "hello\n", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    };

    const policy = createPolicy();
    const executor = new WeztermExecutor(policy, runner);
    const outputReader = new WeztermOutputReader(policy, runner);
    const controlCharSender = new SendControlCharacter(policy, runner);

    const writeResult = await executor.writeToTerminal('echo "hello"');
    const readResult = await outputReader.readOutput(10);
    const controlResult = await controlCharSender.send("c");

    expect(writeResult.isError).toBeUndefined();
    expect(readResult.content[0].text).toBe("hello\n");
    expect(controlResult.content[0].text).toBe("Sent control character: Ctrl+C");
    expect(cliCalls).toEqual([
      ["send-text", "--no-paste", 'echo "hello"\n'],
      ["get-text", "--escapes", "--start-line", "-10"],
      ["send-text", "\x03"],
    ]);
  });
});
