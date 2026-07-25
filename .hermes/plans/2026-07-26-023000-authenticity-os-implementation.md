# Authenticity OS — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Take the v0.1 scaffold (working crypto, credentials, reputation, agent core, message bus — 36 tests passing) to a v0.3 system with LLM-backed agents, local persistence, a CLI, networked agent-to-agent communication, and a demo app that proves the viral loop.

**Architecture:** Two packages in a pnpm monorepo. @auth/protocol is the trust layer (identity, credentials, reputation, verification). @auth/agent is the application layer (agent core, wallet, communication). The agent drives adoption of the protocol. A new @auth/cli package provides the developer interface. A new apps/demo package proves the concept end-to-end.

**Tech Stack:** TypeScript, pnpm workspace, @noble/ed25519, vitest, better-sqlite3 (persistence), Ollama/OpenAI (LLM), WebSocket (A2A transport), Vite (demo app frontend).

**Repo root:** /Users/tn/dev/hermes-playground/authenticity-os

---

## Current State (v0.1 — verified)

```
authenticity-os/
├── packages/
│   ├── protocol/     @auth/protocol — 26 tests, builds clean
│   │   ├── src/      types, crypto, identity, credentials, reputation, verification, index
│   │   └── tests/    crypto, identity, credentials, reputation, verification
│   └── agent/        @auth/agent — 10 tests, builds clean
│       ├── src/      types, agent, wallet, communication, utils, index
│       └── tests/    agent, communication
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── ARCHITECTURE.md, PROTOCOL_SPEC.md, ROADMAP.md
├── .github/workflows/ci.yml
└── .gitignore
```

**What works:** Ed25519 keypair generation, signing, verification. 4 credential types (identity, creation, vouch, delegation). Count-based reputation graph. Verification engine with reputation thresholds. Agent core with content drafting (pre-written, not LLM-generated). In-memory message bus with handshake, reputation query, content draft sharing.

**What doesn't work:** No git repo. No persistence (in-memory only). No LLM integration. No CLI. No network transport. No demo app. No npm publish.

---

## Phase 2: MVP (v0.2)

Make the protocol usable by real developers and creators.

---

### Task 1: Initialise git repository

**Objective:** Version control the existing scaffold.

**Files:**
- Modify: `/Users/tn/dev/hermes-playground/authenticity-os/.gitignore` (already exists)

**Step 1: Initialise repo**

```bash
cd /Users/tn/dev/hermes-playground/authenticity-os
git init
git add -A
git commit -m "feat: v0.1 scaffold — protocol + agent packages, 36 tests passing"
```

**Step 2: Verify**

```bash
git log --oneline
```
Expected: 1 commit.

**Step 3: Create GitHub repo and push** (requires user's gh auth)

```bash
gh repo create authenticity-os --private --source=. --push
```

---

### Task 2: Add @auth/cli package scaffold

**Objective:** Create the CLI package that will expose the protocol to developers.

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/commands/` (directory placeholder)
- Modify: `pnpm-workspace.yaml` (already includes `packages/*`)

**Step 1: Create package.json**

```json
{
  "name": "@auth/cli",
  "version": "0.0.1",
  "description": "CLI for the authenticity protocol",
  "type": "module",
  "bin": {
    "auth": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "lint": "tsc --noEmit",
    "clean": "rm -rf dist node_modules"
  },
  "dependencies": {
    "@auth/protocol": "workspace:*",
    "@auth/agent": "workspace:*",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
```

**Step 3: Create src/index.ts with shebang and commander setup**

```typescript
#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("auth")
  .description("Authenticity protocol CLI")
  .version("0.0.1");

program.parse();
```

**Step 4: Install and verify**

```bash
cd /Users/tn/dev/hermes-playground/authenticity-os
pnpm install --ignore-scripts
pnpm --filter @auth/cli dev -- --help
```
Expected: help output listing no commands yet.

**Step 5: Commit**

```bash
git add packages/cli
git commit -m "feat: add @auth/cli package scaffold"
```

---

### Task 3: CLI command — create-identity

**Objective:** First CLI command: generate an identity anchor and save it locally.

**Files:**
- Create: `packages/cli/src/commands/identity.ts`
- Modify: `packages/cli/src/index.ts` (register command)
- Create: `packages/cli/src/store.ts` (local JSON file store, temporary before SQLite)
- Create: `packages/cli/tests/identity.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { rmSync, existsSync, readFileSync } from "node:fs";

describe("cli identity", () => {
  it("creates an identity and saves to local store", () => {
    const storePath = "/tmp/auth-test-identity.json";
    rmSync(storePath, { force: true });

    execSync(
      `pnpm --filter @auth/cli dev -- identity create --handle alice --store ${storePath}`,
      { cwd: "/Users/tn/dev/hermes-playground/authenticity-os" }
    );

    expect(existsSync(storePath)).toBe(true);
    const data = JSON.parse(readFileSync(storePath, "utf-8"));
    expect(data.handle).toBe("alice");
    expect(data.id).toMatch(/^[0-9a-f]{64}$/);
    expect(data.secretKey).toMatch(/^[0-9a-f]{64}$/);
    expect(data.assurance).toBe("peer");
  });
});
```

**Step 2: Run test to verify failure**

```bash
pnpm --filter @auth/cli test
```
Expected: FAIL — command not found.

**Step 3: Implement store.ts** — simple JSON file persistence (will be replaced by SQLite in Task 6).

```typescript
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export interface StoreData {
  identity?: {
    id: string;
    handle: string;
    secretKey: string;
    assurance: string;
    createdAt: string;
  };
  credentials?: unknown[];
}

export function loadStore(path: string): StoreData {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function saveStore(path: string, data: StoreData): void {
  writeFileSync(path, JSON.stringify(data, null, 2));
}
```

**Step 4: Implement identity command**

```typescript
import { Command } from "commander";
import { createIdentity } from "@auth/protocol";
import { loadStore, saveStore } from "../store.js";

export const identityCommand = new Command("identity")
  .description("Manage identities");

identityCommand
  .command("create")
  .description("Create a new identity anchor")
  .option("-h, --handle <handle>", "Human-readable handle")
  .option("-s, --store <path>", "Store file path", "./.auth/identity.json")
  .option("--assurance <level>", "Assurance level", "peer")
  .action((opts) => {
    const identity = createIdentity(opts.handle, opts.assurance);
    const store = loadStore(opts.store);
    store.identity = identity;
    saveStore(opts.store, store);
    console.log(`Identity created: ${identity.id}`);
    console.log(`Handle: ${identity.handle}`);
    console.log(`Assurance: ${identity.assurance}`);
    console.log(`Saved to: ${opts.store}`);
  });
```

**Step 5: Register in index.ts**

Add `program.addCommand(identityCommand)` and import.

**Step 6: Run test to verify pass**

```bash
pnpm --filter @auth/cli test
```
Expected: PASS.

**Step 7: Commit**

```bash
git add packages/cli
git commit -m "feat(cli): identity create command"
```

---

### Task 4: CLI command — attest

**Objective:** Attest content creation — stamp content with an identity.

**Files:**
- Create: `packages/cli/src/commands/attest.ts`
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/tests/attest.test.ts`

**Step 1: Write failing test**

Test that `auth attest --content "my post" --ai-assistance none` produces a JSON credential with a valid signature, saved to the store.

**Step 2: Run to verify failure.**

**Step 3: Implement** — load identity from store, call `attestCreation`, save credential to store, print credential JSON.

**Step 4: Run to verify pass.**

**Step 5: Commit** — `feat(cli): attest command`

---

### Task 5: CLI command — verify

**Objective:** Verify a credential's signature and issuer reputation.

**Files:**
- Create: `packages/cli/src/commands/verify.ts`
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/tests/verify.test.ts`

**Step 1: Write failing test** — create identity, attest content, then verify the credential via CLI. Expect status "valid".

**Step 2: Run to verify failure.**

**Step 3: Implement** — load credential JSON from file or stdin, create a reputation store, call `verifyCredential`, print result.

**Step 4: Run to verify pass.**

**Step 5: Commit** — `feat(cli): verify command`

---

### Task 6: CLI command — vouch

**Objective:** Allow one identity to vouch for another, building the reputation graph.

**Files:**
- Create: `packages/cli/src/commands/vouch.ts`
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/tests/vouch.test.ts`

**Step 1: Write failing test** — create two identities, vouch for one from the other, check reputation store reflects the vouch.

**Step 2: Run to verify failure.**

**Step 3: Implement** — load identity, load target identity, call `vouchFor`, save credential, update reputation store (in-memory for CLI, will persist in Task 8).

**Step 4: Run to verify pass.**

**Step 5: Commit** — `feat(cli): vouch command`

---

### Task 7: SQLite persistence layer

**Objective:** Replace the JSON file store with SQLite. This is the foundation for real-world use — identities, credentials, wallet state, and reputation all need to survive restarts.

**Files:**
- Create: `packages/protocol/src/store.ts` — protocol-level persistence interface
- Create: `packages/protocol/src/sqlite-store.ts` — SQLite implementation
- Modify: `packages/protocol/package.json` — add `better-sqlite3` dependency
- Modify: `packages/protocol/src/index.ts` — export new modules
- Create: `packages/protocol/tests/store.test.ts`

**Step 1: Add dependency**

```bash
pnpm --filter @auth/protocol add better-sqlite3
pnpm --filter @auth/protocol add -D @types/better-sqlite3
```

**Step 2: Write failing tests**

Test the following operations against a SQLite database:
- `saveIdentity` / `loadIdentity` — round-trip an identity
- `saveCredential` / `loadCredentials` — save and retrieve credentials
- `saveReputation` / `loadReputation` — persist reputation records
- `saveVouch` / `getVouchesFor` — persist and query vouches

Use an in-memory database (`:memory:`) for tests.

**Step 3: Run to verify failure.**

**Step 4: Implement store.ts** — define the `ProtocolStore` interface:

```typescript
export interface ProtocolStore {
  saveIdentity(identity: Identity): void;
  loadIdentity(id: string): Identity | undefined;
  loadIdentityByHandle(handle: string): Identity | undefined;

  saveCredential(credential: SignedCredential): void;
  loadCredentialsByIssuer(issuerId: string): SignedCredential[];
  loadCredentialByContentHash(hash: string): SignedCredential | undefined;

  saveReputation(record: ReputationRecord): void;
  loadReputation(identityId: string): ReputationRecord | undefined;

  saveVouch(vouch: SignedCredential): void;
  getVouchesFor(identityId: string): SignedCredential[];

  close(): void;
}
```

**Step 5: Implement sqlite-store.ts** — implement `ProtocolStore` using better-sqlite3. Create tables:

```sql
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  handle TEXT,
  secret_key TEXT,
  assurance TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload_json TEXT,
  signature TEXT,
  signer TEXT,
  type TEXT,
  content_hash TEXT,
  target_id TEXT,
  issued_at TEXT
);

CREATE TABLE IF NOT EXISTS reputation (
  identity_id TEXT PRIMARY KEY,
  overall INTEGER,
  dimensions_json TEXT,
  updated_at TEXT
);
```

**Step 6: Run tests to verify pass.**

**Step 7: Export from index.ts.**

**Step 8: Commit** — `feat(protocol): SQLite persistence layer`

---

### Task 8: Wire CLI to SQLite

**Objective:** Update the CLI commands to use SQLite instead of JSON files.

**Files:**
- Modify: `packages/cli/src/store.ts` → delete, replaced by protocol store
- Modify: `packages/cli/src/commands/identity.ts` — use `ProtocolStore`
- Modify: `packages/cli/src/commands/attest.ts` — use `ProtocolStore`
- Modify: `packages/cli/src/commands/verify.ts` — use `ProtocolStore`
- Modify: `packages/cli/src/commands/vouch.ts` — use `ProtocolStore`
- Modify: `packages/cli/tests/*.test.ts` — update to use SQLite

**Step 1: Update tests** to use a temp SQLite path instead of JSON file.

**Step 2: Run tests to verify failure.**

**Step 3: Update each command** to accept `--db <path>` (default: `./.auth/auth.db`) and use `SqliteStore`.

**Step 4: Run tests to verify pass.**

**Step 5: Commit** — `refactor(cli): use SQLite persistence`

---

### Task 9: Credential export/import (W3C VC format)

**Objective:** Make credentials portable — export as W3C Verifiable Credential JSON, import into other tools.

**Files:**
- Create: `packages/protocol/src/w3c.ts` — W3C VC conversion functions
- Modify: `packages/protocol/src/index.ts` — export
- Create: `packages/protocol/tests/w3c.test.ts`
- Create: `packages/cli/src/commands/export.ts`
- Create: `packages/cli/src/commands/import.ts`

**Step 1: Write failing tests**

Test:
- `toW3CVC(credential)` converts a `SignedCredential` to a W3C VC JSON object with `@context`, `type`, `issuer`, `credentialSubject`, `proof`.
- `fromW3CVC(json)` converts back, preserving the signature.
- Round-trip: export → import → verify signature still valid.

**Step 2: Run to verify failure.**

**Step 3: Implement w3c.ts**

```typescript
export function toW3CVC(credential: SignedCredential): W3CVerifiableCredential {
  return {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    type: ["VerifiableCredential", credential.payload.type],
    issuer: credential.payload.issuer,
    issuanceDate: credential.payload.issuedAt,
    expirationDate: credential.payload.expiresAt,
    credentialSubject: credential.payload.subject,
    proof: {
      type: "Ed25519Signature2018",
      created: credential.payload.issuedAt,
      proofValue: credential.signature,
      verificationMethod: credential.signer,
    },
  };
}

export function fromW3CVC(vc: W3CVerifiableCredential): SignedCredential {
  // Inverse transformation
}
```

**Step 4: Run tests to verify pass.**

**Step 5: Add CLI export/import commands** — `auth export --id <cred-id> --format w3c` and `auth import --file <path>`.

**Step 6: Commit** — `feat(protocol): W3C VC export/import`

---

### Task 10: LLM-backed content drafting

**Objective:** Wire the agent's `draftContent` to an actual LLM. Right now it signs pre-written text; this makes it generate content from a prompt.

**Files:**
- Create: `packages/agent/src/llm.ts` — LLM provider abstraction
- Create: `packages/agent/src/providers/ollama.ts` — local Ollama provider
- Create: `packages/agent/src/providers/openai.ts` — OpenAI API provider
- Modify: `packages/agent/src/agent.ts` — add `generateContent` method
- Modify: `packages/agent/package.json` — add deps
- Create: `packages/agent/tests/llm.test.ts`

**Step 1: Define the LLM provider interface**

```typescript
export interface LLMProvider {
  generate(prompt: string, options?: LLMOptions): Promise<string>;
}

export interface LLMOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}
```

**Step 2: Write failing test** — mock the LLM provider, verify the agent calls it and signs the generated content.

```typescript
const mockProvider: LLMProvider = {
  generate: async (prompt) => `Generated: ${prompt}`,
};

const agent = createAgentForIdentity(config, identity);
agent.setLLMProvider(mockProvider);

const draft = await agent.generateContent("Write a post about AI authenticity", "ai-assisted");
expect(draft.content).toContain("Generated:");
expect(verifyCredentialSignature(draft.credential)).toBe(true);
```

**Step 3: Run to verify failure.**

**Step 4: Implement llm.ts and providers**

Ollama provider: HTTP call to `http://localhost:11434/api/generate`.
OpenAI provider: HTTP call to `https://api.openai.com/v1/chat/completions`.

**Step 5: Add `generateContent` to Agent class**

```typescript
async generateContent(
  prompt: string,
  aiAssistance: AIAssistanceLevel = "ai-assisted",
  evidence?: string
): Promise<DelegatedContent> {
  const content = await this.llmProvider.generate(prompt, {
    systemPrompt: this.systemPrompt,
  });
  return this.draftContent(content, aiAssistance, evidence);
}
```

**Step 6: Run tests to verify pass.**

**Step 7: Commit** — `feat(agent): LLM-backed content generation`

---

### Task 11: Agent persistence

**Objective:** Save and restore agent state (wallet, social graph, interaction log) to SQLite.

**Files:**
- Create: `packages/agent/src/store.ts` — agent persistence interface
- Create: `packages/agent/src/sqlite-store.ts` — SQLite implementation
- Modify: `packages/agent/src/agent.ts` — add `save` and `load` methods
- Modify: `packages/agent/package.json` — add `better-sqlite3`
- Create: `packages/agent/tests/store.test.ts`

**Step 1: Write failing tests** — create agent, draft content (adds credential to wallet), learn about another agent, save to SQLite, create new agent instance from loaded data, verify wallet and social graph restored.

**Step 2: Run to verify failure.**

**Step 3: Implement** — `AgentStore` interface and `SqliteAgentStore` implementation with tables for `agent_profiles`, `wallet_credentials`, `known_agents`, `interaction_log`.

**Step 4: Run tests to verify pass.**

**Step 5: Commit** — `feat(agent): SQLite persistence`

---

### Task 12: Integration tests (end-to-end)

**Objective:** Prove the full flow works: create identity → build reputation → issue credential → verify.

**Files:**
- Create: `packages/protocol/tests/e2e.test.ts`
- Create: `packages/agent/tests/e2e.test.ts`

**Step 1: Write protocol e2e test**

```
1. Create 5 identities (alice, bob, carol, dave, eve)
2. Alice and Bob vouch for Carol
3. Carol creates content and attests it
4. Verify Carol's credential with minReputation=10 → valid
5. Eve creates content and attests it
6. Verify Eve's credential with minReputation=10 → unknown-issuer
7. Slash Carol's reputation
8. Verify Carol's credential with minReputation=10 → low-reputation
```

**Step 2: Write agent e2e test**

```
1. Create identity for Alice
2. Create agent for Alice bound to that identity
3. Alice's agent drafts content (LLM mocked)
4. Verify the delegation credential
5. Create identity for Bob
6. Create agent for Bob
7. Alice's agent handshakes with Bob's agent
8. Alice's agent shares content draft with Bob's agent
9. Bob's agent verifies Alice's credential
10. Assert: handshake happened, content received, verification passed
```

**Step 3: Run all tests**

```bash
pnpm test
```
Expected: all pass (36 original + new integration tests).

**Step 4: Commit** — `test: end-to-end integration tests`

---

### Task 13: npm publish (both packages)

**Objective:** Make the packages installable by other projects.

**Files:**
- Modify: `packages/protocol/package.json` — add `publishConfig`
- Modify: `packages/agent/package.json` — add `publishConfig`
- Create: `.github/workflows/publish.yml` — automated publish on tag

**Step 1: Verify build**

```bash
pnpm build
pnpm test
```

**Step 2: Dry-run publish**

```bash
pnpm publish --dry-run --filter @auth/protocol
pnpm publish --dry-run --filter @auth/agent
```

**Step 3: Publish for real** (requires npm account + auth token)

```bash
npm login
pnpm publish --filter @auth/protocol
pnpm publish --filter @auth/agent
```

**Step 4: Add publish workflow** — publish on git tag `v*`.

**Step 5: Commit** — `ci: npm publish workflow`

---

## Phase 3: Agent Network (v0.3)

Make agents talk to each other over the network.

---

### Task 14: WebSocket transport for agent-to-agent communication

**Objective:** Replace the in-memory message bus with a WebSocket-based transport that works across machines.

**Files:**
- Create: `packages/agent/src/network.ts` — WebSocket server/client
- Modify: `packages/agent/src/communication.ts` — add `NetworkMessageBus` implementing the same interface as `MessageBus`
- Modify: `packages/agent/src/index.ts` — export
- Modify: `packages/agent/package.json` — add `ws`
- Create: `packages/agent/tests/network.test.ts`

**Step 1: Add dependency**

```bash
pnpm --filter @auth/agent add ws
pnpm --filter @auth/agent add -D @types/ws
```

**Step 2: Write failing test** — create two `NetworkMessageBus` instances on different ports, send a handshake from one to the other, verify receipt.

**Step 3: Run to verify failure.**

**Step 4: Implement `NetworkMessageBus`**

```typescript
export class NetworkMessageBus {
  private server: WebSocket.Server | null = null;
  private connections: Map<string, WebSocket> = new Map();
  private subscribers: Map<string, (msg: AgentMessage) => void> = new Map();
  private messages: AgentMessage[] = [];

  constructor(private port: number) {}

  async start(): Promise<void> {
    this.server = new WebSocket.Server({ port: this.port });
    this.server.on("connection", (ws, req) => {
      // Handle incoming connections
    });
  }

  async connectTo(host: string, port: number): Promise<void> {
    // Connect to another agent's server
  }

  sendMessage(msg: AgentMessage): void {
    // Send via WebSocket if connected, fallback to local
  }

  subscribe(agentId: string, callback: (msg: AgentMessage) => void): void {
    this.subscribers.set(agentId, callback);
  }

  async stop(): Promise<void> {
    // Close all connections and server
  }
}
```

**Step 5: Run tests to verify pass.**

**Step 6: Commit** — `feat(agent): WebSocket network transport`

---

### Task 15: Agent discovery (registry + peer list)

**Objective:** Agents need to find each other. Implement a simple registry server where agents register their WebSocket endpoint and query for other agents.

**Files:**
- Create: `packages/agent/src/registry.ts` — registry client
- Create: `apps/registry-server/` — standalone registry HTTP server
- Create: `packages/agent/tests/registry.test.ts`

**Step 1: Write failing test** — start a registry server, register two agents, have agent A query the registry to discover agent B.

**Step 2: Run to verify failure.**

**Step 3: Implement registry**

Registry API:
- `POST /register` — `{ agentId, name, endpoint, capabilities }` → registers agent
- `GET /agents` — list all registered agents
- `GET /agents/:id` — get specific agent
- `POST /unregister` — `{ agentId }` → removes agent

**Step 4: Implement registry client in agent package**

```typescript
export class RegistryClient {
  constructor(private registryUrl: string) {}

  async register(profile: AgentProfile, endpoint: string): Promise<void>;
  async discover(filter?: { capability?: string }): Promise<AgentProfile[]>;
  async lookup(agentId: string): Promise<AgentProfile | undefined>;
  async unregister(agentId: string): Promise<void>;
}
```

**Step 5: Run tests to verify pass.**

**Step 6: Commit** — `feat(agent): registry server and discovery client`

---

### Task 16: Agent auto-handshake (viral loop automation)

**Objective:** When an agent discovers another agent, automatically initiate a handshake and exchange identity credentials. This is the viral loop in code — every discovery triggers a connection.

**Files:**
- Modify: `packages/agent/src/agent.ts` — add `discoverAndConnect` method
- Create: `packages/agent/tests/viral-loop.test.ts`

**Step 1: Write failing test**

```
1. Start registry server
2. Start agent A, register with registry
3. Start agent B, register with registry
4. Agent B calls discoverAndConnect()
5. Agent B discovers Agent A via registry
6. Agent B handshakes with Agent A over WebSocket
7. Agent A receives handshake, learns about Agent B
8. Agent A's social graph now includes Agent B
9. Assert: both agents know about each other, both have interaction records
```

**Step 2: Run to verify failure.**

**Step 3: Implement `discoverAndConnect`**

```typescript
async discoverAndConnect(registry: RegistryClient, bus: NetworkMessageBus): Promise<AgentProfile[]> {
  const peers = await registry.discover();
  const connected: AgentProfile[] = [];

  for (const peer of peers) {
    if (peer.id === this.profile.id) continue;
    if (this.getInteractionCount(peer.id) > 0) continue; // already connected

    // Connect WebSocket
    await bus.connectTo(peer.endpoint.host, peer.endpoint.port);

    // Handshake
    handshake(bus, this.profile, peer.id, this.getIdentityCredential());
    this.recordInteraction(peer.id);
    this.learnAgent(peer);
    connected.push(peer);
  }

  return connected;
}
```

**Step 4: Run tests to verify pass.**

**Step 5: Commit** — `feat(agent): auto-discovery and handshake (viral loop)`

---

### Task 17: Demo app — the viral loop visualiser

**Objective:** A web app that demonstrates the full system: two agents interacting, exchanging credentials, producing signed content, and a third party verifying it. This is what you show investors, users, and collaborators.

**Files:**
- Create: `apps/demo/package.json`
- Create: `apps/demo/vite.config.ts`
- Create: `apps/demo/index.html`
- Create: `apps/demo/src/main.ts` — app entry
- Create: `apps/demo/src/scenario.ts` — orchestrates the demo scenario
- Create: `apps/demo/src/components/` — UI components

**Step 1: Create the demo app scaffold**

```bash
pnpm create vite apps/demo --template vanilla-ts
```

**Step 2: Define the demo scenario**

The demo runs this sequence automatically, with a visual timeline:

```
1. Create Alice's identity (shown: keypair, assurance level)
2. Create Bob's identity
3. Carol vouches for Alice (shown: vouch credential, reputation graph update)
4. Dave vouches for Alice
5. Alice's reputation score rises (shown: reputation graph)
6. Alice's agent drafts content (shown: content, AI-assistance level, credential)
7. Bob's agent receives the content
8. Bob's agent verifies Alice's credential (shown: verification result)
9. Result: "Valid — issuer reputation 63, content verified as AI-assisted"
```

**Step 3: Implement the UI** — minimal, clean. Apple Notes minimalism per AGENTS.md design preferences. Timeline view showing each step with expandable credential JSON.

**Step 4: Add a "Run Demo" button** that executes the scenario and animates each step.

**Step 5: Add a "Network View"** — visual showing Agent A and Agent B as nodes, with a handshake animation between them.

**Step 6: Verify**

```bash
pnpm --filter demo dev
# Open browser, click "Run Demo", verify all steps render
```

**Step 7: Commit** — `feat: demo app — viral loop visualiser`

---

### Task 18: CLI command — agent start (run an agent node)

**Objective:** Allow a developer to start an agent node from the CLI that connects to the network, registers with the registry, and listens for incoming agent interactions.

**Files:**
- Create: `packages/cli/src/commands/agent.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Implement**

```bash
auth agent start \
  --name "Alice's Agent" \
  --db ./.auth/auth.db \
  --port 3001 \
  --registry http://localhost:4000
```

This starts:
1. SQLite store (load identity from db)
2. WebSocket server on `--port`
3. Registry client (register with registry)
4. Listen for incoming handshakes and content drafts
5. Log all interactions

**Step 2: Test manually** — open two terminals, start two agents, watch them discover and handshake.

**Step 3: Commit** — `feat(cli): agent start command`

---

### Task 19: Update CI for demo app

**Objective:** Ensure CI builds and tests the demo app alongside the packages.

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add demo build step**

```yaml
- name: Build demo
  run: pnpm --filter demo build
```

**Step 2: Verify CI passes** — push to main, check GitHub Actions.

**Step 3: Commit** — `ci: build demo app`

---

### Task 20: Update ROADMAP.md and ARCHITECTURE.md

**Objective:** Reflect the completed v0.2 and v0.3 work in the docs.

**Files:**
- Modify: `ROADMAP.md` — mark completed items
- Modify: `ARCHITECTURE.md` — add network layer and demo app to the diagram
- Modify: `PROTOCOL_SPEC.md` — add W3C VC format section

**Step 1: Update all three docs.**

**Step 2: Commit** — `docs: update for v0.2-v0.3 completion`

---

## Summary: What v0.3 Looks Like

```
authenticity-os/
├── packages/
│   ├── protocol/     @auth/protocol — crypto, credentials, reputation, verification, SQLite store, W3C VC export
│   ├── agent/        @auth/agent — agent core, LLM integration, wallet, WebSocket transport, registry client, persistence
│   └── cli/          @auth/cli — identity, attest, verify, vouch, export, import, agent start
├── apps/
│   ├── demo/         Viral loop visualiser web app
│   └── registry-server/  Agent discovery registry
├── .github/workflows/
│   ├── ci.yml        Build + test all packages
│   └── publish.yml   npm publish on tag
└── docs
```

**Test count:** ~80-100 tests (36 current + ~50-60 new across persistence, LLM, network, integration, demo).

**What a developer can do:**
- `auth identity create --handle alice` → generate an identity
- `auth attest --content "my post" --ai-assistance none` → stamp content
- `auth verify --file credential.json` → verify a credential
- `auth agent start --port 3001` → run a networked agent
- Agents discover each other, handshake, exchange credentials, verify each other
- Web demo shows the full flow visually

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Ollama not installed on dev machine | OpenAI provider as fallback; mock provider for tests |
| better-sqlite3 native module issues | Prebuilt binaries available for darwin-arm64; fallback to sql.js (pure WASM) if needed |
| WebSocket tests are flaky | Use fixed ports, proper teardown in afterEach, generous timeouts |
| LLM costs during development | Mock provider in all tests; real LLM only in manual testing |
| Registry server is a single point of failure | v0.3 is single-instance; v0.4 will add federation. Document this limitation. |
| Demo app is too complex | Keep it to a single page, no routing, no auth. Just a timeline and a button. |

## Open Questions

1. **Scoped npm package** — @auth scope may be taken on npm. Need to check availability or use a different scope (@authenticity, @auth-os, @authprotocol). Resolve before Task 13.
2. **LLM default** — Should the default provider be Ollama (local-first) or OpenAI (better quality)? Recommendation: Ollama as default, OpenAI as opt-in. Aligns with local-first principle.
3. **Registry server deployment** — Where does the registry server run for the demo? Options: localhost for dev, Fly.io free tier for a public demo. Decide before investor demos.
4. **Protocol versioning** — Should credentials include a protocol version field for forward compatibility? Currently they don't. Add in v0.2 before publishing.

---

## Execution Estimate

| Phase | Tasks | Estimated Time | Parallelizable |
|-------|-------|---------------|----------------|
| v0.2 (MVP) | Tasks 1-13 | 8-12 hours | Tasks 3-6 (CLI commands) can be parallelized via subagents |
| v0.3 (Agent Network) | Tasks 14-20 | 8-12 hours | Tasks 14-16 (network) are sequential; 17 (demo) can start once 16 is done |
| Total | 20 tasks | 16-24 hours | |

With subagent delegation (3 parallel workers), the v0.2 CLI commands (Tasks 3-6) can be built concurrently, reducing the total to ~12-16 hours.
