/**
 * @auth/agent — LLM provider abstraction
 *
 * Pluggable content-generation backends for the Agent.
 * Implementations:
 *   - MockProvider    : deterministic, for tests
 *   - OllamaProvider  : local Ollama HTTP API
 *   - OpenAIProvider  : OpenAI Chat Completions API
 *
 * Each provider takes a prompt + options and returns a generated string.
 */

export interface LLMOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  generate(prompt: string, options?: LLMOptions): Promise<string>;
}

/**
 * Deterministic provider for tests and offline development.
 * Returns a fixed, prompt-derived string — no network.
 */
export class MockProvider implements LLMProvider {
  generate(prompt: string, _options?: LLMOptions): Promise<string> {
    return Promise.resolve(`Generated content for: ${prompt}`);
  }
}

/**
 * Local Ollama provider (http://localhost:11434 by default).
 * Uses the /api/generate endpoint with stream disabled.
 */
export class OllamaProvider implements LLMProvider {
  constructor(
    private model: string = "llama3",
    private baseUrl: string = "http://localhost:11434"
  ) {}

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      prompt,
      stream: false,
      options: {
        temperature: options?.temperature,
        num_predict: options?.maxTokens,
      },
    };

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as { response: string };
    return json.response;
  }
}

/**
 * OpenAI Chat Completions provider.
 * Requires an API key; uses global fetch (Node 22+).
 */
export class OpenAIProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private model: string = "gpt-4o-mini"
  ) {}

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`OpenAI request failed: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return json.choices[0].message.content;
  }
}
