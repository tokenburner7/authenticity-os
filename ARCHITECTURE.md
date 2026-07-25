# Authenticity OS — Architecture

## Overview

A monorepo containing two packages that form a unified system:

1. **@auth/protocol** — The authenticity protocol: portable, reputation-weighted credentials for verifiable human authenticity.
2. **@auth/agent** — The personal AI agent platform: trains on user data, carries identity credentials, and interacts with other agents.

The agent platform is the application that drives adoption of the protocol. The protocol is the trust infrastructure that makes agent-to-agent interaction reliable.

## System Diagram

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
│         │            │        │  │  (vouch-weighted   │ │
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

## Package Structure

```
authenticity-os/
├── package.json              # Workspace root
├── pnpm-workspace.yaml       # Workspace config
├── tsconfig.base.json        # Shared TS config
├── ARCHITECTURE.md           # This file
├── PROTOCOL_SPEC.md          # Protocol specification
├── ROADMAP.md                # Development roadmap
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions CI
└── packages/
    ├── protocol/             # @auth/protocol
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── index.ts      # Public API
    │   │   ├── types.ts      # All type definitions
    │   │   ├── crypto.ts     # Ed25519 signing, hashing
    │   │   ├── identity.ts   # Identity anchor management
    │   │   ├── credentials.ts # Credential issuance
    │   │   ├── reputation.ts  # Reputation graph
    │   │   └── verification.ts # Verification engine
    │   └── tests/
    │       ├── crypto.test.ts
    │       ├── identity.test.ts
    │       ├── credentials.test.ts
    │       ├── reputation.test.ts
    │       └── verification.test.ts
    └── agent/                # @auth/agent
        ├── package.json
        ├── tsconfig.json
        ├── src/
        │   ├── index.ts      # Public API
        │   ├── types.ts      # Agent types
        │   ├── agent.ts      # Agent core
        │   ├── wallet.ts     # Identity wallet
        │   ├── communication.ts # Agent-to-agent messaging
        │   └── utils.ts      # Utilities
        └── tests/
            ├── agent.test.ts
            └── communication.test.ts
```

## Design Principles

1. **Local-first** — Sensitive data (private keys, user training data) stays on-device. The agent runs locally; cloud is only for heavy compute with E2E encryption.

2. **Protocol over platform** — The protocol is open. The agent platform is the reference implementation. Other platforms can integrate the protocol without depending on the agent package.

3. **Transparency by default** — AI-assisted content is always labeled with the assistance level. The credential system makes AI involvement verifiable, not just claimed.

4. **Reputation is earned, not bought** — Trust scores are computed from on-protocol behavior (vouches, verified interactions). Stake-slashing penalises false claims.

5. **Network effects are structural** — Agent-to-agent interaction is the viral engine. Each new agent increases value for all existing agents. Each new credential increases the protocol's data moat.
