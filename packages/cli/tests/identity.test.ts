import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { SqliteStore } from "@auth/protocol";

const CLI = "src/index.ts";
const PROJECT = join(new URL("..", import.meta.url).pathname);

// Use a unique temp dir per test to avoid collisions
let tempDir: string;

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

function makeTempDir(): string {
  const dir = join(tmpdir(), `auth-cli-test-${randomBytes(8).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  tempDir = dir;
  return dir;
}

function dbPath(dir: string): string {
  return join(dir, "auth.db");
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
  it("creates an identity with --handle and saves to database", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);
    const result = run(`identity create --handle alice --db ${db}`);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("alice");
    expect(result.stdout).toContain("Identity created");

    // The database file should now exist on disk
    expect(existsSync(db)).toBe(true);

    const store = new SqliteStore(db);
    const identities = store.loadAllIdentities();
    store.close();

    expect(identities.length).toBe(1);
    const identity = identities[0];
    expect(identity.handle).toBe("alice");
    expect(identity.id).toMatch(/^[0-9a-f]{64}$/);
    expect(identity.secretKey).toMatch(/^[0-9a-f]{64}$/);
    expect(identity.assurance).toBe("peer");
    expect(identity.createdAt).toBeDefined();
  });

  it("creates with a custom assurance level", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);
    const result = run(
      `identity create --handle bob --assurance social --db ${db}`,
    );

    expect(result.status).toBe(0);
    const store = new SqliteStore(db);
    const identity = store.loadAllIdentities()[0];
    store.close();
    expect(identity.assurance).toBe("social");
  });

  it("shows the identity from the database", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);

    // First create
    const createResult = run(`identity create --handle carol --db ${db}`);
    expect(createResult.status).toBe(0);

    // Then show
    const showResult = run(`identity show --db ${db}`);
    expect(showResult.status).toBe(0);
    expect(showResult.stdout).toContain("carol");

    const store = new SqliteStore(db);
    const identity = store.loadAllIdentities()[0];
    store.close();
    expect(showResult.stdout).toContain(identity.id);
    expect(showResult.stdout).toContain("Identity Anchor");
    // Secret key should not appear in the show output
    expect(showResult.stdout).not.toContain(identity.secretKey);
  });

  it("fails with a helpful message when no identity exists", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);
    const showResult = run(`identity show --db ${db}`);
    expect(showResult.status).not.toBe(0);
    expect(showResult.stderr).toContain("No identity found");
  });

  it("rejects an invalid assurance level", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);
    const result = run(
      `identity create --handle dave --assurance bogus --db ${db}`,
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Invalid assurance");
    // On failure the DB may have been created (empty) — assert no identity stored
    const store = new SqliteStore(db);
    const identities = store.loadAllIdentities();
    store.close();
    expect(identities.length).toBe(0);
  });
});
