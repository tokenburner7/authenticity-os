/**
 * LLM provider integration tests.
 *
 * These tests exercise the OllamaProvider against a real Ollama instance
 * (http://localhost:11434). They are skipped automatically if Ollama is
 * not reachable or the model isn't available, so CI environments without
 * Ollama pass cleanly.
 *
 * The OpenAIProvider is not integration-tested here because it requires
 * an API key. Its constructor and request shape are covered by the unit
 * tests in llm.test.ts.
 */

import { describe, it, expect } from "vitest";
import { OllamaProvider, createAgent } from "../src/index.js";
import { verifyCredentialSignature } from "@auth/protocol";

// Use the smallest available model for fast test turnaround.
const OLLAMA_MODEL = "llama3.2:1b";
const OLLAMA_URL = "http://localhost:11434";

/** Check whether Ollama is reachable and has the test model. */
async function ollamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return false;
    const data = (await res.json()) as { models: Array<{ name: string }> };
    return data.models.some((m) => m.name.startsWith("llama3.2:1b"));
  } catch {
    return false;
  }
}

describe("OllamaProvider (integration)", () => {
  it(
    "generates content from a prompt",
    async () => {
      if (!(await ollamaAvailable())) return; // skip silently

      const provider = new OllamaProvider(OLLAMA_MODEL, OLLAMA_URL);
      const result = await provider.generate("Say hello in one word.", {
        temperature: 0,
        maxTokens: 10,
      });
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }, 30000);

  it("returns different output with different prompts", async () => {
    if (!(await ollamaAvailable())) return; // skip silently

    const provider = new OllamaProvider(OLLAMA_MODEL, OLLAMA_URL);
    const a = await provider.generate(
      "What is 2+2? Answer with just the number.",
      { temperature: 0, maxTokens: 10 }
    );
    const b = await provider.generate(
      "What is the capital of France? One word.",
      { temperature: 0, maxTokens: 10 }
    );
    // Different prompts should yield different responses.
    expect(a).not.toBe(b);
  }, 30000);
});

describe("Agent + OllamaProvider (integration)", () => {
  it(
    "generateContent uses Ollama and produces a valid signed credential",
    async () => {
      if (!(await ollamaAvailable())) return; // skip silently

      const agent = createAgent({
        name: "Ollama Agent",
        bio: "Generates content via Ollama",
        capabilities: ["draft-content"],
      });
      agent.setLLMProvider(new OllamaProvider(OLLAMA_MODEL, OLLAMA_URL));

      const draft = await agent.generateContent(
        "Write a one-sentence greeting.",
        "fully-ai",
        "ollama-integration-test"
      );

      // The content should be a non-empty string from the LLM.
      expect(typeof draft.content).toBe("string");
      expect(draft.content.length).toBeGreaterThan(0);

      // The credential should be a valid delegation credential signed by the agent.
      expect(draft.credential.payload.type).toBe("delegation");
      expect(draft.credential.payload.subject.aiAssistance).toBe("fully-ai");
      expect(draft.aiAssistance).toBe("fully-ai");
      expect(verifyCredentialSignature(draft.credential)).toBe(true);
    }, 30000);
});
