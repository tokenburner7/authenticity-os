import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { SqliteStore } from "@auth/protocol";

const CLI = "src/index.ts";
const PROJECT = join(new URL("..", import.meta.url).pathname);

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

describe("auth attest", () => {
  it("creates an identity then attests content and saves credential to database", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);

    // First create an identity
    const createResult = run(`identity create --handle alice --db ${db}`);
    expect(createResult.status).toBe(0);

    // Now attest content
    const attestResult = run(
      `attest --content "My original human-written post" --ai-assistance none --evidence screenshot --db ${db}`,
    );
    expect(attestResult.status).toBe(0);

    // Parse the printed credential JSON
    const credential = JSON.parse(attestResult.stdout) as {
      payload: {
        type: string;
        issuer: string;
        subject: { contentHash: string; aiAssistance: string; evidence?: string };
      };
      signature: string;
      signer: string;
    };

    expect(credential.payload.type).toBe("creation");
    expect(credential.payload.subject.aiAssistance).toBe("none");
    expect(credential.payload.subject.evidence).toBe("screenshot");
    expect(credential.payload.subject.contentHash).toMatch(/^[0-9a-f]+$/);

    // Verify the credential was saved to the database
    const store = new SqliteStore(db);
    const identity = store.loadAllIdentities()[0];
    const credentials = store.loadAllCredentials();
    store.close();

    expect(identity).toBeDefined();
    expect(credential.payload.issuer).toBe(identity.id);
    expect(credential.signer).toBe(identity.id);

    expect(credentials.length).toBe(1);
    expect(credentials[0].payload.type).toBe("creation");
  });

  it("uses default ai-assistance level of none", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);
    run(`identity create --handle bob --db ${db}`);

    const attestResult = run(
      `attest --content "some content" --db ${db}`,
    );
    expect(attestResult.status).toBe(0);

    const credential = JSON.parse(attestResult.stdout) as {
      payload: { subject: { aiAssistance: string } };
    };
    expect(credential.payload.subject.aiAssistance).toBe("none");
  });

  it("fails when no identity exists in database", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);
    const result = run(
      `attest --content "content" --db ${db}`,
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("No identity");
  });

  it("rejects invalid AI assistance level", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);
    run(`identity create --handle carol --db ${db}`);

    const result = run(
      `attest --content "content" --ai-assistance bogus --db ${db}`,
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Invalid AI assistance");
  });

  it("attests with ai-assisted level", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);
    run(`identity create --handle dave --db ${db}`);

    const result = run(
      `attest --content "AI helped with this" --ai-assistance ai-assisted --db ${db}`,
    );
    expect(result.status).toBe(0);
    const credential = JSON.parse(result.stdout) as {
      payload: { subject: { aiAssistance: string } };
    };
    expect(credential.payload.subject.aiAssistance).toBe("ai-assisted");
  });
});

describe("auth vouch", () => {
  it("vouches for another identity and saves to database", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);

    // Create vouching identity
    run(`identity create --handle alice --db ${db}`);

    // Create a target identity in a separate db just to get an id
    const targetDir = makeTempDir();
    const targetDb = dbPath(targetDir);
    run(`identity create --handle bob --db ${targetDb}`);
    const targetStore = new SqliteStore(targetDb);
    const targetId = targetStore.loadAllIdentities()[0].id;
    targetStore.close();

    // Vouch
    const result = run(
      `vouch --target ${targetId} --evidence "known 5 years" --db ${db}`,
    );
    expect(result.status).toBe(0);

    const credential = JSON.parse(result.stdout) as {
      payload: { type: string; subject: { targetId: string; evidence?: string } };
    };
    expect(credential.payload.type).toBe("vouch");
    expect(credential.payload.subject.targetId).toBe(targetId);
    expect(credential.payload.subject.evidence).toBe("known 5 years");

    // Verify saved in database — vouch is stored as a credential of type 'vouch'
    const store = new SqliteStore(db);
    const credentials = store.loadAllCredentials();
    const vouches = store.getVouchesFor(targetId);
    store.close();

    expect(credentials.length).toBe(1);
    expect(credentials[0].payload.type).toBe("vouch");
    expect(vouches.length).toBe(1);
  });
});

describe("auth reputation show", () => {
  it("shows reputation record for a vouched identity", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);

    // Create identity A (self) — issuer of the vouch
    run(`identity create --handle alice --db ${db}`);

    // Create a target identity in a separate db
    const targetDir = makeTempDir();
    const targetDb = dbPath(targetDir);
    run(`identity create --handle bob --db ${targetDb}`);
    const targetStore = new SqliteStore(targetDb);
    const targetId = targetStore.loadAllIdentities()[0].id;
    targetStore.close();

    // alice vouches for bob
    run(`vouch --target ${targetId} --db ${db}`);

    // Show reputation for bob (the target)
    const result = run(
      `reputation show --identity ${targetId} --db ${db}`,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Reputation Record");
    expect(result.stdout).toContain(targetId);
    // One vouch → social-trust score > 0
    expect(result.stdout).toMatch(/social-trust.*score=[1-9]/);
  });

  it("reports no reputation record when identity has no vouches", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);
    run(`identity create --handle carol --db ${db}`);
    const store = new SqliteStore(db);
    const identityId = store.loadAllIdentities()[0].id;
    store.close();

    const result = run(
      `reputation show --identity ${identityId} --db ${db}`,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No reputation record");
  });
});
