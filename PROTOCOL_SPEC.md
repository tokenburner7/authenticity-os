# Authenticity Protocol Specification v0.4

## Abstract

A portable, reputation-weighted credential system for verifiable human authenticity. The protocol issues cryptographic credentials that prove: "this specific human, with this track record, vouches for this content, and here is the evidence."

It sits between identity verification (World ID, Veriff) and content provenance (C2PA), filling the gap that neither addresses: who is the human behind the content, and can you trust them?

## Layer 1: Identity Anchor

An identity anchor is an Ed25519 keypair with an associated assurance level.

```
IdentityAnchor {
  id: string          // Ed25519 public key (hex)
  handle: string      // Human-readable name
  assurance: "peer" | "social" | "biometric" | "government"
  createdAt: string   // ISO 8601
}
```

**Assurance levels** (ascending):
- `peer` — vouched for by other protocol participants (web of trust)
- `social` — verified via social graph analysis (connected to reputable identities)
- `biometric` — verified via biometric scan (e.g., World ID Orb)
- `government` — verified via government-issued ID (e.g., Veriff)

Higher assurance levels are required for higher-stakes credentials. The market decides which level each use case requires.

## Layer 2: Credential

A credential is a signed claim. Four types:

### Creation Credential
"I created this content, with this level of AI assistance."
```
{
  type: "creation",
  issuer: <identity-id>,
  subject: {
    contentHash: <sha512-hex>,
    aiAssistance: "none" | "partial" | "ai-assisted" | "fully-ai",
    evidence: <optional URI or proof>
  }
}
```

### Vouch Credential
"I vouch for this person."
```
{
  type: "vouch",
  issuer: <identity-id>,
  subject: {
    targetId: <identity-id>,
    aiAssistance: "none",
    evidence: <optional>
  }
}
```

### Delegation Credential
"My AI agent created this on my behalf, with my authorisation."
```
{
  type: "delegation",
  issuer: <identity-id>,
  subject: {
    contentHash: <sha512-hex>,
    aiAssistance: "partial" | "ai-assisted" | "fully-ai",
    evidence: <optional>
  }
}
```

### Identity Credential
"I am a unique human." (issued by the protocol itself, not by other users)
```
{
  type: "identity",
  issuer: <identity-id>,
  subject: {
    aiAssistance: "none"
  }
}
```

## Signing

All credentials are signed with Ed25519. The signature is over the canonicalised JSON of the payload (sorted keys, no whitespace).

```
signature = Ed25519.sign(canonicalise(payload), secretKey)
```

## Layer 3: Reputation Graph

Reputation is computed from on-protocol behavior:

- **v0.1 (current)**: Count-based. Each vouch from a unique identity adds to the target's "social-trust" score. Diminishing returns: `score = 100 * (1 - e^(-n/5))` where n = number of vouches.

- **v0.2 (planned)**: Stake-weighted. Identities stake tokens on their claims. Vouches from high-stake, high-reputation identities carry more weight. False claims slash the stake.

- **v0.3 (planned)**: Multi-dimensional. Separate scores for "content-creator", "trusted-reviewer", "honest-counterparty", etc. Computed from different credential types and interaction patterns.

## Layer 4: Verification API

Anyone can verify any credential:

```
verifyCredential(credential, reputationStore, options?) → VerificationResult

VerificationResult {
  status: "valid" | "invalid-signature" | "expired" | "revoked" |
          "low-reputation" | "unknown-issuer"
  credential?: SignedCredential
  reputation?: ReputationRecord
  message: string
  verifiedAt: string
}
```

The verification checks, in order:
1. Signature validity (Ed25519)
2. Expiry (if expiresAt is set)
3. Issuer reputation (if minReputation threshold is specified)

## AI Assistance Levels

| Level | Meaning |
|-------|---------|
| `none` | Entirely human-created, no AI involvement |
| `partial` | Human-created with AI assistance (e.g., spell-check, research) |
| `ai-assisted` | AI drafted, human reviewed and approved |
| `fully-ai` | AI generated without human review |

This transparency is the protocol's answer to the authenticity backlash. The backlash isn't anti-AI — it's anti-deception. The protocol makes AI involvement verifiable.

## Relationship to Existing Standards

| Standard | What They Do | What We Add |
|----------|-------------|-------------|
| C2PA | Cryptographic provenance for media files | Reputation layer. C2PA tells you the editing chain; we tell you whether to trust the human who signed it. |
| World ID | Proof of unique humanity (iris scan) | Content-level provenance and reputation graph. World ID says "you're human"; we say "and here's what you've done." |
| W3C VC 2.0 | Standard for verifiable credentials | We use W3C VC as the data model. We add the reputation layer and the consumer-facing protocol on top. |

---

## Persistence Layer

**Source:** `packages/protocol/src/sqlite-store.ts`

The protocol persists all state locally via the `SqliteStore` class, which implements the `ProtocolStore` interface on top of [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3). There are no network calls and no external dependencies — every node keeps its own complete database. The default database is `:memory:`; production deployments pass a file path.

### Schema

The store initialises four logical tables on construction (WAL journal mode enabled):

```sql
CREATE TABLE identities (
  id          TEXT PRIMARY KEY,   -- Ed25519 public key (hex)
  handle      TEXT NOT NULL,
  secret_key  TEXT NOT NULL,
  assurance   TEXT NOT NULL,      -- peer | social | biometric | government
  created_at  TEXT NOT NULL       -- ISO 8601
);

CREATE TABLE credentials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  payload_json  TEXT NOT NULL,    -- canonical credential payload
  signature     TEXT NOT NULL,    -- Ed25519 signature (hex)
  signer        TEXT NOT NULL,    -- issuer identity id
  type          TEXT NOT NULL,    -- creation | vouch | delegation | identity
  content_hash  TEXT,             -- nullable; set for creation/delegation
  target_id     TEXT,             -- nullable; set for vouch
  issued_at     TEXT NOT NULL
);
CREATE INDEX idx_credentials_issuer       ON credentials(signer);
CREATE INDEX idx_credentials_content_hash ON credentials(content_hash);
CREATE INDEX idx_credentials_target       ON credentials(target_id);

CREATE TABLE reputation (
  identity_id     TEXT PRIMARY KEY,
  overall         INTEGER NOT NULL,
  dimensions_json TEXT NOT NULL,   -- multi-dimensional scores (v0.3)
  updated_at      TEXT NOT NULL
);
```

Vouches are **not** stored in a separate table — they are `credentials` rows with `type = 'vouch'`. The `saveVouch` / `getVouchesFor` methods are typed conveniences over the credentials table.

### Methods

| Method | Description |
|--------|-------------|
| `saveIdentity(identity)` | Insert or replace an identity anchor. |
| `loadIdentity(id)` | Load one identity by its public-key id. |
| `loadIdentityByHandle(handle)` | Load one identity by human-readable handle. |
| `loadAllIdentities()` | All identities, ordered by `created_at` ascending. |
| `saveCredential(credential)` | Persist any `SignedCredential` (creation, vouch, delegation, identity). |
| `loadAllCredentials()` | All credentials in insertion order. |
| `loadCredentialByContentHash(hash)` | First credential matching a `contentHash` (used by content verification). |
| `loadCredentialsByIssuer(issuerId)` | All credentials signed by a given identity. |
| `saveVouch(vouch)` | Persist a vouch credential (typed convenience over `saveCredential`). |
| `getVouchesFor(identityId)` | All vouch credentials whose `targetId` matches. |
| `saveReputation(record)` | Upsert a `ReputationRecord` for an identity. |
| `loadReputation(identityId)` | Load the stored reputation record, if any. |

### Consumers

- **CLI** (`packages/cli/src/db.ts`, class `CliDb`): A thin single-user wrapper around `SqliteStore`. It assumes one local identity (the first by creation order) and exposes convenience pass-throughs (`loadIdentity`, `saveCredential`, `loadCredentialByContentHash`, `saveVouch`, `getVouchesFor`, `saveReputation`, `loadReputation`, `getAllVouches`, `close`). The CLI creates the parent directory (e.g. `./.auth/`) on construction. `CliDb` replaces the deprecated JSON file store.
- **Verification API** (`apps/verification-api/src/server.ts`): Uses `SqliteStore` directly as the single source of truth. Reputation is *not* stored long-term on the API side; it is rebuilt on demand into an in-memory `ReputationStore` by replaying persisted vouches (see Platform Verification API below).

---

## W3C Verifiable Credential Interop

**Source:** `packages/protocol/src/w3c.ts`

The internal `SignedCredential` representation is optimised for the protocol's signing and verification pipeline. For interchange with other VC-compatible tooling, the protocol converts to and from the [W3C Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model/).

### Conversion functions

```
toW3CVC(credential: SignedCredential) → W3CVerifiableCredential
fromW3CVC(vc: W3CVerifiableCredential) → SignedCredential
```

### W3C VC shape

```
W3CVerifiableCredential {
  @context: [
    "https://www.w3.org/2018/credentials/v1",
    "https://authenticity-os.org/2026/credentials/v1"   // protocol extension
  ],
  type: ["VerifiableCredential", <protocol type>],
  issuer: <identity-id>,
  issuanceDate: <ISO 8601>,
  expirationDate?: <ISO 8601>,
  credentialSubject: {
    type?: "creation" | "vouch" | "delegation" | "identity",
    contentHash?: <sha512-hex>,
    targetId?: <identity-id>,
    aiAssistance: "none" | "partial" | "ai-assisted" | "fully-ai",
    evidence?: <URI or proof>,
    claims?: Record<string, string>
  },
  proof: {
    type: "Ed25519Signature2018",
    created: <ISO 8601>,
    verificationMethod: <signer public key (hex)>,
    proofValue: <Ed25519 signature (hex)>,
    nonce: <payload nonce>   // protocol extension — see note below
  }
}
```

### Round-trip and signature validity

The signature is computed over the canonicalised internal payload, which includes a random `nonce`. Because the nonce is not recoverable from the signature alone, `toW3CVC` carries it as the protocol-extension property `proof.nonce`. `fromW3CVC` reconstructs the payload exactly, so re-canonicalising it yields the same bytes the signer originally signed — **a round trip through `toW3CVC` → `fromW3CVC` preserves signature validity**. Without `proof.nonce`, round-trip verification would be impossible.

### CLI support

The CLI exposes W3C export and import directly:

```
auth export --format w3c   # emit the selected credential as a W3C VC JSON document
auth import --file <path>  # read a W3C VC (or internal form) and persist it
```

---

## EU AI Act Article 50 Compliance

**Source:** `packages/protocol/src/article50.ts`

[Article 50 of the EU AI Act](https://eur-lex.europa.eu/eli/reg/2024/1689) requires that AI-generated or AI-manipulated content be clearly labeled in a **machine-readable** way. **Enforcement begins 2 August 2026.** This module turns a credential's `aiAssistance` level into Article 50 compliance metadata, and verifies that content carries proper labeling.

### `Article50Label`

The six compliance categories the protocol can emit:

| Label | Meaning |
|-------|---------|
| `human-only` | No AI involvement whatsoever |
| `ai-assisted` | Human created with AI assistance (spell-check, research) |
| `ai-generated` | AI drafted, human reviewed and approved |
| `ai-fully-generated` | AI generated without human review |
| `deepfake` | Synthetic media depicting real persons |
| `ai-manipulated` | Real media altered by AI |

### `ComplianceLabel`

Machine-readable compliance metadata attached to content:

```
ComplianceLabel {
  label: Article50Label,
  description: string,            // human-readable, for display
  aiAssistance: AIAssistanceLevel,// original level from the credential
  requiresDisclosure: boolean,    // true if Article 50 disclosure is required
  labeledAt: string,              // ISO 8601
  protocolVersion: string         // version that generated the label
}
```

### `ComplianceResult`

```
ComplianceResult {
  compliant: boolean,
  label: ComplianceLabel | null,
  violations: string[],
  credential: SignedCredential | null,
  checkedAt: string
}
```

### Label generation: `generateLabel(credential)`

Maps a credential's `aiAssistance` level to an Article 50 category:

| `aiAssistance` | `Article50Label` | `requiresDisclosure` |
|----------------|------------------|----------------------|
| `none` | `human-only` | `false` |
| `partial` | `ai-assisted` | `false` |
| `ai-assisted` | `ai-generated` | `true` |
| `fully-ai` | `ai-fully-generated` | `true` |

(`deepfake` and `ai-manipulated` are reserved for synthetic/altered media and are not produced by the default level mapping.)

### Compliance checking: `checkCompliance(credential)`

Verifies that a credential carries proper Article 50 labeling — checks signature validity via `verifyCredentialSignature`, generates the expected `ComplianceLabel`, and returns a `ComplianceResult` with any violations listed. A credential is `compliant` only when its labeling is present, well-formed, and consistent with its declared AI assistance level.

---

## Platform Verification API

**Source:** `apps/verification-api/src/server.ts` (class `VerificationApiServer`)

An HTTP server that external platforms — social media, brand portals, content marketplaces — call to verify credentials, check content authenticity, and look up reputation for an identity. Listens on port **4001** by default. All responses are `application/json` with permissive CORS headers for browser-based callers.

The server is backed by a single `SqliteStore` instance. **SQLite is the source of truth.** Reputation is *not* trusted as stored; on every verification the server rebuilds an in-memory `ReputationStore` by replaying all persisted `vouch` credentials (`buildReputationStore()`), then runs the protocol's `verifyCredential()` against that derived view.

### Endpoints

| Method & Path | Body / Params | Response |
|---------------|---------------|----------|
| `GET /health` | — | `{ status, service, credentials: <count> }` — liveness + store size |
| `POST /verify` | `{ credential: SignedCredential }` | `VerificationResult` — validates signature, expiry, and issuer reputation derived from the vouch graph |
| `POST /verify-content` | `{ content, signature, signer }` | Verification of the content hash + Ed25519 signature against the claimed signer |
| `GET /credentials/:hash` | `hash` path param | The `SignedCredential` matching that content hash, or 404 |
| `GET /reputation/:id` | `id` path param | The `ReputationRecord` for an identity, derived from the vouch graph |
| `POST /batch-verify` | `{ credentials: SignedCredential[] }` | `VerificationResult[]` — one result per credential, same checks as `/verify` |

### Verification order (per credential)

1. **Signature** — Ed25519 over the canonicalised payload.
2. **Expiry** — if `expiresAt` is set and in the past, status `expired`.
3. **Issuer reputation** — if a `minReputation` threshold is supplied, status `low-reputation` when the issuer's derived score falls short; `unknown-issuer` when the issuer has no vouches on record.

### Seeding helpers

`VerificationApiServer.persistVouch(vouch)` and `persistCredential(credential)` persist signed credentials into the backing store — used by the entry point and tests to populate the vouch graph that reputation is derived from.
