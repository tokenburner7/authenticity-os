import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const CLI = "src/index.ts";
const PROJECT = join(new URL("..", import.meta.url).pathname);

// Use a unique temp dir per test to avoid collisions
let tempStorePath: string;

afterEach(() => {
  if (tempStorePath && existsSync(tempStorePath)) {
    rmSync(tempStorePath, { force: true });
  }
});

function makeTempPath(): string {
  const dir = join(tmpdir(), `auth-cli-test-${randomBytes(8).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  tempStorePath = join(dir, "store.json");
  return tempStorePath;
}

function run(args: string, opts?: { cwd?: string }): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execSync(`npx tsx ${CLI} ${args}`, {
      cwd: opts?.cwd ?? PROJECT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", status: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      status: e.status ?? 1,
    };
  }
}

describe("auth identity", () => {
  it("creates an identity with --handle and saves to store", () => {
    const storePath = makeTempPath();
    const result = run(`identity create --handle alice --store ${storePath}`);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("alice");
    expect(result.stdout).toContain("Identity created");

    // The store file should now exist on disk
    expect(existsSync(storePath)).toBe(true);

    const data = JSON.parse(readFileSync(storePath, "utf-8")) as {
      identity?: {
        id: string;
        handle: string;
        secretKey: string;
        assurance: string;
        createdAt: string;
      };
    };
    expect(data.identity).toBeDefined();
    expect(data.identity!.handle).toBe("alice");
    expect(data.identity!.id).toMatch(/^[0-9a-f]{64}$/);
    expect(data.identity!.secretKey).toMatch(/^[0-9a-f]{64}$/);
    expect(data.identity!.assurance).toBe("peer");
    expect(data.identity!.createdAt).toBeDefined();
  });

  it("creates with a custom assurance level", () => {
    const storePath = makeTempPath();
    const result = run(
      `identity create --handle bob --assurance social --store ${storePath}`
    );

    expect(result.status).toBe(0);
    const data = JSON.parse(readFileSync(storePath, "utf-8")) as {
      identity?: { assurance: string };
    };
    expect(data.identity!.assurance).toBe("social");
  });

  it("shows the identity from the store", () => {
    const storePath = makeTempPath();

    // First create
    const createResult = run(`identity create --handle carol --store ${storePath}`);
    expect(createResult.status).toBe(0);

    // Then show
    const showResult = run(`identity show --store ${storePath}`);
    expect(showResult.status).toBe(0);
    expect(showResult.stdout).toContain("carol");

    const data = JSON.parse(readFileSync(storePath, "utf-8")) as {
      identity?: { id: string; secretKey: string };
    };
    expect(showResult.stdout).toContain(data.identity!.id);
    expect(showResult.stdout).toContain("Identity Anchor");
    // Secret key should not appear in the show output
    expect(showResult.stdout).not.toContain(data.identity!.secretKey);
  });

  it("fails with a helpful message when no identity exists", () => {
    const storePath = makeTempPath();
    const showResult = run(`identity show --store ${storePath}`);
    expect(showResult.status).not.toBe(0);
    expect(showResult.stderr).toContain("No identity found");
  });

  it("rejects an invalid assurance level", () => {
    const storePath = makeTempPath();
    const result = run(
      `identity create --handle dave --assurance bogus --store ${storePath}`
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Invalid assurance");
    expect(existsSync(storePath)).toBe(false);
  });
});
