import { spawn } from "child_process";

export type CliResult = {
  stdout: string;
  stderr: string;
};

export type CliOptions = {
  timeoutMs: number;
  maxOutputBytes: number;
};

function collectUtf8(buffered: Buffer[]): string {
  return Buffer.concat(buffered).toString("utf8");
}

export function executeWeztermCli(
  weztermCliPath: string,
  args: string[],
  options: CliOptions
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(weztermCliPath, ["cli", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let finished = false;

    const finish = (handler: () => void): void => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timer);
      handler();
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(() => {
        reject(
          new Error(
            `WezTerm CLI timed out after ${options.timeoutMs}ms for args: ${args.join(
              " "
            )}`
          )
        );
      });
    }, options.timeoutMs);

    const maxBytes = options.maxOutputBytes;
    const onData =
      (target: Buffer[], counter: "stdoutBytes" | "stderrBytes") =>
      (chunk: Buffer | string): void => {
        const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
        if (counter === "stdoutBytes") {
          stdoutBytes += value.length;
          if (stdoutBytes > maxBytes) {
            child.kill("SIGTERM");
            finish(() => {
              reject(
                new Error(
                  `WezTerm CLI stdout exceeded ${maxBytes} bytes for args: ${args.join(
                    " "
                  )}`
                )
              );
            });
            return;
          }
        } else {
          stderrBytes += value.length;
          if (stderrBytes > maxBytes) {
            child.kill("SIGTERM");
            finish(() => {
              reject(
                new Error(
                  `WezTerm CLI stderr exceeded ${maxBytes} bytes for args: ${args.join(
                    " "
                  )}`
                )
              );
            });
            return;
          }
        }

        target.push(value);
      };

    child.stdout?.on("data", onData(stdoutChunks, "stdoutBytes"));
    child.stderr?.on("data", onData(stderrChunks, "stderrBytes"));

    child.on("error", (error) => {
      finish(() => reject(error));
    });

    child.on("close", (code, signal) => {
      const stdout = collectUtf8(stdoutChunks);
      const stderr = collectUtf8(stderrChunks);

      finish(() => {
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(
          new Error(
            stderr ||
              `WezTerm CLI exited with code ${code ?? "unknown"} and signal ${
                signal ?? "none"
              }`
          )
        );
      });
    });
  });
}

export async function runStartupDiagnostics(
  weztermCliPath: string,
  timeoutMs: number,
  maxOutputBytes: number
): Promise<{ versionOk: boolean; muxOk: boolean; notes: string[] }> {
  const notes: string[] = [];
  let versionOk = false;
  let muxOk = false;

  try {
    await new Promise<CliResult>((resolve, reject) => {
      const child = spawn(weztermCliPath, ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error("Timed out probing wezterm --version"));
      }, timeoutMs);

      child.stdout?.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
      child.stderr?.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
      child.on("error", reject);
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve({
            stdout: collectUtf8(stdout),
            stderr: collectUtf8(stderr),
          });
          return;
        }

        reject(new Error(collectUtf8(stderr) || "wezterm --version failed"));
      });
    });
    versionOk = true;
  } catch (error) {
    notes.push(`cli_check_failed=${String(error)}`);
  }

  try {
    await executeWeztermCli(weztermCliPath, ["list"], {
      timeoutMs: Math.min(timeoutMs, 5_000),
      maxOutputBytes,
    });
    muxOk = true;
  } catch (error) {
    notes.push(`mux_check_failed=${String(error)}`);
  }

  return { versionOk, muxOk, notes };
}
