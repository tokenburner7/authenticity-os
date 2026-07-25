/**
 * Demo page entrypoint — creates sample identities and credentials,
 * then renders badges in various configurations.
 */

import { renderBadge } from "./widget";
import {
  createIdentity,
  attestCreation,
  contentHash,
  type SignedCredential,
} from "@auth/protocol";

interface DemoCard {
  title: string;
  theme: "light" | "dark";
  content: string;
  credential: SignedCredential;
  options?: { compact?: boolean; showDetails?: boolean };
}

function buildCards(): DemoCard[] {
  // Deterministic-ish: create identities for the demo
  const alice = createIdentity("alice", "social");
  const bob = createIdentity("bob", "peer");

  // 1. Valid human-made credential
  const humanContent = "Every post ships with a signed credential. That's how trust scales.";
  const humanHash = contentHash(humanContent);
  const validHuman = attestCreation(alice, humanHash, "none", "original-work");

  // 2. Valid AI-assisted credential
  const aiContent = "Drafted with AI assistance, honestly disclosed.";
  const aiHash = contentHash(aiContent);
  const validAI = attestCreation(alice, aiHash, "partial", "gpt-collab");

  // 3. Fully AI credential
  const fullAiContent = "Generated entirely by my AI agent on my behalf.";
  const fullAiHash = contentHash(fullAiContent);
  const validFullAI = attestCreation(alice, fullAiHash, "fully-ai", "agent-delegated");

  // 4. Tampered credential (signature won't match)
  const tampered: SignedCredential = JSON.parse(JSON.stringify(validHuman));
  tampered.payload.subject.contentHash = "tampered-hash-12345";

  // 5. Compact badge
  const compactContent = "A compact badge for inline use.";
  const compactHash = contentHash(compactContent);
  const compactCred = attestCreation(bob, compactHash, "none");

  return [
    {
      title: "Verified · Human-made",
      theme: "light",
      content: humanContent,
      credential: validHuman,
      options: { showDetails: true },
    },
    {
      title: "Verified · AI-assisted",
      theme: "light",
      content: aiContent,
      credential: validAI,
    },
    {
      title: "Verified · Fully AI",
      theme: "dark",
      content: fullAiContent,
      credential: validFullAI,
    },
    {
      title: "Invalid · Tampered",
      theme: "light",
      content: humanContent,
      credential: tampered,
    },
    {
      title: "Compact",
      theme: "light",
      content: compactContent,
      credential: compactCred,
      options: { compact: true },
    },
    {
      title: "Compact · Dark",
      theme: "dark",
      content: aiContent,
      credential: validAI,
      options: { compact: true },
    },
  ];
}

function render(): void {
  const grid = document.getElementById("grid")!;
  for (const card of buildCards()) {
    const cardEl = document.createElement("div");
    cardEl.className = `card${card.theme === "dark" ? " card-dark" : ""}`;

    const h2 = document.createElement("h2");
    h2.textContent = card.title;
    cardEl.appendChild(h2);

    const content = document.createElement("div");
    content.className = "content";
    content.textContent = `"${card.content}"`;
    cardEl.appendChild(content);

    const slot = document.createElement("div");
    slot.className = "badge-slot";
    cardEl.appendChild(slot);

    renderBadge(slot, card.credential, {
      theme: card.theme,
      ...(card.options ?? {}),
    });

    grid.appendChild(cardEl);
  }
}

render();
