// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { renderBadge } from "../src/widget";
import {
  createIdentity,
  attestCreation,
  contentHash,
  type SignedCredential,
} from "@auth/protocol";

// Shared fixtures created once per test file
const alice = createIdentity("alice", "social");
const content = "My original human-written post about authenticity.";
const hash = contentHash(content);
const validCredential: SignedCredential = attestCreation(alice, hash, "none", "original");

/** Tampered copy: change the content hash so the signature no longer matches. */
function tamperedCredential(): SignedCredential {
  const copy: SignedCredential = JSON.parse(JSON.stringify(validCredential));
  copy.payload.subject.contentHash = "fake-tampered-hash";
  return copy;
}

describe("renderBadge", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("creates DOM elements in the container", () => {
    renderBadge(container, validCredential);

    const badge = container.querySelector(".auth-badge");
    expect(badge).not.toBeNull();

    const button = container.querySelector(".auth-badge-button");
    expect(button).not.toBeNull();

    // Should have inline SVG icon
    const icon = container.querySelector(".auth-badge-icon");
    expect(icon).not.toBeNull();
  });

  it('shows "Verified" for a valid credential', () => {
    renderBadge(container, validCredential);

    const label = container.querySelector(".auth-badge-label");
    expect(label?.textContent).toBe("Verified");
    expect(label?.classList.contains("auth-badge-verified")).toBe(true);
  });

  it('shows "Invalid" for a tampered credential', () => {
    renderBadge(container, tamperedCredential());

    const label = container.querySelector(".auth-badge-label");
    expect(label?.textContent).toBe("Invalid");
    expect(label?.classList.contains("auth-badge-invalid")).toBe(true);
  });

  it("shows the AI assistance level", () => {
    const aiCredential = attestCreation(alice, hash, "fully-ai", "agent-generated");
    renderBadge(container, aiCredential);

    const aiSpan = container.querySelector(".auth-badge-ai");
    expect(aiSpan?.textContent).toBe("Fully AI");
  });

  it("shows 'Human-made' for none AI assistance", () => {
    renderBadge(container, validCredential);

    const aiSpan = container.querySelector(".auth-badge-ai");
    expect(aiSpan?.textContent).toBe("Human-made");
  });

  it("click expands details panel", () => {
    renderBadge(container, validCredential);

    const details = container.querySelector(".auth-badge-details") as HTMLElement;
    expect(details).not.toBeNull();
    // Initially closed
    expect(details.classList.contains("auth-badge-open")).toBe(false);

    const button = container.querySelector(".auth-badge-button") as HTMLButtonElement;
    button.click();

    expect(details.classList.contains("auth-badge-open")).toBe(true);
  });

  it("details panel contains the full credential JSON", () => {
    renderBadge(container, validCredential, { showDetails: true });

    const pre = container.querySelector(".auth-badge-details pre");
    expect(pre).not.toBeNull();
    const parsed = JSON.parse(pre!.textContent!);
    expect(parsed.signature).toBe(validCredential.signature);
    expect(parsed.signer).toBe(validCredential.signer);
    expect(parsed.payload.type).toBe("creation");
  });

  it("shows the issuer's truncated ID", () => {
    renderBadge(container, validCredential);

    const issuer = container.querySelector(".auth-badge-issuer");
    expect(issuer).not.toBeNull();
    // Should contain the truncated signer ID (first chars + ellipsis)
    expect(issuer?.textContent?.startsWith(alice.id.slice(0, 4))).toBe(true);
  });

  it("applies dark theme class", () => {
    renderBadge(container, validCredential, { theme: "dark" });

    const badge = container.querySelector(".auth-badge");
    expect(badge?.classList.contains("auth-badge-dark")).toBe(true);
  });

  it("applies compact class and hides issuer", () => {
    renderBadge(container, validCredential, { compact: true });

    const badge = container.querySelector(".auth-badge");
    expect(badge?.classList.contains("auth-badge-compact")).toBe(true);
  });

  it("starts with details open when showDetails is true", () => {
    renderBadge(container, validCredential, { showDetails: true });

    const details = container.querySelector(".auth-badge-details");
    expect(details?.classList.contains("auth-badge-open")).toBe(true);
  });
});
