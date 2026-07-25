# Authenticity OS — Development Roadmap

## Phase 1: Foundation (v0.1) — DONE

The scaffold. Both packages exist with working crypto, credentials, reputation, agents, and agent-to-agent messaging. All tests pass.

- [x] Monorepo scaffold (pnpm workspace, TypeScript, strict mode)
- [x] @auth/protocol: Ed25519 crypto, identity anchors, 4 credential types, reputation graph (count-based), verification engine
- [x] @auth/agent: Agent core, identity wallet, delegation, message bus, agent-to-agent communication
- [x] Test suite: crypto, identity, credentials, reputation, verification, agent, communication
- [x] Architecture docs, protocol spec, CI

## Phase 2: Minimum Viable Product (v0.2) — Next

Make the protocol usable by real creators.

- [ ] **LLM-backed content drafting** — Integrate an LLM (local or API) so the agent can actually draft content, not just sign pre-written text
- [ ] **Local persistence** — Encrypted on-device storage for identity, credentials, and wallet (SQLite with SQLCipher or similar)
- [ ] **Credential export/import** — Portability: export your credentials as W3C VC JSON, import into other tools
- [ ] **Stake-weighted reputation** — v0.2 reputation: stake tokens on claims, slashing for false claims
- [ ] **CLI tool** — `auth-protocol` CLI for creating identities, issuing credentials, verifying content
- [ ] **Integration tests** — End-to-end: create identity → build reputation → issue credential → verify
- [ ] **Publish to npm** — Both packages published as scoped packages

## Phase 3: Agent Network (v0.3)

Make agents talk to each other over the network.

- [ ] **A2A protocol implementation** — Implement the Agent-to-Agent protocol over HTTP/WebSocket
- [ ] **Agent discovery** — How agents find each other (DHT, registry, or peer-to-peer)
- [ ] **Skill marketplace architecture** — Plugin system for agent capabilities
- [ ] **Agent training pipeline** — Learn user preferences from interactions, corrections, and explicit config
- [ ] **Social graph persistence** — The agent's social graph survives restarts and syncs across devices
- [ ] **Demo app** — A simple web app showing two agents interacting with each other and exchanging verified credentials

## Phase 4: Platform (v0.4)

The viral loop in production.

- [ ] **Creator onboarding flow** — Target visual artists on Instagram/X as the first niche
- [ ] **Verification badge** — Browser extension or embeddable widget that displays the authenticity badge on content
- [ ] **Brand verification portal** — Brands can verify creator authenticity and audience quality
- [ ] **Platform API** — Public API for social platforms to integrate the verification layer
- [ ] **EU AI Act compliance** — Article 50 compliance: automatic AI-content labeling using the credential system

## Phase 5: Protocol Standardisation (v0.5+)

- [ ] **Open governance** — Move the protocol to a foundation or working group
- [ ] **Cross-platform SDKs** — Python, Rust, Swift implementations
- [ ] **Reputation oracle network** — Decentralised reputation computation
- [ ] **Stake-slashing economics** — Full economic model for the stake/slash system
- [ ] **Multi-dimensional reputation** — Separate scores for different trust dimensions

## Technology Choices

| Layer | Current (v0.1) | Target (v0.4) |
|-------|---------------|---------------|
| Crypto | @noble/ed25519 (pure JS) | Same — audited, no native deps |
| Persistence | In-memory | SQLite + SQLCipher (local-first) |
| LLM | None | Local (Ollama) or API (OpenAI, Anthropic) |
| Network | In-memory bus | WebSocket + A2A protocol |
| Packaging | pnpm workspace | npm published packages |
| CI | GitHub Actions | Same + automated npm publish |
