# Authenticity OS — Development Roadmap

## Phase 1: Foundation (v0.1) — DONE

- [x] Monorepo scaffold (pnpm workspace, TypeScript, strict mode)
- [x] @auth/protocol: Ed25519 crypto, identity anchors, 4 credential types, reputation graph, verification engine
- [x] @auth/agent: Agent core, identity wallet, delegation, message bus, agent-to-agent communication
- [x] Test suite: crypto, identity, credentials, reputation, verification, agent, communication

## Phase 2: MVP (v0.2) — DONE

- [x] **@auth/cli package** — identity, attest, verify, vouch, reputation, export, import
- [x] **SQLite persistence** — ProtocolStore + SqliteStore for identities, credentials, reputation, vouches
- [x] **W3C VC export/import** — Full round-trip verification
- [x] **LLM-backed content drafting** — Mock, Ollama, OpenAI providers
- [x] **Agent persistence** — SqliteAgentStore
- [x] **Integration tests** — End-to-end protocol and agent lifecycle

## Phase 3: Agent Network (v0.3) — DONE

- [x] **WebSocket transport** — NetworkMessageBus
- [x] **Agent discovery registry** — HTTP registry server + client
- [x] **Auto-handshake (viral loop)** — discoverAndConnect()
- [x] **Demo app** — Viral loop visualiser
- [x] **CLI agent start** — Networked agent node
- [x] **CI updated** — All workspace projects

## Phase 4: Platform (v0.4) — DONE

- [x] **EU AI Act Article 50 compliance** — Label generation, compliance checking, machine-readable manifests, HTML meta tags
- [x] **Platform verification API** — HTTP server for external platforms to verify credentials, check reputation, batch-verify
- [x] **Brand verification portal** — Web app for brands to verify creator authenticity and compliance status
- [x] **Embeddable verification widget** — Browser-compatible badge displaying authenticity status
- [x] **Creator onboarding flow** — Interactive CLI wizard guiding creators through identity creation, reputation building, and first attestation
- [x] **CLI SQLite migration** — Migrated from JSON file store to SQLite
- [x] ~npm publish~ (deferred — needs npm auth)

## Phase 5: Protocol Standardisation (v0.5+) — Next

- [ ] **Open governance** — Move the protocol to a foundation or working group
- [ ] **Cross-platform SDKs** — Python, Rust, Swift implementations
- [ ] **Reputation oracle network** — Decentralised reputation computation
- [ ] **Stake-slashing economics** — Full economic model for the stake/slash system
- [ ] **Multi-dimensional reputation** — Separate scores for different trust dimensions
- [ ] **Creator onboarding niche** — Target visual artists on Instagram/X as first vertical
- [ ] **Browser extension** — Verification badge overlay for social media platforms
- [ ] **npm publish** — Publish all packages

## Technology Choices

| Layer | Current (v0.4) | Target (v0.5) |
|-------|---------------|---------------|
| Crypto | @noble/ed25519 (pure JS) | Same |
| Persistence | SQLite (better-sqlite3) | Same + encrypted variant |
| LLM | Mock + Ollama + OpenAI | Same + local-first preference |
| Network | WebSocket (ws) | Same + A2A protocol compliance |
| Discovery | HTTP registry server | Federated registries |
| Packaging | pnpm workspace | npm published packages |
| Compliance | Article 50 module | Full regulatory framework |
| Browser | Demo + brand portal + widget | Browser extension |

## Stats (v0.4)

- **158 tests** across **23 test suites**, all passing
- **9 workspace projects**: @auth/protocol, @auth/agent, @auth/cli, @auth/registry-server, @auth/verification-api, @auth/demo, @auth/brand-portal, @auth/widget
- **End-to-end demo**: `make demo` (registry + 2 agents + CLI + verification API)
- **Deployed**: Docker images (registry, verification-api), Vercel (demo, brand-portal)
