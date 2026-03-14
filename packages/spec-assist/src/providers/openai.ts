/**
 * OpenAI Provider - Real AI Provider using OpenAI API
 *
 * Requires OPENAI_API_KEY environment variable or config.
 */

import type { ChatMessage, CompletionOptions, SpecAssistConfig } from '../types.js';
import { BaseProvider, type ProviderResponse } from './base.js';

/**
 * OpenAI Provider Implementation
 *
 * Uses dynamic import so the stub can work without the openai package installed.
 */
export class OpenAIProvider extends BaseProvider {
  readonly name = 'openai';
  private client: unknown = null;
  /** Default to a model most accounts can use; set ISL_AI_MODEL or config.model to override (e.g. gpt-4o-mini, gpt-4). */
  private defaultModel = 'gpt-3.5-turbo';

  async initialize(config: SpecAssistConfig): Promise<void> {
    this.config = config;

    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OpenAI API key required. Set OPENAI_API_KEY env var or pass apiKey in config.'
      );
    }

    try {
      const OpenAIModule = await import('openai');
      const Mod = OpenAIModule as { default?: new (opts: { apiKey: string }) => unknown; OpenAI?: new (opts: { apiKey: string }) => unknown };
      const OpenAI = Mod.default ?? Mod.OpenAI;
      if (!OpenAI) throw new Error('OpenAI SDK did not export OpenAI constructor');
      this.client = new OpenAI({ apiKey });
    } catch (err) {
      throw new Error(
        `Failed to initialize OpenAI SDK: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  isReady(): boolean {
    return this.client !== null;
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<ProviderResponse> {
    if (!this.client) {
      throw new Error('Provider not initialized. Call initialize() first.');
    }

    const model = this.config?.model ?? this.defaultModel;
    const maxTokens = options?.maxTokens ?? this.config?.maxTokens ?? 4096;
    const temperature = options?.temperature ?? this.config?.temperature ?? 0.3;

    const apiMessages = messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    try {
      const openai = this.client as {
        chat: {
          completions: {
            create: (params: {
              model: string;
              messages: typeof apiMessages;
              max_tokens: number;
              temperature: number;
            }) => Promise<OpenAIResponse>;
          };
        };
      };
      const response = await openai.chat.completions.create({
        model,
        messages: apiMessages,
        max_tokens: maxTokens,
        temperature,
      });

      const content = response.choices?.[0]?.message?.content ?? '';
      const usage = response.usage;

      return {
        content,
        tokens: usage
          ? { input: usage.prompt_tokens ?? 0, output: usage.completion_tokens ?? 0 }
          : undefined,
        model: response.model ?? model,
      };
    } catch (err) {
      throw new Error(
        `OpenAI API error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export function createOpenAIProvider(): OpenAIProvider {
  return new OpenAIProvider();
}
