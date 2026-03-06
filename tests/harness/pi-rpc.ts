/**
 * Pi RPC client — spawns a real Pi process in RPC mode, sends commands,
 * and collects JSON event stream output for test assertions.
 *
 * Used by runtime tests to drive a real Pi coding agent with the GSD extension loaded.
 */

import { spawn, ChildProcess, execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RpcEvent {
  type: string;
  [key: string]: any;
}

export interface ToolExecution {
  toolCallId: string;
  toolName: string;
  args?: Record<string, any>;
  result?: any;
  isError?: boolean;
}

export interface PiRpcSession {
  /** Send a JSON command to Pi's stdin */
  send(command: Record<string, any>): void;
  /** Wait for agent_end event (one full turn) with timeout */
  waitForTurn(timeoutMs?: number): Promise<RpcEvent[]>;
  /** Get all collected events so far */
  events(): RpcEvent[];
  /** Get tool_execution_start events */
  toolStarts(): RpcEvent[];
  /** Get tool_execution_end events */
  toolEnds(): RpcEvent[];
  /** Get extension_ui_request events */
  extensionUiRequests(): RpcEvent[];
  /** Get extension_error events */
  extensionErrors(): RpcEvent[];
  /** Kill the Pi process */
  kill(): void;
  /** Wait for process to exit */
  waitForExit(timeoutMs?: number): Promise<number | null>;
  /** The underlying child process */
  process: ChildProcess;
}

// ---------------------------------------------------------------------------
// Prerequisites check
// ---------------------------------------------------------------------------

/** Check all runtime prerequisites. Throws (fails test) if any missing. */
export function checkPrerequisites(): void {
  // 1. Pi binary must be available
  try {
    execSync("which pi", { stdio: "pipe" });
  } catch {
    throw new Error(
      "PREREQUISITE FAILED: 'pi' binary not found in PATH. " +
      "Install @mariozechner/pi-coding-agent globally."
    );
  }

  // 2. Node must be available
  try {
    execSync("which node", { stdio: "pipe" });
  } catch {
    throw new Error("PREREQUISITE FAILED: 'node' binary not found in PATH.");
  }

  // 3. Auth must be available (OAuth or API key)
  const authPath = path.join(os.homedir(), ".pi", "agent", "auth.json");
  const hasOAuth = fs.existsSync(authPath);
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  if (!hasOAuth && !hasApiKey) {
    throw new Error(
      "PREREQUISITE FAILED: No authentication available. " +
      "Either set ANTHROPIC_API_KEY or run 'pi' and use /login to authenticate."
    );
  }

  // 4. Extension source must exist
  const extPath = path.resolve(__dirname, "../../extensions/gsd");
  if (!fs.existsSync(extPath)) {
    throw new Error(
      `PREREQUISITE FAILED: GSD extension not found at ${extPath}`
    );
  }
}

// ---------------------------------------------------------------------------
// Temp workspace
// ---------------------------------------------------------------------------

export interface TempWorkspace {
  dir: string;
  /** Create a file relative to workspace root */
  writeFile(relPath: string, content: string): void;
  /** Read a file relative to workspace root */
  readFile(relPath: string): string;
  /** Check if file exists relative to workspace root */
  exists(relPath: string): boolean;
  /** Clean up the workspace */
  cleanup(): void;
}

/** Create an isolated temp workspace with optional .planning/ directory */
export function createTempWorkspace(opts?: { withPlanning?: boolean; withState?: boolean }): TempWorkspace {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-gsd-runtime-test-"));

  if (opts?.withPlanning) {
    fs.mkdirSync(path.join(dir, ".planning"), { recursive: true });
  }
  if (opts?.withState) {
    fs.mkdirSync(path.join(dir, ".planning"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".planning", "STATE.md"),
      "---\nphase: 1\nstatus: active\n---\n# Project State\n"
    );
  }

  return {
    dir,
    writeFile(relPath: string, content: string): void {
      const full = path.join(dir, relPath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    },
    readFile(relPath: string): string {
      return fs.readFileSync(path.join(dir, relPath), "utf-8");
    },
    exists(relPath: string): boolean {
      return fs.existsSync(path.join(dir, relPath));
    },
    cleanup(): void {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// ---------------------------------------------------------------------------
// RPC session
// ---------------------------------------------------------------------------

export interface SpawnOptions {
  cwd: string;
  /** Additional -e extension paths */
  extensions?: string[];
  /** Timeout for the overall process (ms) */
  processTimeoutMs?: number;
  /** Pi model to use */
  model?: string;
  /** Thinking level */
  thinking?: string;
}

/**
 * Spawn a Pi process in RPC mode with the GSD extension loaded.
 * Returns a session object for sending commands and collecting events.
 */
export function spawnPiRpc(opts: SpawnOptions): PiRpcSession {
  const extPath = path.resolve(__dirname, "../../extensions/gsd");
  const allExtensions = [extPath, ...(opts.extensions ?? [])];

  const args = [
    "--mode", "rpc",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--no-session",
    "--thinking", opts.thinking ?? "off",
  ];

  if (opts.model) {
    args.push("--model", opts.model);
  }

  for (const ext of allExtensions) {
    args.push("-e", ext);
  }

  const child = spawn("pi", args, {
    cwd: opts.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  const collectedEvents: RpcEvent[] = [];
  let turnResolve: ((events: RpcEvent[]) => void) | null = null;
  let turnEvents: RpcEvent[] = [];
  let processTimeout: ReturnType<typeof setTimeout> | null = null;

  if (opts.processTimeoutMs) {
    processTimeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, opts.processTimeoutMs);
  }

  // Parse JSONL from stdout
  const rl = readline.createInterface({ input: child.stdout! });
  rl.on("line", (line) => {
    try {
      const event: RpcEvent = JSON.parse(line);
      collectedEvents.push(event);
      turnEvents.push(event);

      // Resolve turn promise on agent_end
      if (event.type === "agent_end" && turnResolve) {
        const resolve = turnResolve;
        const events = [...turnEvents];
        turnResolve = null;
        turnEvents = [];
        resolve(events);
      }
    } catch {
      // Ignore non-JSON lines (stderr leaking, etc.)
    }
  });

  // Capture stderr for diagnostics
  const stderrChunks: string[] = [];
  child.stderr?.on("data", (chunk) => {
    stderrChunks.push(chunk.toString());
  });

  const session: PiRpcSession = {
    send(command: Record<string, any>): void {
      child.stdin!.write(JSON.stringify(command) + "\n");
    },

    waitForTurn(timeoutMs = 120_000): Promise<RpcEvent[]> {
      return new Promise((resolve, reject) => {
        // Check if we already have an agent_end in pending events
        const existingEnd = turnEvents.findIndex((e) => e.type === "agent_end");
        if (existingEnd >= 0) {
          const events = turnEvents.splice(0, existingEnd + 1);
          resolve(events);
          return;
        }

        const timer = setTimeout(() => {
          turnResolve = null;
          const stderr = stderrChunks.join("");
          reject(new Error(
            `Timeout waiting for agent turn (${timeoutMs}ms).\n` +
            `Collected ${collectedEvents.length} events.\n` +
            `Last event: ${JSON.stringify(collectedEvents[collectedEvents.length - 1]?.type)}\n` +
            `Stderr: ${stderr.slice(-500)}`
          ));
        }, timeoutMs);

        turnResolve = (events) => {
          clearTimeout(timer);
          resolve(events);
        };
      });
    },

    events(): RpcEvent[] {
      return [...collectedEvents];
    },

    toolStarts(): RpcEvent[] {
      return collectedEvents.filter((e) => e.type === "tool_execution_start");
    },

    toolEnds(): RpcEvent[] {
      return collectedEvents.filter((e) => e.type === "tool_execution_end");
    },

    extensionUiRequests(): RpcEvent[] {
      return collectedEvents.filter((e) => e.type === "extension_ui_request");
    },

    extensionErrors(): RpcEvent[] {
      return collectedEvents.filter((e) => e.type === "extension_error");
    },

    kill(): void {
      if (processTimeout) clearTimeout(processTimeout);
      child.kill("SIGTERM");
    },

    waitForExit(timeoutMs = 10_000): Promise<number | null> {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve(null);
        }, timeoutMs);

        child.on("exit", (code) => {
          clearTimeout(timer);
          resolve(code);
        });
      });
    },

    process: child,
  };

  return session;
}

/**
 * Helper: prompt Pi and wait for the turn to complete.
 * Returns all events from that turn.
 */
export async function promptAndWait(
  session: PiRpcSession,
  message: string,
  timeoutMs = 120_000,
): Promise<RpcEvent[]> {
  session.send({
    type: "prompt",
    id: `prompt-${Date.now()}`,
    message,
  });
  return session.waitForTurn(timeoutMs);
}

/**
 * Helper: extract the final assistant text from turn events.
 */
export function extractAssistantText(turnEvents: RpcEvent[]): string {
  const agentEnd = turnEvents.find((e) => e.type === "agent_end");
  if (!agentEnd?.messages) return "";

  const assistantMsg = agentEnd.messages.find((m: any) => m.role === "assistant");
  if (!assistantMsg?.content) return "";

  return assistantMsg.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("");
}
