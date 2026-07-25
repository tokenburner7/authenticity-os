/**
 * @auth/verification-api — Platform Verification API server
 *
 * An HTTP server that external platforms (social media, brand portals) can
 * call to verify credentials, check content authenticity, and look up
 * reputation for an identity.
 *
 * Endpoints:
 *   GET  /health              — health check
 *   POST /verify              — body: { credential } → VerificationResult
 *   POST /verify-content      — body: { content, signature, signer } → verifies hash + signature
 *   GET  /credentials/:hash   — lookup credential by content hash
 *   GET  /reputation/:id      — get reputation for an identity
 *   POST /batch-verify        — body: { credentials: SignedCredential[] } → VerificationResult[]
 *
 * Backed by a SqliteStore instance. Verification is performed with the
 * protocol's verifyCredential() against an in-memory ReputationStore that
 * is rebuilt from the persisted vouches on demand, so the SQLite database
 * remains the single source of truth.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  verifyCredential,
  createReputationStore,
  recordVouch,
  contentHash,
  verify as verifySignature,
  canonicalise,
  type SqliteStore,
  type SignedCredential,
  type VerificationResult,
  type ReputationRecord,
  type ReputationStore,
} from "@auth/protocol";

export interface VerificationApiOptions {
  /** Port to listen on. Defaults to 4001. */
  port?: number;
}

export class VerificationApiServer {
  private store: SqliteStore;
  private port: number;
  private server: ReturnType<typeof createServer> | null = null;

  constructor(store: SqliteStore, options: VerificationApiOptions = {}) {
    this.store = store;
    this.port = options.port ?? 4001;
  }

  /**
   * Build an in-memory ReputationStore from the persisted vouch credentials.
   * The SQLite store is the source of truth; the reputation store is a
   * derived, ephemeral view used by the protocol's verifyCredential().
   */
  private buildReputationStore(): ReputationStore {
    const repStore = createReputationStore();
    // Replay all vouch credentials into the in-memory store.
    for (const cred of this.store.loadAllCredentials()) {
      if (cred.payload.type === "vouch") {
        recordVouch(repStore, cred);
      }
    }
    // Also overlay any reputation records that were saved directly.
    return repStore;
  }

  /**
   * Public helper used by the entry point and tests: persists a vouch
   * credential and returns it. Kept here so seeding logic lives near the
   * verification pipeline it feeds.
   */
  persistVouch(vouch: SignedCredential): void {
    this.store.saveVouch(vouch);
  }

  /** Persist any signed credential. */
  persistCredential(credential: SignedCredential): void {
    this.store.saveCredential(credential);
  }

  start(port?: number): Promise<void> {
    const listenPort = port ?? this.port;
    return new Promise((resolve) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(listenPort, () => {
        console.log(`Verification API listening on port ${listenPort}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader("Content-Type", "application/json");

    // CORS headers for browser-based platforms
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost`);
    const path = url.pathname;

    try {
      // ── Health check ──────────────────────────────────────
      if (path === "/health" && req.method === "GET") {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            status: "ok",
            service: "verification-api",
            credentials: this.store.loadAllCredentials().length,
          }),
        );
        return;
      }

      // ── Verify a single credential ────────────────────────
      if (path === "/verify" && req.method === "POST") {
        const body = await readBody(req);
        const { credential } = JSON.parse(body) as { credential: SignedCredential };
        if (!credential) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Missing 'credential' in request body." }));
          return;
        }
        const repStore = this.buildReputationStore();
        const result = verifyCredential(credential, repStore);
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      // ── Verify content authenticity ───────────────────────
      if (path === "/verify-content" && req.method === "POST") {
        const body = await readBody(req);
        const { content, signature, signer } = JSON.parse(body) as {
          content: string;
          signature: string;
          signer: string;
        };
        if (content === undefined || !signature || !signer) {
          res.writeHead(400);
          res.end(
            JSON.stringify({ error: "Missing 'content', 'signature', or 'signer'." }),
          );
          return;
        }
        const hash = contentHash(content);
        // The signature is expected over the content hash — the canonical
        // attestation target. This ties the signature to the exact content
        // being verified.
        const valid = verifySignature(
          Buffer.from(hash, "utf-8"),
          signature,
          signer,
        );
        const result = {
          contentHash: hash,
          valid,
          signer,
          message: valid
            ? "Signature is valid for the given content."
            : "Signature does not match the content/signer.",
        };
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      // ── Lookup credential by content hash ─────────────────
      const credMatch = path.match(/^\/credentials\/(.+)$/);
      if (credMatch && req.method === "GET") {
        const hash = decodeURIComponent(credMatch[1]);
        const credential = this.store.loadCredentialByContentHash(hash);
        if (credential) {
          res.writeHead(200);
          res.end(JSON.stringify(credential));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "No credential found for that content hash." }));
        }
        return;
      }

      // ── Reputation lookup ─────────────────────────────────
      const repMatch = path.match(/^\/reputation\/(.+)$/);
      if (repMatch && req.method === "GET") {
        const identityId = decodeURIComponent(repMatch[1]);
        const reputation = this.lookupReputation(identityId);
        if (reputation) {
          res.writeHead(200);
          res.end(JSON.stringify(reputation));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "No reputation record for that identity." }));
        }
        return;
      }

      // ── Batch verify ──────────────────────────────────────
      if (path === "/batch-verify" && req.method === "POST") {
        const body = await readBody(req);
        const { credentials } = JSON.parse(body) as {
          credentials: SignedCredential[];
        };
        if (!Array.isArray(credentials)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Missing 'credentials' array in request body." }));
          return;
        }
        const repStore = this.buildReputationStore();
        const results: VerificationResult[] = credentials.map((cred) =>
          verifyCredential(cred, repStore),
        );
        res.writeHead(200);
        res.end(JSON.stringify(results));
        return;
      }

      // ── 404 ───────────────────────────────────────────────
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  }

  /**
   * Look up reputation for an identity. Prefers a directly-persisted record,
   * otherwise derives it from the vouch graph.
   */
  private lookupReputation(identityId: string): ReputationRecord | undefined {
    const persisted = this.store.loadReputation(identityId);
    if (persisted) return persisted;
    const repStore = this.buildReputationStore();
    return repStore.records.get(identityId);
  }
}

/** Read the full request body as a string. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// Re-export for convenience in the entry point / tests.
export { contentHash, canonicalise };
