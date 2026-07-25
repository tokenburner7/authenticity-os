import { describe, it, expect } from "vitest";
import {
  createIdentity,
  attestCreation,
  delegateCreation,
  generateLabel,
  checkCompliance,
  checkUnregisteredContent,
  generateManifest,
  generateMetaTags,
  contentHash,
} from "../src/index.js";

describe("Article 50 compliance", () => {
  describe("generateLabel", () => {
    it("labels human-only content (aiAssistance: none)", () => {
      const alice = createIdentity("alice", "peer");
      const cred = attestCreation(alice, contentHash("my post"), "none");
      const label = generateLabel(cred);

      expect(label.label).toBe("human-only");
      expect(label.requiresDisclosure).toBe(false);
      expect(label.aiAssistance).toBe("none");
    });

    it("labels AI-assisted content (aiAssistance: partial)", () => {
      const alice = createIdentity("alice", "peer");
      const cred = attestCreation(alice, contentHash("my post"), "partial");
      const label = generateLabel(cred);

      expect(label.label).toBe("ai-assisted");
      expect(label.requiresDisclosure).toBe(false);
    });

    it("labels AI-generated content (aiAssistance: ai-assisted)", () => {
      const alice = createIdentity("alice", "peer");
      const cred = attestCreation(alice, contentHash("my post"), "ai-assisted");
      const label = generateLabel(cred);

      expect(label.label).toBe("ai-generated");
      expect(label.requiresDisclosure).toBe(true);
    });

    it("labels fully AI-generated content (aiAssistance: fully-ai)", () => {
      const alice = createIdentity("alice", "peer");
      const cred = attestCreation(alice, contentHash("my post"), "fully-ai");
      const label = generateLabel(cred);

      expect(label.label).toBe("ai-fully-generated");
      expect(label.requiresDisclosure).toBe(true);
    });
  });

  describe("checkCompliance", () => {
    it("returns compliant for valid human-only credential", () => {
      const alice = createIdentity("alice", "peer");
      const cred = attestCreation(alice, contentHash("my post"), "none");
      const result = checkCompliance(cred);

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.label!.label).toBe("human-only");
    });

    it("returns compliant for valid AI-assisted credential with disclosure", () => {
      const alice = createIdentity("alice", "peer");
      const cred = attestCreation(alice, contentHash("my post"), "ai-assisted");
      const result = checkCompliance(cred);

      expect(result.compliant).toBe(true);
      expect(result.label!.label).toBe("ai-generated");
      expect(result.label!.requiresDisclosure).toBe(true);
    });

    it("returns non-compliant for tampered credential", () => {
      const alice = createIdentity("alice", "peer");
      const cred = attestCreation(alice, contentHash("my post"), "none");
      cred.payload.subject.aiAssistance = "fully-ai";
      const result = checkCompliance(cred);

      expect(result.compliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it("flags deepfake risk for fully-ai delegation", () => {
      const alice = createIdentity("alice", "peer");
      const cred = delegateCreation(alice, contentHash("video"), "fully-ai");
      const result = checkCompliance(cred);

      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.includes("deepfake"))).toBe(true);
    });

    it("returns non-compliant for null credential", () => {
      const result = checkCompliance(null);

      expect(result.compliant).toBe(false);
      expect(result.violations[0]).toContain("No credential");
      expect(result.credential).toBeNull();
    });
  });

  describe("checkUnregisteredContent", () => {
    it("returns non-compliant for content without provenance", () => {
      const result = checkUnregisteredContent("some content");

      expect(result.compliant).toBe(false);
      expect(result.violations[0]).toContain("no authenticity credential");
      expect(result.label).toBeNull();
    });
  });

  describe("generateManifest", () => {
    it("produces a machine-readable manifest", () => {
      const alice = createIdentity("alice", "peer");
      const cred = attestCreation(alice, contentHash("post"), "ai-assisted");
      const manifest = generateManifest(cred);

      expect(manifest["@context"]).toBe("https://authenticity-os.org/article50/v1");
      expect(manifest.type).toBe("Article50ComplianceLabel");
      expect(manifest.label).toBe("ai-generated");
      expect(manifest.requiresDisclosure).toBe(true);
      expect(manifest.issuer).toBe(alice.id);
      expect(manifest.contentHash).toBeDefined();
      expect(manifest.signature).toBeDefined();
    });
  });

  describe("generateMetaTags", () => {
    it("produces HTML meta tags for embedding", () => {
      const alice = createIdentity("alice", "peer");
      const cred = attestCreation(alice, contentHash("post"), "none");
      const tags = generateMetaTags(cred);

      expect(tags).toHaveLength(5);
      expect(tags[0]).toContain('name="ai-content-label"');
      expect(tags[0]).toContain('content="human-only"');
      expect(tags[3]).toContain('name="ai-content-hash"');
    });
  });
});
