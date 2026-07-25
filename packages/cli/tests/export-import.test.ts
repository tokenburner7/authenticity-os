import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

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
    const storePath = join(dir, "store.json");

    // set up: create identity + attest content
    run(`identity create --handle alice --store ${storePath}`);
    run(`attest --content "my original post" --store ${storePath}`);

    const result = run(`export --store ${storePath}`);
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
    const storePath = join(dir, "store.json");

    run(`identity create --handle alice --store ${storePath}`);
    run(`attest --content "first" --store ${storePath}`);
    run(`attest --content "second" --store ${storePath}`);

    const store = JSON.parse(readFileSync(storePath, "utf-8")) as {
      credentials?: Array<{ payload: { subject: { contentHash: string } } }>;
    };
    expect(store.credentials?.length).toBe(2);

    // export index 1 — should be the second credential
    const result = run(`export --index 1 --store ${storePath}`);
    expect(result.status).toBe(0);

    const vc = JSON.parse(result.stdout) as {
      credentialSubject: { contentHash: string };
    };
    expect(vc.credentialSubject.contentHash).toBe(
      store.credentials![1].payload.subject.contentHash,
    );
  });

  it("fails when no credentials exist in store", () => {
    const dir = makeTempDir();
    const storePath = join(dir, "store.json");
    run(`identity create --handle alice --store ${storePath}`);

    const result = run(`export --store ${storePath}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("No credentials");
  });

  it("fails when index is out of range", () => {
    const dir = makeTempDir();
    const storePath = join(dir, "store.json");
    run(`identity create --handle alice --store ${storePath}`);
    run(`attest --content "only one" --store ${storePath}`);

    const result = run(`export --index 5 --store ${storePath}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("out of range");
  });

  it("rejects unsupported format", () => {
    const dir = makeTempDir();
    const storePath = join(dir, "store.json");
    run(`identity create --handle alice --store ${storePath}`);
    run(`attest --content "content" --store ${storePath}`);

    const result = run(`export --format jwt --store ${storePath}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unsupported format");
  });
});

describe("auth import", () => {
  it("imports a W3C VC file and saves it to the store", () => {
    const dir = makeTempDir();
    const storePath = join(dir, "store.json");
    const vcFile = join(dir, "vc.json");

    // Set up an export to produce a valid W3C VC file
    const sourceStore = join(dir, "source.json");
    run(`identity create --handle alice --store ${sourceStore}`);
    run(`attest --content "exported content" --store ${sourceStore}`);
    const exportResult = run(`export --store ${sourceStore}`);
    writeFileSync(vcFile, exportResult.stdout);

    // Import into a fresh store
    const result = run(`import --file ${vcFile} --store ${storePath}`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Credential imported");

    const data = JSON.parse(readFileSync(storePath, "utf-8")) as {
      credentials?: Array<{
        payload: {
          type: string;
          issuer: string;
          subject: { contentHash: string; aiAssistance: string };
        };
        signature: string;
        signer: string;
      }>;
    };

    expect(data.credentials).toBeDefined();
    expect(data.credentials!.length).toBe(1);
    expect(data.credentials![0].payload.type).toBe("creation");
    // signature + signer carried through
    expect(data.credentials![0].signature).toMatch(/^[0-9a-f]+$/);
  });

  it("appends to existing credentials without overwriting", () => {
    const dir = makeTempDir();
    const storePath = join(dir, "store.json");
    const vcFile = join(dir, "vc.json");

    // source credential
    const sourceStore = join(dir, "source.json");
    run(`identity create --handle alice --store ${sourceStore}`);
    run(`attest --content "first" --store ${sourceStore}`);
    const exportResult = run(`export --store ${sourceStore}`);
    writeFileSync(vcFile, exportResult.stdout);

    // target store already has one credential
    run(`identity create --handle bob --store ${storePath}`);
    run(`attest --content "existing" --store ${storePath}`);

    const before = JSON.parse(readFileSync(storePath, "utf-8")) as {
      credentials?: unknown[];
    };
    expect(before.credentials?.length).toBe(1);

    const result = run(`import --file ${vcFile} --store ${storePath}`);
    expect(result.status).toBe(0);

    const after = JSON.parse(readFileSync(storePath, "utf-8")) as {
      credentials?: unknown[];
    };
    expect(after.credentials?.length).toBe(2);
  });

  it("fails when file does not exist", () => {
    const dir = makeTempDir();
    const storePath = join(dir, "store.json");
    const missing = join(dir, "nope.json");

    const result = run(`import --file ${missing} --store ${storePath}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Error");
  });

  it("fails when file is not a valid W3C VC", () => {
    const dir = makeTempDir();
    const storePath = join(dir, "store.json");
    const badFile = join(dir, "bad.json");
    writeFileSync(badFile, JSON.stringify({ hello: "world" }));

    const result = run(`import --file ${badFile} --store ${storePath}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("does not look like a W3C");
  });

  it("fails when --file is not provided", () => {
    const dir = makeTempDir();
    const storePath = join(dir, "store.json");

    const result = run(`import --store ${storePath}`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--file");
  });
});

describe("auth export → import round-trip via CLI", () => {
  it("exported VC imports back and remains signature-verifiable", () => {
    const dir = makeTempDir();
    const sourceStore = join(dir, "source.json");
    const vcFile = join(dir, "vc.json");
    const destStore = join(dir, "dest.json");

    // 1. Create identity + credential
    run(`identity create --handle alice --store ${sourceStore}`);
    run(
      `attest --content "round-trip content" --evidence screenshot --store ${sourceStore}`,
    );

    // 2. Export to W3C VC file
    const exportResult = run(`export --store ${sourceStore}`);
    expect(exportResult.status).toBe(0);
    writeFileSync(vcFile, exportResult.stdout);

    // 3. Import into a new store
    const importResult = run(`import --file ${vcFile} --store ${destStore}`);
    expect(importResult.status).toBe(0);

    // 4. Verify the imported credential structurally matches the original
    const source = JSON.parse(readFileSync(sourceStore, "utf-8")) as {
      credentials?: Array<{ signature: string }>;
    };
    const dest = JSON.parse(readFileSync(destStore, "utf-8")) as {
      credentials?: Array<{ signature: string; signer: string }>;
    };

    expect(dest.credentials!.length).toBe(1);
    expect(dest.credentials![0].signature).toBe(source.credentials![0].signature);
    expect(dest.credentials![0].signer).toBeDefined();
  });

  it("exported VC with expiresAt survives the round-trip", async () => {
    // The CLI attest path doesn't set expiresAt directly, so we exercise it
    // via the protocol library by crafting a credential in the store.
    const dir = makeTempDir();
    const sourceStore = join(dir, "source.json");
    const vcFile = join(dir, "vc.json");
    const destStore = join(dir, "dest.json");

    // Create identity normally, then inject a credential with expiresAt
    run(`identity create --handle alice --store ${sourceStore}`);
    const data = JSON.parse(readFileSync(sourceStore, "utf-8")) as {
      identity: { id: string; secretKey: string };
      credentials: unknown[];
    };

    // Build a credential using the protocol package directly (ESM import)
    const { issueCredential, contentHash } = await import("@auth/protocol");
    const identity = {
      id: data.identity.id,
      secretKey: data.identity.secretKey,
      handle: "alice",
      assurance: "peer",
      createdAt: new Date().toISOString(),
    } as const;
    const credential = issueCredential(
      "creation",
      identity,
      {
        contentHash: contentHash("expiring"),
        aiAssistance: "none",
      },
      { expiresIn: 3600 },
    );
    data.credentials = [credential];
    writeFileSync(sourceStore, JSON.stringify(data, null, 2));

    // Export → import
    const exportResult = run(`export --store ${sourceStore}`);
    expect(exportResult.status).toBe(0);
    const vc = JSON.parse(exportResult.stdout) as {
      expirationDate?: string;
    };
    expect(vc.expirationDate).toBeDefined();
    writeFileSync(vcFile, exportResult.stdout);

    const importResult = run(`import --file ${vcFile} --store ${destStore}`);
    expect(importResult.status).toBe(0);

    const dest = JSON.parse(readFileSync(destStore, "utf-8")) as {
      credentials?: Array<{
        payload: { expiresAt?: string };
      }>;
    };
    expect(dest.credentials![0].payload.expiresAt).toBe(vc.expirationDate);
  });
});
