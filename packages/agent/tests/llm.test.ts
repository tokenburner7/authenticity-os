import { describe, it, expect } from "vitest";
import {
  createAgent,
  MockProvider,
  OllamaProvider,
  OpenAIProvider,
  type LLMProvider,
} from "../src/index.js";
import {
  contentHash,
  verifyCredentialSignature,
} from "@auth/protocol";

describe("MockProvider", () => {
  it("returns deterministic content", async () => {
    const provider = new MockProvider();
    const out = await provider.generate("hello");
    expect(out).toBe("Generated content for: hello");

    // Deterministic across calls
    const out2 = await provider.generate("hello");
    expect(out2).toBe(out);
  });

  it("honors the LLMProvider interface", () => {
    const provider: LLMProvider = new MockProvider();
    expect(typeof provider.generate).toBe("function");
  });
});

describe("Agent with LLM", () => {
  it("generateContent uses the provider and signs the result", async () => {
    const agent = createAgent({
      name: "LLM Agent",
      bio: "Generates content",
      capabilities: ["draft-content"],
    });
    agent.setLLMProvider(new MockProvider());

    const draft = await agent.generateContent(
      "a post about cryptography",
      "fully-ai",
      "mock-llm"
    );

    expect(draft.content).toBe("Generated content for: a post about cryptography");
    expect(draft.contentHash).toBe(
      contentHash("Generated content for: a post about cryptography")
    );
    expect(draft.aiAssistance).toBe("fully-ai");
    expect(draft.credential.payload.type).toBe("delegation");
    expect(draft.credential.payload.subject.aiAssistance).toBe("fully-ai");
    expect(verifyCredentialSignature(draft.credential)).toBe(true);
  });

  it("defaults to fully-ai assistance level", async () => {
    const agent = createAgent({
      name: "LLM Agent",
      bio: "Generates content",
      capabilities: ["draft-content"],
    });
    agent.setLLMProvider(new MockProvider());

    const draft = await agent.generateContent("anything");
    expect(draft.aiAssistance).toBe("fully-ai");
  });

  it("throws if no provider is set", async () => {
    const agent = createAgent({
      name: "No-LLM Agent",
      bio: "No provider",
      capabilities: [],
    });

    await expect(agent.generateContent("hi")).rejects.toThrow(/No LLM provider/);
  });
});

describe("OllamaProvider / OpenAIProvider (constructor only)", () => {
  it("construct without performing network I/O", () => {
    const ollama = new OllamaProvider("llama3", "http://localhost:11434");
    expect(ollama).toBeInstanceOf(OllamaProvider);
    expect(typeof ollama.generate).toBe("function");

    const openai = new OpenAIProvider("sk-test", "gpt-4o-mini");
    expect(openai).toBeInstanceOf(OpenAIProvider);
    expect(typeof openai.generate).toBe("function");
  });

  it("use default arguments", () => {
    const ollama = new OllamaProvider();
    expect(typeof ollama.generate).toBe("function");

    const openai = new OpenAIProvider("sk-test");
    expect(typeof openai.generate).toBe("function");
  });
});
