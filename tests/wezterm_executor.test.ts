import WeztermExecutor from "../src/wezterm_executor";
import { RuntimePolicy } from "../src/config";

type CliCall = {
  args: string[];
  options: { timeoutMs: number; maxOutputBytes: number };
};

function createPolicy(overrides?: Partial<RuntimePolicy>): RuntimePolicy {
  return {
    weztermCliPath: "wezterm",
    writeEnabled: true,
    controlEnabled: false,
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

describe("WeztermExecutor", () => {
  let calls: CliCall[];

  beforeEach(() => {
    calls = [];
  });

  function createExecutor(
    policyOverrides?: Partial<RuntimePolicy>,
    implementation?: (args: string[]) => Promise<{ stdout: string; stderr: string }>
  ): WeztermExecutor {
    const policy = createPolicy(policyOverrides);
    return new WeztermExecutor(policy, async (_weztermCliPath, args, options) => {
      calls.push({ args, options });
      if (implementation) {
        return implementation(args);
      }
      return { stdout: "", stderr: "" };
    });
  }

  describe("writeToTerminal", () => {
    it("sends text using argv-safe wezterm cli arguments", async () => {
      const executor = createExecutor();

      const result = await executor.writeToTerminal('echo "hello"');

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Command sent to WezTerm: echo "hello"');
      expect(calls).toHaveLength(1);
      expect(calls[0].args).toEqual(["send-text", "--no-paste", 'echo "hello"\n']);
      expect(calls[0].options.timeoutMs).toBe(30_000);
    });

    it("fails closed when write policy is disabled", async () => {
      const executor = createExecutor({ writeEnabled: false });

      const result = await executor.writeToTerminal("pwd");

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("WEZTERM_MCP_ENABLE_WRITE=true");
      expect(calls).toHaveLength(0);
    });

    it("rejects commands outside the allowlist", async () => {
      const executor = createExecutor({
        allowedCommands: [{ raw: "pwd" }],
      });

      const result = await executor.writeToTerminal("ls");

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("WEZTERM_MCP_ALLOWED_COMMANDS");
      expect(calls).toHaveLength(0);
    });

    it("returns CLI failures as MCP errors", async () => {
      const executor = createExecutor(undefined, async () => {
        throw new Error("WezTerm not running");
      });

      const result = await executor.writeToTerminal('echo "hello"');

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("WezTerm not running");
    });
  });

  describe("writeToSpecificPane", () => {
    it("sends text to the requested pane", async () => {
      const executor = createExecutor();

      const result = await executor.writeToSpecificPane("ls -la", 123);

      expect(result.content[0].text).toBe("Command sent to pane 123: ls -la");
      expect(calls[0].args).toEqual([
        "send-text",
        "--pane-id",
        "123",
        "--no-paste",
        "ls -la\n",
      ]);
    });

    it("rejects pane ids outside the allowlist", async () => {
      const executor = createExecutor({ allowedPanes: new Set([7]) });

      const result = await executor.writeToSpecificPane("ls", 9);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not in WEZTERM_MCP_ALLOWED_PANES");
      expect(calls).toHaveLength(0);
    });

    it("rejects invalid pane ids", async () => {
      const executor = createExecutor();

      const result = await executor.writeToSpecificPane("ls", -1);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Pane ID must be a non-negative integer");
    });
  });

  describe("listPanes", () => {
    it("returns pane output", async () => {
      const paneList = `pane_id=1 active=true\npane_id=2 active=false`;
      const executor = createExecutor(undefined, async () => ({
        stdout: paneList,
        stderr: "",
      }));

      const result = await executor.listPanes();

      expect(result.content[0].text).toBe(paneList);
      expect(calls[0].args).toEqual(["list"]);
    });
  });

  describe("switchPane", () => {
    it("activates the requested pane", async () => {
      const executor = createExecutor();

      const result = await executor.switchPane(42);

      expect(result.content[0].text).toBe("Switched to pane 42");
      expect(calls[0].args).toEqual(["activate-pane", "--pane-id", "42"]);
    });

    it("rejects invalid pane ids", async () => {
      const executor = createExecutor();

      const result = await executor.switchPane(Number.NaN);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Pane ID must be a non-negative integer");
    });
  });
});
