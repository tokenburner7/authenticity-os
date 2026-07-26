# Authenticity OS — Architecture

## Overview

A monorepo containing three packages and five applications that together form a
unified system for verifiable human authenticity in AI-mediated content:

**Packages**
1. **@auth/protocol** — The authenticity protocol: portable, reputation-weighted credentials for verifiable human authenticity. Includes Ed25519 cryptography, identity anchors, four credential types, a reputation graph, a verification engine, SQLite persistence, W3C Verifiable Credential interop, and EU AI Act Article 50 compliance tooling.
2. **@auth/agent** — The personal AI agent platform: trains on user data, carries identity credentials, and interacts with other agents over a WebSocket network. Includes pluggable LLM providers, agent persistence, discovery, and an auto-handshake viral loop.
3. **@auth/cli** — The command-line interface: identity management, attestation, vouching, verification, reputation queries, W3C VC export/import, networked agent startup, and an interactive creator onboarding wizard.

**Applications**
4. **apps/registry-server** — HTTP discovery registry where networked agents register and find peers.
5. **apps/verification-api** — HTTP verification server external platforms call to verify credentials, content signatures, and reputation.
6. **apps/demo** — Vite web app visualising the protocol lifecycle and viral loop.
7. **apps/brand-portal** — Vite web app where brands paste a creator's credential JSON and verify signature validity, AI provenance, and Article 50 compliance.
8. **apps/widget** — Zero-dependency, browser-compatible embeddable verification badge (IIFE).

The agent platform is the application that drives adoption of the protocol. The protocol is the trust infrastructure that makes agent-to-agent interaction reliable. The platform layer (verification API, brand portal, widget, compliance module) is what makes the trust legible to the outside world — social platforms, brands, and regulators.

Current state: **v0.4**, 158 tests across 23 suites, all four roadmap phases complete.

## System Diagram

### Core: Protocol ↔ Agent

```
┌─────────────────────────────────────────────────────────┐
│                    User (Human Principal)                 │
└──────────────┬──────────────────────────────┬─────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────┐        ┌──────────────────────────┐
│   @auth/agent        │        │   @auth/protocol          │
│                      │        │                           │
│  ┌───────────────┐   │        │  ┌─────────────────────┐ │
│  │  Agent Core   │───┼────────┼─▶│  Identity Anchor    │ │
│  │  (drafts,     │   │ signs  │  │  (Ed25519 keypair)  │ │
│  │   delegates)  │   │ content│  └─────────────────────┘ │
│  └───────────────┘   │        │                           │
│         │            │        │  ┌─────────────────────┐ │
│         ▼            │        │  │  Credential Layer   │ │
│  ┌───────────────┐   │        │  │  (creation, vouch,  │ │
│  │ Identity      │   │ holds  │  │   delegation)       │ │
│  │ Wallet        │───┼────────┼─▶└─────────────────────┘ │
│  │ (credentials, │   │ creds  │                           │
│  │  social graph)│   │        │  ┌─────────────────────┐ │
│  └───────────────┘   │        │  │  Reputation Graph   │ │
│         │            │        │  │  (vouch-weighted    │ │
│         ▼            │        │  │   trust scores)     │ │
│  ┌───────────────┐   │        │  └─────────────────────┘ │
│  │ Agent-to-Agent│   │        │                           │
│  │ Communication │   │        │  ┌─────────────────────┐ │
│  │ (message bus) │   │        │  │  Verification API   │ │
│  └───────────────┘   │        │  │  (anyone can verify)│ │
│                      │        │  └─────────────────────┘ │
└──────────────────────┘        └──────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              Agent Network (the viral engine)            │
│                                                          │
│   Agent A ◀──handshake──▶ Agent B ◀──handshake──▶ Agent C│
│      │                       │                       │   │
│      └───content-draft──────▶│                       │   │
│                              └───reputation-query───▶│   │
│                                                          │
│   Each interaction creates value for both parties.      │
│   Each new agent makes every other agent more useful.   │
└─────────────────────────────────────────────────────────┘
```

### Platform Layer (Phase 4 additions)

```
┌─────────────────────────────────────────────────────────┐
│                   External Platforms                     │
│        (social media, brand portals, regulators)         │
└──────┬──────────────────┬───────────────────┬───────────┘
       │                  │                   │
       ▼                  ▼                   ▼
┌──────────────┐  ┌──────────────┐   ┌──────────────────┐
│ Verification │  │  Brand Portal │   │  Embeddable       │
│ API          │  │  (Vite app)   │   │  Widget (IIFE)    │
│              │  │               │   │                   │
│ /verify      │  │ paste cred →  │   │ client-side       │
│ /verify-     │  │ signature +   │   │ Ed25519 verify,   │
│  content     │  │ Article 50    │   │ renders badge     │
│ /credentials │  │ compliance    │   │                   │
│ /reputation  │  │               │   └──────────────────┘
│ /batch-verify│  └──────────────┘
└──────┬───────┘
       │ reads
       ▼
┌──────────────┐        ┌──────────────────────────────────┐
│ SQLite store │        │  Article 50 Compliance Module     │
│ (source of   │        │  (protocol/src/article50.ts)      │
│  truth)      │        │                                   │
└──────────────┘        │  AIAssistanceLevel → label map    │
                        │  generateLabel() / Manifest /     │
                        │  HTML meta tags                   │
                        └──────────────────────────────────┘
```

## Package Structure

```
authenticity-os/
├── package.json              # Workspace root
├── pnpm-workspace.yaml       # Workspace config
├── pnpm-lock.yaml            # Lockfile
├── tsconfig.base.json        # Shared TS config
├── vitest.config.ts          # Test runner
├── ARCHITECTURE.md           # This file
├── PROTOCOL_SPEC.md          # Protocol specification
├── ROADMAP.md                # Development roadmap
├── README.md
├── Makefile                  # Convenience targets (demo, web-demo, servers)
├── docker-compose.yml        # Local full-stack (registry + verification-api)
├── Dockerfile.registry       # Image for apps/registry-server
├── Dockerfile.verification   # Image for apps/verification-api
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions CI (all workspace projects)
├── scripts/
│   └── demo.sh               # End-to-end system demo
│
├── packages/
│   ├── protocol/                 # @auth/protocol
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts          # Public API
│   │   │   ├── types.ts          # All type definitions
│   │   │   ├── crypto.ts         # Ed25519 signing, hashing
│   │   │   ├── identity.ts       # Identity anchor management
│   │   │   ├── credentials.ts    # Credential issuance, signature verify
│   │   │   ├── reputation.ts     # Reputation graph, trust scores
│   │   │   ├── verification.ts   # Verification engine (public API)
│   │   │   ├── store.ts          # ProtocolStore persistence interface
│   │   │   ├── sqlite-store.ts   # SQLite ProtocolStore implementation
│   │   │   ├── w3c.ts            # W3C Verifiable Credential interop
│   │   │   └── article50.ts      # EU AI Act Article 50 compliance
│   │   └── tests/
│   │       ├── crypto.test.ts
│   │       ├── identity.test.ts
│   │       ├── credentials.test.ts
│   │       ├── reputation.test.ts
│   │       ├── verification.test.ts
│   │       ├── store.test.ts
│   │       ├── w3c.test.ts
│   │       ├── article50.test.ts
│   │       └── e2e.test.ts
│   │
│   ├── agent/                    # @auth/agent
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts          # Public API
│   │   │   ├── types.ts          # Agent types
│   │   │   ├── agent.ts          # Agent core + discoverAndConnect()
│   │   │   ├── wallet.ts         # Identity wallet
│   │   │   ├── communication.ts  # In-process message bus
│   │   │   ├── network.ts        # NetworkMessageBus (WebSocket transport)
│   │   │   ├── registry.ts       # RegistryClient (HTTP discovery)
│   │   │   ├── llm.ts            # LLMProvider: Mock, Ollama, OpenAI
│   │   │   ├── store.ts          # AgentStore persistence interface
│   │   │   ├── sqlite-store.ts   # SQLite AgentStore implementation
│   │   │   └── utils.ts          # Utilities
│   │   └── tests/
│   │       ├── agent.test.ts
│   │       ├── communication.test.ts
│   │       ├── network.test.ts
│   │       ├── registry.test.ts
│   │       ├── llm.test.ts
│   │       ├── store.test.ts
│   │       ├── viral-loop.test.ts
│   │       └── e2e.test.ts
│   │
│   └── cli/                      # @auth/cli
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts          # `auth` program (commander)
│       │   ├── db.ts             # CliDb — SQLite-backed CLI store
│       │   ├── store.ts          # JSON store helpers (onboarding)
│       │   └── commands/
│       │       ├── identity.ts   # auth identity (create/show)
│       │       ├── attest.ts     # auth attest
│       │       ├── vouch.ts      # auth vouch
│       │       ├── verify.ts     # auth verify
│       │       ├── reputation.ts # auth reputation show
│       │       ├── export.ts     # auth export (W3C VC)
│       │       ├── import.ts     # auth import (W3C VC)
│       │       ├── agent.ts      # auth agent start (networked node)
│       │       └── onboard.ts    # auth onboard (creator wizard)
│       └── tests/
│           ├── identity.test.ts
│           ├── attest.test.ts
│           ├── vouch-verify.test.ts
│           └── export-import.test.ts
│
└── apps/
    ├── registry-server/         # Agent discovery registry (HTTP)
    │   ├── package.json
    │   └── src/
    │       ├── index.ts          # Entry point (port, CLI flags)
    │       └── server.ts         # RegistryServer class
    │
    ├── verification-api/        # Platform verification API (HTTP)
    │   ├── package.json
    │   └── src/
    │       ├── index.ts          # Entry point (seeds demo data)
    │       └── server.ts         # VerificationApiServer class
    │
    ├── demo/                    # Viral-loop visualiser (Vite)
    │   ├── package.json
    │   └── src/
    │       ├── main.ts           # Wires UI to scenario runner
    │       └── scenario.ts       # Step-by-step protocol scenario
    │
    ├── brand-portal/            # Brand verification portal (Vite)
    │   ├── package.json
    │   └── src/
    │       └── main.ts           # Paste-credential verifier UI
    │
    └── widget/                  # Embeddable verification badge (IIFE)
        ├── package.json
        └── src/
            ├── main.ts           # Demo page entrypoint
            └── widget.ts         # renderBadge() — zero-dependency
```

## Design Principles

1. **Local-first** — Sensitive data (private keys, user training data) stays on-device. The agent runs locally; cloud is only for heavy compute with E2E encryption.

2. **Protocol over platform** — The protocol is open. The agent platform is the reference implementation. Other platforms can integrate the protocol without depending on the agent package.

3. **Transparency by default** — AI-assisted content is always labeled with the assistance level. The credential system makes AI involvement verifiable, not just claimed.

4. **Reputation is earned, not bought** — Trust scores are computed from on-protocol behavior (vouches, verified interactions). Stake-slashing penalises false claims.

5. **Network effects are structural** — Agent-to-agent interaction is the viral engine. Each new agent increases value for all existing agents. Each new credential increases the protocol's data moat.

---

## Core Protocol Layer (Phase 1 + 2)

### Identity & Credentials

Every user holds an **identity anchor** — an Ed25519 keypair identified by a
content-addressable ID. Four credential types are issued from identity anchors:

- **Creation** — attests that a piece of content was created by the identity, at a given AI assistance level.
- **Vouch** — one identity vouches for another's authenticity, weighted by the voucher's own reputation.
- **Delegation** — an identity delegates content creation to its AI agent.
- **Reputation** — a computed trust score, storable as a credential.

### Verification Engine

`verifyCredential()` is the public verification API. It performs, in order:
1. **Signature check** — Ed25519 over the canonicalised payload + nonce.
2. **Expiry check** — credentials carry an `expiresAt`.
3. **Reputation check** — issuer's reputation must meet a configurable `minReputation` threshold.

It returns a `VerificationResult` with a status (`verified` / `invalid` / `expired`) and diagnostic details.

### Persistence

- **`ProtocolStore`** (`protocol/src/store.ts`) — the storage interface: identities, credentials, reputation, vouches.
- **`SqliteStore`** (`protocol/src/sqlite-store.ts`) — the production implementation, backed by `better-sqlite3`. This is the single source of truth for the verification API and the CLI.

### W3C Verifiable Credential Interop

`protocol/src/w3c.ts` converts internal `SignedCredential`s to and from the
[W3C VC Data Model](https://www.w3.org/TR/vc-data-model/), using the
`Ed25519Signature2018` proof format. The random payload nonce is carried as
`proof.nonce` so that round-trip signature verification is possible. The CLI's
`export` / `import` commands use this for interchange with other VC tooling.

---

## Agent Layer (Phase 1 + 2 + 3)

### Agent Core

`Agent` (`agent/src/agent.ts`) is the user's digital representative. It:
- Inherits the user's identity anchor.
- Drafts content on the user's behalf, signing delegation credentials.
- Holds a **wallet** of credentials and a **social graph** of known agents.
- Records an **interaction log** — the raw signal for network effects.

### LLM Providers

`agent/src/llm.ts` defines a pluggable `LLMProvider` interface with three
implementations:
- **MockProvider** — deterministic, for tests and offline dev.
- **OllamaProvider** — local Ollama HTTP API (`/api/generate`).
- **OpenAIProvider** — OpenAI Chat Completions API.

An agent with a provider set (`setLLMProvider()`) can call `generateContent()`
to draft model-generated content with an honest `aiAssistance` level.

### Agent Persistence

- **`AgentStore`** (`agent/src/store.ts`) — the storage interface: profile, wallet credentials, social graph, interaction log.
- **`SqliteAgentStore`** (`agent/src/sqlite-store.ts`) — the SQLite implementation.

### Agent-to-Agent Communication

Two message bus implementations share a common message shape:

- **`communication.ts`** — an in-process bus for tests and single-process use.
- **`network.ts`** — see Agent Network layer below.

---

## Agent Network Layer (Phase 3)

### WebSocket Transport — `NetworkMessageBus`

`agent/src/network.ts` implements `NetworkMessageBus`, a networked message bus
backed by the `ws` library. Each instance:

- Runs a **WebSocket server** on a configured port.
- Maintains **outbound** connections keyed by remote agent ID.
- Accepts **inbound** connections and learns the remote agent ID via an
  `agent-id` handshake frame sent on connect.
- Routes messages addressed to a local subscriber synchronously; forwards
  messages addressed to a remote agent over the matching outbound socket.

Wire frames are JSON, of two kinds: `{ kind: "agent-id", agentId }` (handshake)
and `{ kind: "message", message }` (an `AgentMessage` envelope).

### Registry Server — `apps/registry-server`

A zero-dependency HTTP server (`apps/registry-server/src/server.ts`) where
agents publish their WebSocket endpoint and discover peers. Endpoints:

| Method | Path            | Purpose                                         |
|--------|-----------------|-------------------------------------------------|
| `GET`  | `/health`       | Health check; returns `{ status, agents }`      |
| `POST` | `/register`     | Register an agent `{ agentId, name, endpoint, capabilities }` → `201` + entry |
| `GET`  | `/agents`       | List all registered agents                      |
| `GET`  | `/agents/:id`   | Lookup a specific agent                         |
| `POST` | `/unregister`   | Remove an agent `{ agentId }`                   |

Emits CORS headers for browser-based clients.

### Auto-Handshake / Viral Loop

`Agent.discoverAndConnect(registry, bus)` (`agent.ts`) is the viral engine:

1. Query the registry for all peers (`registry.discover()`).
2. For each peer not already in the social graph and not self:
   - Open a WebSocket connection via `bus.connectTo(host, port, agentId)`.
   - Send a `handshake` message carrying the local agent's profile.
   - Record the interaction and learn the peer (add to social graph).
3. Return the list of newly connected peers.

Every discovery triggers a connection; every connection enriches the social
graph; every richer graph makes the agent more useful. This is the structural
network effect.

### CLI Agent Start

`auth agent start` (`packages/cli/src/commands/agent.ts`) boots a full
networked agent node:

1. Load or create an identity from the local SQLite DB.
2. Construct an `Agent` bound to that identity.
3. Start a `NetworkMessageBus` WebSocket server on the given port.
4. Register with the discovery registry.
5. Subscribe to incoming messages.
6. Call `discoverAndConnect()` — the viral loop runs immediately on startup.
7. Listen for incoming interactions and log them.

Flags: `--name`, `--port`, `--registry <url>`, `--db <path>`, `--bio <text>`.

---

## Platform Layer (Phase 4)

### EU AI Act Article 50 Compliance — `protocol/src/article50.ts`

Article 50 of the EU AI Act requires machine-readable labeling of AI-generated
or AI-manipulated content (enforcement from August 2, 2026). This module:

- **`generateLabel(credential)`** — maps the credential's `AIAssistanceLevel`
  to an `Article50Label`: `human-only`, `ai-assisted`, `ai-generated`,
  `ai-fully-generated`, `deepfake`, `ai-manipulated`. Each label carries a
  human-readable description and a `requiresDisclosure` flag.
- **`checkCompliance(credential)`** — verifies the credential signature,
  generates a label, and flags violations (e.g. fully-AI delegation content
  flagged as a potential deepfake risk).
- **`checkUnregisteredContent(content)`** — returns a non-compliant result for
  content with no provenance credential.
- **`generateManifest(credential)`** — produces a machine-readable
  `Article50ComplianceLabel` manifest (JSON-LD-style) for embedding in C2PA
  manifests or platform metadata.
- **`generateMetaTags(credential)`** — emits HTML `<meta>` tags platforms can
  inject into their `<head>`.

### Verification API Server — `apps/verification-api`

An HTTP server (`apps/verification-api/src/server.ts`) external platforms call
to verify authenticity without running the protocol themselves. Backed by a
`SqliteStore`; reputation is derived on demand by replaying persisted vouches
into an in-memory `ReputationStore`, so the SQLite DB remains the single source
of truth. Endpoints:

| Method | Path               | Purpose                                                      |
|--------|--------------------|--------------------------------------------------------------|
| `GET`  | `/health`          | Health check; returns service name + credential count        |
| `POST` | `/verify`          | Verify a single credential `{ credential }` → `VerificationResult` |
| `POST` | `/verify-content`  | Verify content+signature+signer → `{ contentHash, valid, signer, message }` |
| `GET`  | `/credentials/:hash` | Lookup credential by content hash                          |
| `GET`  | `/reputation/:id`  | Reputation for an identity (persisted or derived from vouches) |
| `POST` | `/batch-verify`    | `{ credentials: [...] }` → `VerificationResult[]`            |

Emits CORS headers for browser-based platforms.

### Brand Verification Portal — `apps/brand-portal`

A Vite web app. A brand pastes a creator's credential JSON; the portal
verifies (client-side) the signature, displays the AI assistance level, and
runs the Article 50 compliance check. Used for one-off, human-in-the-loop
verification without API integration.

### Embeddable Widget — `apps/widget`

A zero-dependency, browser-compatible verification badge. `renderBadge()`
verifies a `SignedCredential` entirely client-side (Ed25519 via
`@noble/ed25519`) and renders a compact, themeable badge (`verified` /
`invalid` / `unknown`). Ships as an IIFE build so it can be dropped into any
page:

```html
<script src="auth-badge.js"></script>
<script>AuthBadge.renderBadge(el, credential);</script>
```

Options: `theme: "light" | "dark"`, `compact`, `showDetails`.

### Creator Onboarding Wizard — `auth onboard`

An interactive CLI command (`packages/cli/src/commands/onboard.ts`) that
guides a new creator through:
1. Creating an identity anchor.
2. Getting vouched for by existing community members.
3. Attesting their first piece of content.
4. Exporting their credential as a W3C VC for display on social platforms.

---

## Deployment

### Docker Images

Two multi-stage Dockerfiles build production images from `node:22-slim`:

- **`Dockerfile.registry`** — builds the whole workspace, runs
  `apps/registry-server`. Exposes port `4000`.
- **`Dockerfile.verification`** — single-stage build (better-sqlite3's native
  binding is compiled in-place to match the runtime glibc). Runs
  `apps/verification-api` against a `/data/platform.db` volume. Exposes port
  `4001`.

Both pin `pnpm@11.8.0` via corepack and install with `--frozen-lockfile`.

### docker-compose.yml

Brings up the full backend stack locally:

```yaml
services:
  registry:           # Dockerfile.registry, port 4000
  verification-api:   # Dockerfile.verification, port 4001, named volume
```

`docker compose up` gives a running registry + verification API.

### Vercel (static apps)

`apps/demo` and `apps/brand-portal` are Vite SPAs deployable to Vercel (or any
static host). They have no server runtime — all verification is client-side.

### End-to-End Demo — `scripts/demo.sh`

A single command that boots the entire system end-to-end:

```
./scripts/demo.sh          # run the full demo, auto-cleanup
./scripts/demo.sh --keep   # leave servers running afterwards
```

What it does:
1. Starts the **registry server** (port 4000) and waits for `/health`.
2. Starts the **verification API** (port 4001) with seeded demo data.
3. Starts **Agent 1 (Alice)** via `auth agent start` — registers, listens on `ws://localhost:3001`.
4. Starts **Agent 2 (Bob)** — Bob auto-discovers Alice via the registry and handshakes (the viral loop).
5. Exercises the **CLI**: Alice attests content, exports a W3C VC, Bob vouches for Alice, reputation and verification are queried.
6. Hits the **verification API** over HTTP: `/health`, `/verify` (seeded credential), `/reputation/:id`.

Available as `make demo` / `make demo-keep`. Web apps can be explored
separately via `make web-demo` (demo on `:5173`, brand-portal on `:5174`).

### Makefile Targets

| Target                | Purpose                                      |
|-----------------------|----------------------------------------------|
| `make install`        | `pnpm install`                               |
| `make build`          | `pnpm build` (all packages)                  |
| `make test`           | `pnpm test` (vitest)                         |
| `make lint`           | `pnpm lint` (type-check all packages)        |
| `make demo`           | `./scripts/demo.sh`                          |
| `make web-demo`       | Start demo + brand-portal Vite dev servers   |
| `make start-registry` | Run registry server alone (port 4000)        |
| `make start-verification` | Run verification API alone (port 4001)   |
| `make start-agent-1`  | Run a sample agent (Alice, port 3001)        |
| `make start-agent-2`  | Run a sample agent (Bob, port 3002)          |
