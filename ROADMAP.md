# Authenticity OS — Development Roadmap

## Phase 1: Foundation (v0.1) — DONE

The scaffold. Both packages exist with working crypto, credentials, reputation, agents, and agent-to-agent messaging. All tests pass.

- [x] Monorepo scaffold (pnpm workspace, TypeScript, strict mode)
- [x] @auth/protocol: Ed25519 crypto, identity anchors, 4 credential types, reputation graph (count-based), verification engine
- [x] @auth/agent: Agent core, identity wallet, delegation, message bus, agent-to-agent communication
- [x] Test suite: crypto, identity, credentials, reputation, verification, agent, communication
- [x] Architecture docs, protocol spec, CI

## Phase 2: MVP (v0.2) — DONE

Made the protocol usable by real developers.

- [x] **@auth/cli package** — identity create/show, attest, verify, vouch, reputation show, export, import
- [x] **SQLite persistence layer** — ProtocolStore + SqliteStore for identities, credentials, reputation, vouches
- [x] **Credential export/import** — W3C Verifiable Credential format with full round-trip verification
- [x] **LLM-backed content drafting** — MockProvider, OllamaProvider, OpenAIProvider wired into Agent class
- [x] **Agent persistence** — SqliteAgentStore for profiles, wallet credentials, social graph, interaction log
- [x] **Integration tests** — End-to-end protocol and agent lifecycle tests
- [x] ~npm publish~ (deferred — needs npm auth)

## Phase 3: Agent Network (v0.3) — DONE

Agents talk to each other over the network.

- [x] **WebSocket transport** — NetworkMessageBus replaces in-memory bus, works across machines
- [x] **Agent discovery registry** — HTTP registry server + client (register, discover, lookup, unregister)
- [x] **Auto-handshake (viral loop)** — discoverAndConnect() automatically discovers peers, connects via WebSocket, sends handshakes, builds social graph
- [x] **Demo app** — Single-page Vite web app visualising the viral loop with animated timeline
- [x] **CLI agent start** — `auth agent start` runs a networked agent node
- [x] **CI updated** — builds all 6 workspace projects including demo app

## Phase 4: Platform (v0.4) — Next

The viral loop in production.

- [ ] **Creator onboarding flow** — Target visual artists on Instagram/X as the first niche
- [ ] **Verification badge** — Browser extension or embeddable widget that displays the authenticity badge on content
- [ ] **Brand verification portal** — Brands can verify creator authenticity and audience quality
- [ ] **Platform API** — Public API for social platforms to integrate the verification layer
- [ ] **EU AI Act compliance** — Article 50 compliance: automatic AI-content labeling using the credential system
- [ ] **npm publish** — Publish @auth/protocol and @auth/agent to npm
- [ ] **CLI SQLite migration** — Migrate CLI from JSON file storage to SQLite

## Phase 5: Protocol Standardisation (v0.5+)

- [ ] **Open governance** — Move the protocol to a foundation or working group
- [ ] **Cross-platform SDKs** — Python, Rust, Swift implementations
- [ ] **Reputation oracle network** — Decentralised reputation computation
- [ ] **Stake-slashing economics** — Full economic model for the stake/slash system
- [ ] **Multi-dimensional reputation** — Separate scores for different trust dimensions

## Technology Choices

| Layer | Current (v0.3) | Target (v0.4) |
|-------|---------------|---------------|
| Crypto | @noble/ed25519 (pure JS) | Same — audited, no native deps |
| Persistence | SQLite (better-sqlite3) | Same + encrypted variant |
| LLM | Mock + Ollama + OpenAI | Same + local-first preference |
| Network | WebSocket (ws) | Same + A2A protocol compliance |
| Discovery | HTTP registry server | Federated registries |
| Packaging | pnpm workspace | npm published packages |
| CI | GitHub Actions | Same + automated npm publish |

## Stats (v0.3)

- **124 tests** across **20 test suites**, all passing
- **6 workspace projects**: @auth/protocol, @auth/agent, @auth/cli, @auth/registry-server, @auth/demo
- **4 packages**, **2 apps**
