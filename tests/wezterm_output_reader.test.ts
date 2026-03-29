import WeztermOutputReader from "../src/wezterm_output_reader";
import { RuntimePolicy } from "../src/config";

function createPolicy(overrides?: Partial<RuntimePolicy>): RuntimePolicy {
  return {
    weztermCliPath: "wezterm",
    writeEnabled: false,
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

describe("WeztermOutputReader", () => {
  let calls: string[][];

  beforeEach(() => {
    calls = [];
  });

  function createReader(
    policyOverrides?: Partial<RuntimePolicy>,
    implementation?: (args: string[]) => Promise<{ stdout: string; stderr: string }>
  ): WeztermOutputReader {
    return new WeztermOutputReader(
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

  it("reads the requested number of lines", async () => {
    const reader = createReader(undefined, async () => ({
      stdout: "line1\nline2\n",
      stderr: "",
    }));

    const result = await reader.readOutput(25);

    expect(result.content[0].text).toBe("line1\nline2\n");
    expect(calls[0]).toEqual(["get-text", "--escapes", "--start-line", "-25"]);
  });

  it("uses the configured default read size", async () => {
    const reader = createReader({ defaultReadLines: 12 }, async () => ({
      stdout: "default output",
      stderr: "",
    }));

    const result = await reader.readOutput();

    expect(result.content[0].text).toBe("default output");
    expect(calls[0]).toEqual(["get-text", "--escapes", "--start-line", "-12"]);
  });

  it("rejects invalid line counts", async () => {
    const reader = createReader();

    const result = await reader.readOutput(0);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("lines must be a positive integer");
    expect(calls).toHaveLength(0);
  });

  it("rejects reads above the configured limit", async () => {
    const reader = createReader({ maxLines: 40 });

    const result = await reader.readOutput(41);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("configured limit of 40");
    expect(calls).toHaveLength(0);
  });

  it('returns "(empty output)" when the pane output is empty', async () => {
    const reader = createReader();

    const result = await reader.readOutput(10);

    expect(result.content[0].text).toBe("(empty output)");
  });
});
