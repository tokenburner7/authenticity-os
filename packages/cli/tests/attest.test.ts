import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const CLI = "src/index.ts";
const PROJECT = join(new URL("..", import.meta.url).pathname);

let tempStorePath: string;

afterEach(() => {
  if (tempStorePath && existsSync(tempStorePath)) {
    rmSync(tempStorePath, { force: true, recursive: true });
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

describe("auth attest", () => {
  it("creates an identity then attests content and saves credential to store", () => {
    const storePath = makeTempPath();

    // First create an identity
    const createResult = run(`identity create --handle alice --store ${storePath}`);
    expect(createResult.status).toBe(0);

    // Now attest content
    const attestResult = run(
      `attest --content "My original human-written post" --ai-assistance none --evidence screenshot --store ${storePath}`,
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

    // Verify the credential was saved to the store
    const data = JSON.parse(readFileSync(storePath, "utf-8")) as {
      identity?: { id: string };
      credentials?: Array<{ payload: { type: string } }>;
    };

    expect(data.identity).toBeDefined();
    expect(credential.payload.issuer).toBe(data.identity!.id);
    expect(credential.signer).toBe(data.identity!.id);

    expect(data.credentials).toBeDefined();
    expect(data.credentials!.length).toBe(1);
    expect(data.credentials![0].payload.type).toBe("creation");
  });

  it("uses default ai-assistance level of none", () => {
    const storePath = makeTempPath();
    run(`identity create --handle bob --store ${storePath}`);

    const attestResult = run(
      `attest --content "some content" --store ${storePath}`,
    );
    expect(attestResult.status).toBe(0);

    const credential = JSON.parse(attestResult.stdout) as {
      payload: { subject: { aiAssistance: string } };
    };
    expect(credential.payload.subject.aiAssistance).toBe("none");
  });

  it("fails when no identity exists in store", () => {
    const storePath = makeTempPath();
    const result = run(
      `attest --content "content" --store ${storePath}`,
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("No identity");
  });

  it("rejects invalid AI assistance level", () => {
    const storePath = makeTempPath();
    run(`identity create --handle carol --store ${storePath}`);

    const result = run(
      `attest --content "content" --ai-assistance bogus --store ${storePath}`,
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Invalid AI assistance");
  });

  it("attests with ai-assisted level", () => {
    const storePath = makeTempPath();
    run(`identity create --handle dave --store ${storePath}`);

    const result = run(
      `attest --content "AI helped with this" --ai-assistance ai-assisted --store ${storePath}`,
    );
    expect(result.status).toBe(0);
    const credential = JSON.parse(result.stdout) as {
      payload: { subject: { aiAssistance: string } };
    };
    expect(credential.payload.subject.aiAssistance).toBe("ai-assisted");
  });
});

describe("auth vouch", () => {
  it("vouches for another identity and saves to store", () => {
    const storePath = makeTempPath();

    // Create vouching identity
    run(`identity create --handle alice --store ${storePath}`);

    // Create a target identity in a separate store just to get an id
    const targetStore = makeTempPath();
    run(`identity create --handle bob --store ${targetStore}`);
    const targetData = JSON.parse(readFileSync(targetStore, "utf-8")) as {
      identity: { id: string };
    };

    // Vouch
    const result = run(
      `vouch --target ${targetData.identity.id} --evidence "known 5 years" --store ${storePath}`,
    );
    expect(result.status).toBe(0);

    const credential = JSON.parse(result.stdout) as {
      payload: { type: string; subject: { targetId: string; evidence?: string } };
    };
    expect(credential.payload.type).toBe("vouch");
    expect(credential.payload.subject.targetId).toBe(targetData.identity.id);
    expect(credential.payload.subject.evidence).toBe("known 5 years");

    // Verify saved in store
    const data = JSON.parse(readFileSync(storePath, "utf-8")) as {
      credentials?: Array<{ payload: { type: string } }>;
      reputation?: { vouches?: unknown[] };
    };
    expect(data.credentials?.length).toBe(1);
    expect(data.credentials![0].payload.type).toBe("vouch");
    expect(data.reputation?.vouches?.length).toBe(1);
  });
});

describe("auth reputation show", () => {
  it("shows reputation record for a vouched identity", () => {
    const storePath = makeTempPath();

    // Create identity A (self) — issuer of the vouch
    run(`identity create --handle alice --store ${storePath}`);

    // Create a target identity in a separate store
    const targetStore = makeTempPath();
    run(`identity create --handle bob --store ${targetStore}`);
    const targetData = JSON.parse(readFileSync(targetStore, "utf-8")) as {
      identity: { id: string };
    };

    // alice vouches for bob
    run(`vouch --target ${targetData.identity.id} --store ${storePath}`);

    // Show reputation for bob (the target)
    const result = run(
      `reputation show --identity ${targetData.identity.id} --store ${storePath}`,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Reputation Record");
    expect(result.stdout).toContain(targetData.identity.id);
    // One vouch → social-trust score > 0
    expect(result.stdout).toMatch(/social-trust.*score=[1-9]/);
  });

  it("reports no reputation record when identity has no vouches", () => {
    const storePath = makeTempPath();
    run(`identity create --handle carol --store ${storePath}`);
    const data = JSON.parse(readFileSync(storePath, "utf-8")) as {
      identity: { id: string };
    };

    const result = run(
      `reputation show --identity ${data.identity.id} --store ${storePath}`,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No reputation record");
  });
});
