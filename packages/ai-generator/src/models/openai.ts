/**
 * OpenAI GPT API Integration
 * 
 * Handles code generation using GPT models.
 */

import OpenAI from 'openai';

export interface OpenAIOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  organization?: string;
}

export interface OpenAIResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

const DEFAULT_MODEL = 'gpt-4-turbo-preview';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0;

export class OpenAIClient {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(options: OpenAIOptions = {}) {
    const apiKey = options.apiKey ?? process.env['OPENAI_API_KEY'];
    
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY is required. ' +
        'Set it via options.apiKey or OPENAI_API_KEY environment variable.'
      );
    }

    this.client = new OpenAI({ 
      apiKey,
      organization: options.organization ?? process.env['OPENAI_ORGANIZATION'],
    });
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  }

  /**
   * Generate code using GPT
   */
  async generate(
    systemPrompt: string,
    userPrompt: string,
    options?: Partial<OpenAIOptions>
  ): Promise<OpenAIResponse> {
    const model = options?.model ?? this.model;
    const maxTokens = options?.maxTokens ?? this.maxTokens;
    const temperature = options?.temperature ?? this.temperature;

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No completion choice returned from OpenAI');
    }

    const content = choice.message.content;
    if (!content) {
      throw new Error('Empty content returned from OpenAI');
    }

    return {
      content,
      model: response.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      finishReason: choice.finish_reason ?? 'unknown',
    };
  }

  /**
   * Generate with retry on rate limit
   */
  async generateWithRetry(
    systemPrompt: string,
    userPrompt: string,
    options?: Partial<OpenAIOptions>,
    maxRetries: number = 3
  ): Promise<OpenAIResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.generate(systemPrompt, userPrompt, options);
      } catch (error) {
        lastError = error as Error;
        
        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await this.sleep(delay);
          continue;
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }
    
    throw lastError ?? new Error('Max retries exceeded');
  }

  /**
   * Generate with streaming (for long responses)
   */
  async generateStream(
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    options?: Partial<OpenAIOptions>
  ): Promise<OpenAIResponse> {
    const model = options?.model ?? this.model;
    const maxTokens = options?.maxTokens ?? this.maxTokens;
    const temperature = options?.temperature ?? this.temperature;

    const stream = await this.client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    let fullContent = '';
    let finishReason = 'unknown';
    
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        onChunk(delta);
      }
      
      const reason = chunk.choices[0]?.finish_reason;
      if (reason) {
        finishReason = reason;
      }
    }

    return {
      content: fullContent,
      model,
      usage: {
        inputTokens: 0, // Not available in stream mode
        outputTokens: 0,
        totalTokens: 0,
      },
      finishReason,
    };
  }

  /**
   * Generate using JSON mode (structured output)
   */
  async generateJSON<T>(
    systemPrompt: string,
    userPrompt: string,
    options?: Partial<OpenAIOptions>
  ): Promise<{ content: T; raw: OpenAIResponse }> {
    const model = options?.model ?? this.model;
    const maxTokens = options?.maxTokens ?? this.maxTokens;
    const temperature = options?.temperature ?? this.temperature;

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: systemPrompt + '\n\nRespond with valid JSON only.',
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const choice = response.choices[0];
    if (!choice?.message.content) {
      throw new Error('No content returned from OpenAI');
    }

    const raw: OpenAIResponse = {
      content: choice.message.content,
      model: response.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      finishReason: choice.finish_reason ?? 'unknown',
    };

    try {
      const content = JSON.parse(choice.message.content) as T;
      return { content, raw };
    } catch {
      throw new Error(`Failed to parse JSON response: ${choice.message.content}`);
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof OpenAI.RateLimitError) {
      return true;
    }
    if (error instanceof Error && error.message.includes('rate_limit')) {
      return true;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get available models
   */
  static getAvailableModels(): string[] {
    return [
      'gpt-4-turbo-preview',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-4-32k',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
      'o1-preview',
      'o1-mini',
    ];
  }

  /**
   * Check if a model is valid
   */
  static isValidModel(model: string): boolean {
    return OpenAIClient.getAvailableModels().includes(model) || 
           model.startsWith('gpt-') ||
           model.startsWith('o1-');
  }
}

/**
 * Create a simple generate function for one-off use
 */
export async function generateWithGPT(
  systemPrompt: string,
  userPrompt: string,
  options?: OpenAIOptions
): Promise<string> {
  const client = new OpenAIClient(options);
  const response = await client.generate(systemPrompt, userPrompt);
  return response.content;
}
