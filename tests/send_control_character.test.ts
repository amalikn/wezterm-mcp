import SendControlCharacter from "../src/send_control_character";
import { RuntimePolicy } from "../src/config";

function createPolicy(overrides?: Partial<RuntimePolicy>): RuntimePolicy {
  return {
    weztermCliPath: "wezterm",
    writeEnabled: false,
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

describe("SendControlCharacter", () => {
  let calls: string[][];

  beforeEach(() => {
    calls = [];
  });

  function createSender(
    policyOverrides?: Partial<RuntimePolicy>,
    implementation?: (args: string[]) => Promise<{ stdout: string; stderr: string }>
  ): SendControlCharacter {
    return new SendControlCharacter(
      createPolicy(policyOverrides),
      async (_weztermCliPath, args, _options) => {
        calls.push(args);
        if (implementation) {
          return implementation(args);
        }
        return { stdout: "", stderr: "" };
      }
    );
  }

  it("sends Ctrl+C with argv-safe arguments", async () => {
    const sender = createSender();

    const result = await sender.send("c");

    expect(result.content[0].text).toBe("Sent control character: Ctrl+C");
    expect(calls[0]).toEqual(["send-text", "\x03"]);
  });

  it("accepts uppercase control keys", async () => {
    const sender = createSender();

    const result = await sender.send("Z");

    expect(result.content[0].text).toBe("Sent control character: Ctrl+Z");
    expect(calls[0]).toEqual(["send-text", "\x1a"]);
  });

  it("fails closed when control tools are disabled", async () => {
    const sender = createSender({ controlEnabled: false });

    const result = await sender.send("c");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("WEZTERM_MCP_ENABLE_CONTROL=true");
    expect(calls).toHaveLength(0);
  });

  it("rejects unsupported control characters", async () => {
    const sender = createSender();

    const result = await sender.send("j");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown control character: j");
    expect(calls).toHaveLength(0);
  });

  it("surfaces CLI failures as MCP errors", async () => {
    const sender = createSender(undefined, async () => {
      throw new Error("WezTerm not available");
    });

    const result = await sender.send("c");

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("WezTerm not available");
  });
});
