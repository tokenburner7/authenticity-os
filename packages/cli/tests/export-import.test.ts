import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import {
  existsSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { SqliteStore, issueCredential, contentHash } from "@auth/protocol";

const CLI = "src/index.ts";
const PROJECT = join(new URL("..", import.meta.url).pathname);

let tempPaths: string[] = [];

afterEach(() => {
  for (const p of tempPaths) {
    if (p && existsSync(p)) rmSync(p, { force: true, recursive: true });
  }
  tempPaths = [];
});

function makeTempDir(): string {
  const dir = join(tmpdir(), `auth-cli-test-${randomBytes(8).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  tempPaths.push(dir);
  return dir;
}

function run(
  args: string,
  opts?: { cwd?: string },
): { stdout: string; stderr: string; status: number } {
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

describe("auth export", () => {
  it("exports a credential as W3C VC JSON", () => {
    const dir = makeTempDir();
    const db = join(dir, "auth.db");

    // set up: create identity + attest content
    run(`identity create --handle alice --db ${db}`);
    run(`attest --content "my original post" --db ${db}`);

    const result = run(`export --db ${db}`);
    expect(result.status).toBe(0);

    const vc = JSON.parse(result.stdout) as {
      "@context": string[];
      type: string[];
      issuer: string;
      issuanceDate: string;
      credentialSubject: {
        type: string;
        contentHash: string;
        aiAssistance: string;
      };
      proof: {
        type: string;
        verificationMethod: string;
        proofValue: string;
        nonce: string;
      };
    };

    expect(vc["@context"]).toContain(
      "https://www.w3.org/2018/credentials/v1",
    );
    expect(vc.type).toEqual(["VerifiableCredential", "creation"]);
    expect(vc.proof.type).toBe("Ed25519Signature2018");
    expect(vc.proof.proofValue).toMatch(/^[0-9a-f]+$/);
    expect(vc.proof.nonce).toMatch(/^[0-9a-f]+$/);
  });

  it("uses --index to select a specific credential", () => {
    const dir = makeTempDir();
    const db = join(dir, "auth.db");

    run(`identity create --handle alice --db ${db}`);
    run(`attest --content "first" --db ${db}`);
    run(`attest --content "second" --db ${db}`);

    const store = new SqliteStore(db);
    const credentials = store.loadAllCredentials();
    store.close();
    expect(credentials.length).toBe(2);

    // export index 1 — should be the second credential
    const result = run(`export --index 1 --db ${db}`);
    expect(result.status).toBe(0);

    const vc = JSON.parse(result.stdout) as {
      credentialSubject: { contentHash: string };
    };
    expect(vc.credentialSubject.contentHash).toBe(
      credentials[1].payload.subject.contentHash,
    );
  });

  it("fails when no credentials exist in database", () => {
    const dir = makeTempDir();
    const db = join(dir, "auth.db");
    run(`identity create --handle alice --db ${db}`);

    const result = run(`export --db ${db}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("No credentials");
  });

  it("fails when index is out of range", () => {
    const dir = makeTempDir();
    const db = join(dir, "auth.db");
    run(`identity create --handle alice --db ${db}`);
    run(`attest --content "only one" --db ${db}`);

    const result = run(`export --index 5 --db ${db}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("out of range");
  });

  it("rejects unsupported format", () => {
    const dir = makeTempDir();
    const db = join(dir, "auth.db");
    run(`identity create --handle alice --db ${db}`);
    run(`attest --content "content" --db ${db}`);

    const result = run(`export --format jwt --db ${db}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unsupported format");
  });
});

describe("auth import", () => {
  it("imports a W3C VC file and saves it to the database", () => {
    const dir = makeTempDir();
    const db = join(dir, "auth.db");
    const vcFile = join(dir, "vc.json");

    // Set up an export to produce a valid W3C VC file
    const sourceDb = join(dir, "source.db");
    run(`identity create --handle alice --db ${sourceDb}`);
    run(`attest --content "exported content" --db ${sourceDb}`);
    const exportResult = run(`export --db ${sourceDb}`);
    writeFileSync(vcFile, exportResult.stdout);

    // Import into a fresh database
    const result = run(`import --file ${vcFile} --db ${db}`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Credential imported");

    const store = new SqliteStore(db);
    const credentials = store.loadAllCredentials();
    store.close();

    expect(credentials.length).toBe(1);
    expect(credentials[0].payload.type).toBe("creation");
    // signature + signer carried through
    expect(credentials[0].signature).toMatch(/^[0-9a-f]+$/);
  });

  it("appends to existing credentials without overwriting", () => {
    const dir = makeTempDir();
    const db = join(dir, "auth.db");
    const vcFile = join(dir, "vc.json");

    // source credential
    const sourceDb = join(dir, "source.db");
    run(`identity create --handle alice --db ${sourceDb}`);
    run(`attest --content "first" --db ${sourceDb}`);
    const exportResult = run(`export --db ${sourceDb}`);
    writeFileSync(vcFile, exportResult.stdout);

    // target database already has one credential
    run(`identity create --handle bob --db ${db}`);
    run(`attest --content "existing" --db ${db}`);

    const storeBefore = new SqliteStore(db);
    expect(storeBefore.loadAllCredentials().length).toBe(1);
    storeBefore.close();

    const result = run(`import --file ${vcFile} --db ${db}`);
    expect(result.status).toBe(0);

    const storeAfter = new SqliteStore(db);
    expect(storeAfter.loadAllCredentials().length).toBe(2);
    storeAfter.close();
  });

  it("fails when file does not exist", () => {
    const dir = makeTempDir();
    const db = join(dir, "auth.db");
    const missing = join(dir, "nope.json");

    const result = run(`import --file ${missing} --db ${db}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Error");
  });

  it("fails when file is not a valid W3C VC", () => {
    const dir = makeTempDir();
    const db = join(dir, "auth.db");
    const badFile = join(dir, "bad.json");
    writeFileSync(badFile, JSON.stringify({ hello: "world" }));

    const result = run(`import --file ${badFile} --db ${db}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("does not look like a W3C");
  });

  it("fails when --file is not provided", () => {
    const dir = makeTempDir();
    const db = join(dir, "auth.db");

    const result = run(`import --db ${db}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--file");
  });
});

describe("auth export → import round-trip via CLI", () => {
  it("exported VC imports back and remains signature-verifiable", () => {
    const dir = makeTempDir();
    const sourceDb = join(dir, "source.db");
    const vcFile = join(dir, "vc.json");
    const destDb = join(dir, "dest.db");

    // 1. Create identity + credential
    run(`identity create --handle alice --db ${sourceDb}`);
    run(
      `attest --content "round-trip content" --evidence screenshot --db ${sourceDb}`,
    );

    // 2. Export to W3C VC file
    const exportResult = run(`export --db ${sourceDb}`);
    expect(exportResult.status).toBe(0);
    writeFileSync(vcFile, exportResult.stdout);

    // 3. Import into a new database
    const importResult = run(`import --file ${vcFile} --db ${destDb}`);
    expect(importResult.status).toBe(0);

    // 4. Verify the imported credential structurally matches the original
    const sourceStore = new SqliteStore(sourceDb);
    const sourceCreds = sourceStore.loadAllCredentials();
    sourceStore.close();

    const destStore = new SqliteStore(destDb);
    const destCreds = destStore.loadAllCredentials();
    destStore.close();

    expect(destCreds.length).toBe(1);
    expect(destCreds[0].signature).toBe(sourceCreds[0].signature);
    expect(destCreds[0].signer).toBeDefined();
  });

  it("exported VC with expiresAt survives the round-trip", () => {
    // The CLI attest path doesn't set expiresAt directly, so we exercise it
    // via the protocol library by crafting a credential directly in the DB.
    const dir = makeTempDir();
    const sourceDb = join(dir, "source.db");
    const vcFile = join(dir, "vc.json");
    const destDb = join(dir, "dest.db");

    // Create identity normally, then inject a credential with expiresAt
    run(`identity create --handle alice --db ${sourceDb}`);
    const store = new SqliteStore(sourceDb);
    const identity = store.loadAllIdentities()[0];

    // Build a credential using the protocol library directly
    const credential = issueCredential(
      "creation",
      identity,
      {
        contentHash: contentHash("expiring"),
        aiAssistance: "none",
      },
      { expiresIn: 3600 },
    );
    store.saveCredential(credential);
    store.close();

    // Export → import
    const exportResult = run(`export --db ${sourceDb}`);
    expect(exportResult.status).toBe(0);
    const vc = JSON.parse(exportResult.stdout) as {
      expirationDate?: string;
    };
    expect(vc.expirationDate).toBeDefined();
    writeFileSync(vcFile, exportResult.stdout);

    const importResult = run(`import --file ${vcFile} --db ${destDb}`);
    expect(importResult.status).toBe(0);

    const destStore = new SqliteStore(destDb);
    const destCreds = destStore.loadAllCredentials();
    destStore.close();
    expect(destCreds[0].payload.expiresAt).toBe(vc.expirationDate);
  });
});
