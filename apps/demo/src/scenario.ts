/**
 * Demo scenario — the authenticity protocol's viral loop.
 *
 * This runs entirely in the browser against @auth/protocol's pure-JS crypto.
 * @auth/agent is NOT imported here because it pulls in better-sqlite3 / ws /
 * node:http which don't exist in the browser. Instead the small slice of
 * agent behaviour the demo needs (drafting content + an in-process message
 * bus) is reimplemented inline in terms of the protocol.
 */

import {
  createIdentity,
  attestCreation,
  vouchFor,
  createReputationStore,
  recordVouch,
  verifyCredential,
  contentHash,
  toW3CVC,
  type Identity,
  type SignedCredential,
  type ReputationStore,
  type VerificationResult,
} from "@auth/protocol";

// ── Mini agent / message-bus (browser-safe reimplementation) ────────────────

interface Draft {
  from: string;
  to: string;
  content: string;
  credential: SignedCredential;
}

/**
 * Draft content on behalf of an identity and sign a creation credential.
 * Mirrors `agent.draftContent` + `attestCreation` from @auth/agent.
 */
export function draftContent(
  author: Identity,
  content: string,
  aiAssistance: "none" | "partial" | "ai-assisted" | "fully-ai" = "partial",
): { hash: string; credential: SignedCredential } {
  const hash = contentHash(content);
  const credential = attestCreation(author, hash, aiAssistance);
  return { hash, credential };
}

/** Deliver a draft + credential from one identity to another (in-process). */
export function sendDraft(draft: Draft, bus: Draft[]): void {
  bus.push(draft);
}

// ── Step model ──────────────────────────────────────────────────────────────

export interface Step {
  title: string;
  detail: string;
  credential?: string;
  badge?: "valid" | "invalid";
}

// ── Scenario ────────────────────────────────────────────────────────────────

export interface ScenarioResult {
  steps: Step[];
}

/**
 * Run the full viral-loop scenario synchronously and return the timeline.
 * The UI layer adds delays/animations between steps.
 */
export function runScenario(): ScenarioResult {
  const steps: Step[] = [];
  const bus: Draft[] = [];
  const rep = createReputationStore();

  // a. Alice creates her identity
  const alice = createIdentity("alice", "social");
  steps.push({
    title: "① Alice creates her identity",
    detail:
      `Handle @alice · assurance level "social" · Ed25519 keypair generated locally.\n` +
      `publicKey  = ${alice.id.slice(0, 32)}…\n` +
      `secretKey  = ${alice.secretKey.slice(0, 16)}… (never leaves her device)`,
  });

  // b. Bob creates his identity
  const bob = createIdentity("bob", "peer");
  steps.push({
    title: "② Bob creates his identity",
    detail:
      `Handle @bob · assurance level "peer".\n` +
      `publicKey  = ${bob.id.slice(0, 32)}…`,
  });

  // c. Carol and Dave vouch for Alice — reputation builds
  const carol = createIdentity("carol", "biometric");
  const dave = createIdentity("dave", "social");

  const vouchCarol = vouchFor(carol, alice.id, "known IRL for 3 years");
  recordVouch(rep, vouchCarol);
  steps.push({
    title: "③ Carol vouches for Alice",
    detail:
      `@carol (biometric assurance) signs a vouch credential targeting Alice.\n` +
      `Reputation recorded in the shared store.`,
    credential: JSON.stringify(toW3CVC(vouchCarol), null, 2),
  });

  const vouchDave = vouchFor(dave, alice.id, "collaborated on 12 projects");
  recordVouch(rep, vouchDave);
  steps.push({
    title: "④ Dave vouches for Alice",
    detail:
      `@dave adds a second vouch. Each vouch feeds Alice's social-trust dimension.`,
    credential: JSON.stringify(toW3CVC(vouchDave), null, 2),
  });

  // d. Alice's reputation score is now non-trivial
  const aliceRep = rep.records.get(alice.id);
  const score = aliceRep?.overall ?? 0;
  steps.push({
    title: `⑤ Alice's reputation rises to ${score}/100`,
    detail:
      `social-trust dimension: ${score}/100 from ${aliceRep?.dimensions[0]?.sampleSize ?? 0} vouches.\n` +
      `Diminishing-returns curve: score = 100·(1 − e^(−n/5)).`,
  });

  // e. Alice's agent drafts content with AI assistance
  const content =
    "On provenance-first media, every post ships with a signed credential. " +
    "That's the only way trust scales beyond Dunbar's number.";
  const { hash, credential } = draftContent(alice, content, "partial");
  steps.push({
    title: "⑥ Alice's agent drafts content (AI-assisted)",
    detail:
      `content       : "${content.slice(0, 60)}…"\n` +
      `contentHash   : ${hash.slice(0, 32)}…\n` +
      `aiAssistance  : partial — honestly disclosed in the credential.`,
    credential: JSON.stringify(toW3CVC(credential), null, 2),
  });

  // f. Bob receives the content over the message bus
  sendDraft({ from: alice.id, to: bob.id, content, credential }, bus);
  steps.push({
    title: "⑦ Bob receives the draft",
    detail:
      `Delivered over the in-process message bus.\n` +
      `Bob now holds: the content, the contentHash, and Alice's signed credential.`,
  });

  // g. Bob verifies Alice's credential
  const result: VerificationResult = verifyCredential(credential, rep, {
    minReputation: 10,
  });
  steps.push({
    title: "⑧ Bob verifies Alice's credential",
    detail:
      `verifyCredential() runs three checks: signature ✓, expiry ✓, reputation ≥ 10.\n` +
      `status: ${result.status}\nmessage: ${result.message}`,
    badge: result.status === "valid" ? "valid" : "invalid",
  });

  return { steps };
}
