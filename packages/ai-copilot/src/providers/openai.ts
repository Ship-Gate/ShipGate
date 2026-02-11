/**
 * OpenAI GPT Provider
 */
import OpenAI from 'openai';
import { BaseProvider } from './base';
import type {
  CopilotConfig,
  ConversationContext,
  GenerationResult,
  CompletionResult,
  CompletionRequest,
} from '../types';

export class OpenAIProvider extends BaseProvider {
  name = 'openai';
  private client: OpenAI | null = null;
  private model = 'gpt-4-turbo-preview';

  async initialize(config: CopilotConfig): Promise<void> {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model ?? 'gpt-4-turbo-preview';
  }

  async generate(prompt: string, context?: ConversationContext): Promise<GenerationResult> {
    if (!this.client) {
      throw new Error('OpenAI provider not initialized');
    }

    const systemPrompt = this.buildSystemPrompt();
    const contextStr = this.formatContext(context);
    const fullPrompt = contextStr ? `${contextStr}\n\nUser Request: ${prompt}` : prompt;

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.config?.maxTokens ?? 4096,
      temperature: this.config?.temperature ?? 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? '';

    const usage = (response as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
    return {
      content,
      type: 'isl',
      confidence: 0.85,
      tokens: {
        input: usage?.prompt_tokens ?? 0,
        output: usage?.completion_tokens ?? 0,
      },
    };
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    if (!this.client) {
      throw new Error('OpenAI provider not initialized');
    }

    const prompt = `Complete the following ISL code. Return only the completion, no explanation.

Prefix:
\`\`\`isl
${request.prefix}
\`\`\`
${request.suffix ? `\nSuffix:\n\`\`\`isl\n${request.suffix}\n\`\`\`` : ''}

Provide ${request.maxCompletions ?? 3} possible completions.`;

    const createOptions = {
      model: this.model,
      max_tokens: 1024,
      temperature: 0.3,
      n: request.maxCompletions ?? 3,
      messages: [
        { role: 'system', content: this.buildSystemPrompt() },
        { role: 'user', content: prompt },
      ],
    };
    const response = await this.client.chat.completions.create(createOptions as Parameters<OpenAI['chat']['completions']['create']>[0]) as OpenAI.Chat.Completions.ChatCompletion;

    return {
      completions: response.choices.map((choice: OpenAI.Chat.Completions.ChatCompletion.Choice, i: number) => ({
        text: choice.message?.content ?? '',
        displayText: (choice.message?.content ?? '').split('\n')[0],
        kind: 'snippet' as const,
        score: 1 - i * 0.1,
      })),
    };
  }

  async streamGenerate(
    prompt: string,
    context: ConversationContext | undefined,
    onChunk: (chunk: string) => void
  ): Promise<GenerationResult> {
    if (!this.client) {
      throw new Error('OpenAI provider not initialized');
    }

    const systemPrompt = this.buildSystemPrompt();
    const contextStr = this.formatContext(context);
    const fullPrompt = contextStr ? `${contextStr}\n\nUser Request: ${prompt}` : prompt;

    let fullContent = '';

    const streamOpts = {
      model: this.model,
      max_tokens: this.config?.maxTokens ?? 4096,
      temperature: this.config?.temperature ?? 0.7,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullPrompt },
      ],
    };
    const stream = await this.client.chat.completions.create(streamOpts as Parameters<OpenAI['chat']['completions']['create']>[0]);
    const streamIter = stream as unknown as AsyncIterable<{ choices?: Array<{ delta?: { content?: string } }> }>;
    for await (const chunk of streamIter) {
      const content = chunk.choices?.[0]?.delta?.content ?? '';
      if (content) {
        fullContent += content;
        onChunk(content);
      }
    }

    return {
      content: fullContent,
      type: 'isl',
      confidence: 0.85,
      tokens: {
        input: this.countTokens(fullPrompt),
        output: this.countTokens(fullContent),
      },
    };
  }

  countTokens(text: string): number {
    // Approximate token count for GPT models
    return Math.ceil(text.length / 4);
  }
}
