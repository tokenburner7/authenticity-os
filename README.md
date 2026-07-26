# Authenticity OS

A protocol and agent platform for **verifiable human authenticity** in AI-mediated content.

The protocol issues portable, reputation-weighted cryptographic credentials that prove: *"this specific human, with this track record, vouches for this content, and here is the evidence."* It sits between identity verification (World ID, Veriff) and content provenance (C2PA), filling the gap that neither addresses: **who is the human behind the content, and can you trust them?**

The agent platform drives adoption — personal AI agents that carry identity credentials, discover peers, auto-handshake, and exchange reputation-weighted trust signals. Each new agent makes every other agent more useful.

## Status

**v0.4 — Phases 1–4 complete.** 158 tests across 23 suites, all passing. Build and lint clean.

| What | Status |
|------|--------|
| Protocol (crypto, credentials, reputation, verification) | Done |
| Agent platform (LLM, wallet, WebSocket, registry) | Done |
| CLI (10 commands) | Done |
| EU AI Act Article 50 compliance module | Done |
| Platform verification API server | Done |
| Brand verification portal + embeddable widget | Done |
| End-to-end system demo | `make demo` |
| npm publish | Deferred (v0.5) |

## Quick Start

**Prerequisites:** Node.js >= 22, pnpm >= 10

```bash
git clone <repo-url> authenticity-os
cd authenticity-os
pnpm install
pnpm build
```

Run the full test suite:

```bash
pnpm test
```

## End-to-End Demo

The quickest way to see the whole system working — registry server, two agents discovering each other, credential attestation, and verification — all in real time:

```bash
make demo
```

This script:
1. Starts the registry server (port 4000)
2. Starts the verification API (port 4001)
3. Launches two agents (ports 3001, 3002) that auto-discover and handshake
4. Attests content, vouches for reputation, and verifies the credential chain
5. Shuts everything down cleanly

For the web apps (viral loop visualiser, brand portal, widget):

```bash
make web-demo
```

## CLI Usage

```bash
# Create an identity anchor (Ed25519 keypair)
auth identity create --handle alice

# Attest content creation
auth attest --content "My original essay" --ai-assistance partial

# Vouch for another identity
auth vouch --target <pubkey-hex> --evidence "Known personally for 5 years"

# Check reputation
auth reputation show

# Verify a credential (signature + reputation)
auth verify --index 0

# Export as W3C Verifiable Credential
auth export --index 0 --format w3c > credential.json

# Import a W3C VC
auth import --file credential.json

# Start a networked agent node
auth agent start --name alice --port 3001 --registry http://localhost:4000

# Interactive creator onboarding wizard
auth onboard
```

## Architecture

```
authenticity-os/
├── packages/
│   ├── protocol/          @auth/protocol — crypto, credentials, reputation, SQLite, W3C VC, Article 50
│   ├── agent/             @auth/agent — agent core, LLM, wallet, WebSocket, registry client
│   └── cli/               @auth/cli — 10 commands, SQLite-backed
├── apps/
│   ├── registry-server/   Agent discovery HTTP server (port 4000)
│   ├── verification-api/  Platform verification API (port 4001)
│   ├── demo/              Viral loop visualiser (Vite, port 5173)
│   ├── brand-portal/      Brand verification web app (port 5174)
│   └── widget/            Embeddable authenticity badge
├── ARCHITECTURE.md
├── PROTOCOL_SPEC.md
└── ROADMAP.md
```

### @auth/protocol

The trust infrastructure. No external dependencies beyond `@noble/ed25519` and `better-sqlite3`.

- **Identity anchors** — Ed25519 keypairs with assurance levels (peer → social → biometric → government)
- **Four credential types** — identity, creation, vouch, delegation
- **Reputation graph** — Vouch-weighted trust scores (0–100), multi-dimensional
- **Verification engine** — Signature check + reputation threshold + expiry
- **W3C VC export/import** — Portable verifiable credentials with full round-trip fidelity
- **SQLite persistence** — Identities, credentials, reputation, vouches
- **EU AI Act Article 50** — Machine-readable compliance labels, disclosure checking, HTML meta tags

### @auth/agent

The adoption engine. Personal AI agents that carry credentials and interact peer-to-peer.

- **Agent core** — Content drafting, delegation, identity-bound actions
- **LLM integration** — Pluggable providers: Mock (testing), Ollama (local), OpenAI (cloud)
- **Identity wallet** — Holds credentials and social graph
- **WebSocket transport** — Agent-to-agent message bus
- **Registry client** — Discovers peers via the registry server
- **Auto-handshake** — Agents discover and connect automatically (the viral loop)
- **SQLite persistence** — Agent state and message history

### Apps

| App | Port | Purpose |
|-----|------|---------|
| registry-server | 4000 | Agent discovery — register, list, look up peers |
| verification-api | 4001 | External verification — verify credentials, content, reputation over HTTP |
| demo | 5173 | Viral loop visualiser — watch agents handshake in real time |
| brand-portal | 5174 | Brand verification web app — check creator authenticity |
| widget | — | Embeddable authenticity badge for third-party sites |

## Protocol Spec

See [PROTOCOL_SPEC.md](PROTOCOL_SPEC.md) for the full protocol specification, including credential schemas, reputation mechanics, and the Article 50 compliance model.

## Development

```bash
pnpm build       # Build all packages
pnpm test        # Run all tests (vitest)
pnpm lint        # Type-check all packages
pnpm clean       # Remove dist + node_modules
```

**Tech stack:** pnpm workspace, TypeScript (strict), @noble/ed25519, better-sqlite3, vitest, ws, Vite, commander.

## License

MIT
