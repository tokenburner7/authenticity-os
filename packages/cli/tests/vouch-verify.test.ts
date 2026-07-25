import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { SqliteStore } from "@auth/protocol";

const CLI = "src/index.ts";
const PROJECT = join(import.meta.dirname, "..");

let tempDir: string;

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = join(tmpdir(), `auth-cli-vouch-${randomBytes(8).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  tempDir = dir;
  return dir;
}

function run(
  args: string,
  opts?: { cwd?: string; input?: string },
): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execSync(`npx tsx ${CLI} ${args}`, {
      cwd: opts?.cwd ?? PROJECT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      input: opts?.input,
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

/**
 * Parse the "ID: <hex>" line from `auth identity create` / `auth identity show` output.
 */
function parseId(stdout: string): string {
  const m = stdout.match(/ID:\s+([0-9a-f]+)/i);
  if (!m) throw new Error(`Could not parse ID from output:\n${stdout}`);
  return m[1];
}

function dbPath(dir: string): string {
  return join(dir, "auth.db");
}

describe("auth vouch → reputation → verify flow", () => {
  it("alice vouches for bob, bob has reputation > 0, and alice's credential verifies", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);

    // 1. Create alice identity
    const aliceResult = run(`identity create --handle alice --db ${db}`);
    expect(aliceResult.status).toBe(0);
    const aliceId = parseId(aliceResult.stdout);
    expect(aliceId).toMatch(/^[0-9a-f]{64}$/);

    // 2. Create bob identity in a separate db, capture bob's id
    const bobDb = join(dir, "bob.db");
    const bobResult = run(`identity create --handle bob --db ${bobDb}`);
    expect(bobResult.status).toBe(0);
    const bobId = parseId(bobResult.stdout);
    expect(bobId).toMatch(/^[0-9a-f]{64}$/);

    // 3. Alice vouches for bob
    const vouchResult = run(`vouch --target ${bobId} --db ${db}`);
    expect(vouchResult.status).toBe(0);

    const vouchCred = JSON.parse(vouchResult.stdout) as {
      payload: { type: string; subject: { targetId: string } };
      signature: string;
      signer: string;
    };
    expect(vouchCred.payload.type).toBe("vouch");
    expect(vouchCred.payload.subject.targetId).toBe(bobId);
    expect(vouchCred.signer).toBe(aliceId);
    expect(vouchCred.signature).toMatch(/^[0-9a-f]+$/);

    // The vouch should be saved in the database (as a credential of type 'vouch')
    const store = new SqliteStore(db);
    const credentials = store.loadAllCredentials();
    const vouches = store.getVouchesFor(bobId);
    store.close();
    expect(credentials.length).toBe(1);
    expect(vouches.length).toBe(1);

    // 4. Reputation show for bob — should be > 0 (1 vouch → 100*(1-e^(-1/5)) ≈ 18)
    const repResult = run(`reputation show --identity ${bobId} --db ${db}`);
    expect(repResult.status).toBe(0);
    expect(repResult.stdout).toContain("Reputation Record");
    expect(repResult.stdout).toContain(bobId);

    // Parse overall score
    const repMatch = repResult.stdout.match(/Overall:\s+(\d+)/);
    expect(repMatch).not.toBeNull();
    const overall = parseInt(repMatch![1], 10);
    expect(overall).toBeGreaterThan(0);

    // 5. Attest content as alice
    const attestResult = run(
      `attest --content "Hello world from alice" --db ${db}`,
    );
    expect(attestResult.status).toBe(0);
    const attestCred = JSON.parse(attestResult.stdout) as {
      payload: { type: string; subject: { contentHash: string } };
      signature: string;
      signer: string;
    };
    expect(attestCred.payload.type).toBe("creation");
    expect(attestCred.signer).toBe(aliceId);
    expect(attestCred.payload.subject.contentHash).toMatch(/^[0-9a-f]+$/);

    // alice's credential is now at index 1 (vouch is at index 0)
    // 6. Verify the attest credential
    const verifyResult = run(
      `verify --index 1 --db ${db}`,
    );
    expect(verifyResult.status).toBe(0);
    const verifyOut = JSON.parse(verifyResult.stdout) as {
      status: string;
      message: string;
      credential?: { payload: { type: string } };
    };
    expect(verifyOut.status).toBe("valid");
    expect(verifyOut.credential).toBeDefined();
    expect(verifyOut.credential!.payload.type).toBe("creation");
  });

  it("verify with --min-reputation rejects an unknown issuer", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);

    // Create an identity and attest
    const createResult = run(`identity create --handle carol --db ${db}`);
    expect(createResult.status).toBe(0);

    const attestResult = run(
      `attest --content "carol content" --db ${db}`,
    );
    expect(attestResult.status).toBe(0);

    // Verify with a high min-reputation — carol has no vouches, so unknown-issuer
    const verifyResult = run(
      `verify --index 0 --min-reputation 50 --db ${db}`,
    );
    expect(verifyResult.status).toBe(0);
    const out = JSON.parse(verifyResult.stdout) as { status: string };
    expect(out.status).toBe("unknown-issuer");
  });

  it("verify --file reads a credential from disk", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);

    // Create identity + attest
    const createResult = run(`identity create --handle dave --db ${db}`);
    expect(createResult.status).toBe(0);

    const attestResult = run(
      `attest --content "dave content" --db ${db}`,
    );
    expect(attestResult.status).toBe(0);

    // Write the credential to a file
    const credFile = join(dir, "cred.json");
    writeFileSync(credFile, attestResult.stdout);

    // Verify from file (no --db needed for reputation lookup since file path is given)
    const verifyResult = run(`verify --file ${credFile}`);
    expect(verifyResult.status).toBe(0);
    const out = JSON.parse(verifyResult.stdout) as { status: string };
    expect(out.status).toBe("valid");
  });

  it("vouch fails with a helpful message when no identity exists", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);

    const vouchResult = run(`vouch --target ${"a".repeat(64)} --db ${db}`);
    expect(vouchResult.status).not.toBe(0);
    expect(vouchResult.stderr).toContain("No identity found");
  });

  it("reputation show reports no record for an unknown identity", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);

    const repResult = run(
      `reputation show --identity ${"b".repeat(64)} --db ${db}`,
    );
    expect(repResult.status).toBe(0);
    expect(repResult.stdout.toLowerCase()).toContain("no reputation");
  });

  it("verify fails with helpful message when database has no credentials", () => {
    const dir = makeTempDir();
    const db = dbPath(dir);

    const verifyResult = run(`verify --db ${db}`);
    expect(verifyResult.status).not.toBe(0);
    expect(verifyResult.stderr).toContain("No credentials");
  });
});
