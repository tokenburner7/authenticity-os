# Authenticity Protocol Specification v0.1

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
