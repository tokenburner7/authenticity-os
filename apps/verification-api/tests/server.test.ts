/**
 * Verification API server tests.
 *
 * Starts a real HTTP server on port 4399 (to avoid conflicts with other test
 * servers such as the registry on 4199), seeds it with test identities and
 * credentials, and exercises every endpoint.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  SqliteStore,
  createIdentity,
  attestCreation,
  vouchFor,
  contentHash,
  sign,
  type Identity,
  type SignedCredential,
} from "@auth/protocol";
import { VerificationApiServer } from "../src/server.js";

const PORT = 4399;
const BASE = `http://localhost:${PORT}`;

let server: VerificationApiServer;
let store: SqliteStore;

// Seeded test fixtures (populated in beforeAll)
let alice: Identity;
let bob: Identity;
let carol: Identity;
let aliceCredential: SignedCredential;
let bobCredential: SignedCredential;

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function get(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`);
}

beforeAll(async () => {
  store = new SqliteStore(":memory:");

  alice = createIdentity("alice", "social");
  bob = createIdentity("bob", "peer");
  carol = createIdentity("carol", "peer");
  store.saveIdentity(alice);
  store.saveIdentity(bob);
  store.saveIdentity(carol);

  // Build Alice's reputation via persisted vouches.
  store.saveVouch(vouchFor(bob, alice.id, "test"));
  store.saveVouch(vouchFor(carol, alice.id, "test"));

  // Two creation credentials for batch / lookup tests.
  aliceCredential = attestCreation(alice, contentHash("alice's content"), "none");
  bobCredential = attestCreation(bob, contentHash("bob's content"), "none");
  store.saveCredential(aliceCredential);
  store.saveCredential(bobCredential);

  server = new VerificationApiServer(store, { port: PORT });
  await server.start();
});

afterAll(async () => {
  await server.stop();
  store.close();
});

describe("verification-api /health", () => {
  it("returns ok status", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; service: string };
    expect(json.status).toBe("ok");
    expect(json.service).toBe("verification-api");
  });
});

describe("verification-api /verify", () => {
  it("returns status 'valid' for a valid credential", async () => {
    const res = await post("/verify", { credential: aliceCredential });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("valid");
  });

  it("returns 'invalid-signature' for a tampered credential", async () => {
    const tampered: SignedCredential = {
      ...aliceCredential,
      payload: {
        ...aliceCredential.payload,
        subject: { ...aliceCredential.payload.subject, aiAssistance: "fully-ai" },
      },
    };
    const res = await post("/verify", { credential: tampered });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("invalid-signature");
  });
});

describe("verification-api /verify-content", () => {
  it("verifies matching content and signature", async () => {
    const content = "signed message body";
    const hash = contentHash(content);
    const signature = sign(Buffer.from(hash, "utf-8"), alice.secretKey);

    const res = await post("/verify-content", {
      content,
      signature,
      signer: alice.id,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { valid: boolean; contentHash: string };
    expect(json.valid).toBe(true);
    expect(json.contentHash).toBe(hash);
  });

  it("rejects a tampered content payload", async () => {
    const content = "original message";
    const hash = contentHash(content);
    const signature = sign(Buffer.from(hash, "utf-8"), alice.secretKey);

    const res = await post("/verify-content", {
      content: "tampered message",
      signature,
      signer: alice.id,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { valid: boolean };
    expect(json.valid).toBe(false);
  });
});

describe("verification-api /credentials/:hash", () => {
  it("looks up a credential by content hash", async () => {
    const hash = aliceCredential.payload.subject.contentHash!;
    const res = await get(`/credentials/${hash}`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as SignedCredential;
    expect(json.signer).toBe(alice.id);
    expect(json.payload.subject.contentHash).toBe(hash);
  });

  it("returns 404 for an unknown hash", async () => {
    const res = await get("/credentials/0000000000000000");
    expect(res.status).toBe(404);
  });
});

describe("verification-api /reputation/:id", () => {
  it("returns reputation for a known identity", async () => {
    const res = await get(`/reputation/${alice.id}`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { identityId: string; overall: number };
    expect(json.identityId).toBe(alice.id);
    expect(json.overall).toBeGreaterThan(0);
  });

  it("returns 404 for an unknown identity", async () => {
    const res = await get("/reputation/nonexistent-id");
    expect(res.status).toBe(404);
  });
});

describe("verification-api /batch-verify", () => {
  it("verifies multiple credentials at once", async () => {
    const res = await post("/batch-verify", {
      credentials: [aliceCredential, bobCredential],
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string }[];
    expect(json).toHaveLength(2);
    expect(json[0].status).toBe("valid");
    expect(json[1].status).toBe("valid");
  });

  it("returns per-credential results when some are invalid", async () => {
    const tampered: SignedCredential = {
      ...aliceCredential,
      payload: {
        ...aliceCredential.payload,
        subject: { ...aliceCredential.payload.subject, aiAssistance: "fully-ai" },
      },
    };
    const res = await post("/batch-verify", {
      credentials: [aliceCredential, tampered],
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string }[];
    expect(json).toHaveLength(2);
    expect(json[0].status).toBe("valid");
    expect(json[1].status).toBe("invalid-signature");
  });
});
