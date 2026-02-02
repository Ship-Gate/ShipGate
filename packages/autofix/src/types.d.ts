/**
 * Type declarations for external modules
 */

declare module '@isl-lang/ai-generator' {
  export function generateWithClaude(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      apiKey?: string;
      model?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<string>;
}

declare module 'openai' {
  export interface ChatCompletionMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }

  export interface ChatCompletionChoice {
    message: {
      content: string | null;
    };
  }

  export interface ChatCompletionResponse {
    choices: ChatCompletionChoice[];
  }

  export interface ChatCompletionsCreateOptions {
    model: string;
    max_tokens: number;
    temperature: number;
    messages: ChatCompletionMessage[];
  }

  export interface ChatCompletions {
    create(options: ChatCompletionsCreateOptions): Promise<ChatCompletionResponse>;
  }

  export interface OpenAIClient {
    chat: {
      completions: ChatCompletions;
    };
  }

  export default class OpenAI implements OpenAIClient {
    constructor(options: { apiKey?: string });
    chat: {
      completions: ChatCompletions;
    };
  }
}
