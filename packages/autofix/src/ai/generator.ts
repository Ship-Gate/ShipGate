/**
 * AI-Assisted Fix Generator
 * 
 * Uses LLMs to generate fixes for complex verification failures.
 */

import type { DomainDeclaration, BehaviorDeclaration } from '@isl-lang/isl-core';
import type { VerificationFailure, AnalysisResult, FixStrategy } from '../analyzer.js';
import type { Patch } from '../patcher.js';

// ============================================================================
// Types
// ============================================================================

export interface AIFixOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
  provider?: 'anthropic' | 'openai';
}

export interface AIFixResult {
  patches: Patch[];
  explanation: string;
  confidence: number;
  alternativeSuggestions?: string[];
}

export interface AIFixContext {
  domain: DomainDeclaration;
  behavior: BehaviorDeclaration;
  implementation: string;
  failure: VerificationFailure;
  analysis: AnalysisResult;
}

// ============================================================================
// AI Fix Generator
// ============================================================================

export class AIFixGenerator {
  private options: Required<AIFixOptions>;

  constructor(options: AIFixOptions = {}) {
    this.options = {
      model: options.model ?? 'claude-sonnet-4-20250514',
      maxTokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0,
      apiKey: options.apiKey ?? '',
      provider: options.provider ?? 'anthropic',
    };
  }

  /**
   * Generate a fix using AI
   */
  async generateFix(context: AIFixContext): Promise<AIFixResult> {
    // Build the prompt
    const prompt = this.buildPrompt(context);
    const systemPrompt = this.buildSystemPrompt();

    // Call the AI (using dynamic import to avoid hard dependency)
    const response = await this.callAI(systemPrompt, prompt);

    // Parse the response
    return this.parseResponse(response, context);
  }

  /**
   * Generate multiple fix alternatives
   */
  async generateAlternatives(
    context: AIFixContext,
    count: number = 3
  ): Promise<AIFixResult[]> {
    const results: AIFixResult[] = [];

    // Generate with slightly different temperatures
    const temps = [0, 0.3, 0.5].slice(0, count);

    for (const temp of temps) {
      const tempOptions = { ...this.options, temperature: temp };
      const generator = new AIFixGenerator(tempOptions);
      const result = await generator.generateFix(context);
      results.push(result);
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildSystemPrompt(): string {
    return `You are an expert software engineer fixing bugs in TypeScript implementations based on formal verification failures.

Your task is to analyze verification failures from ISL (Intent Specification Language) contracts and generate precise code fixes.

Rules:
1. Generate ONLY the specific code changes needed to fix the failure
2. Preserve all existing functionality that isn't related to the bug
3. Follow the exact contract requirements from the ISL specification
4. Use TypeScript with strict typing
5. Do NOT add unnecessary code or comments
6. Format your response as structured patches

Response format:
\`\`\`json
{
  "patches": [
    {
      "type": "insert" | "replace" | "delete",
      "line": <line_number>,
      "original": "<text to replace>",  // for replace only
      "replacement": "<new text>",      // for replace only
      "content": "<text to insert>",    // for insert only
      "description": "<brief description>"
    }
  ],
  "explanation": "<why this fix works>",
  "confidence": <0.0-1.0>
}
\`\`\``;
  }

  private buildPrompt(context: AIFixContext): string {
    const { domain, behavior, implementation, failure, analysis } = context;
    const sections: string[] = [];

    // Header
    sections.push(`# Fix Request for Verification Failure`);
    sections.push('');

    // Failure details
    sections.push(`## Verification Failure`);
    sections.push(`- Type: ${failure.type}`);
    sections.push(`- Predicate: ${failure.predicate}`);
    if (failure.expected !== undefined) {
      sections.push(`- Expected: ${JSON.stringify(failure.expected)}`);
    }
    if (failure.actual !== undefined) {
      sections.push(`- Actual: ${JSON.stringify(failure.actual)}`);
    }
    sections.push(`- Message: ${failure.message}`);
    if (failure.location) {
      sections.push(`- Location: ${failure.location.file}:${failure.location.line}`);
    }
    sections.push('');

    // Analysis
    sections.push(`## Analysis`);
    sections.push(`- Root Cause: ${analysis.rootCause.type}`);
    sections.push(`- Description: ${analysis.rootCause.description}`);
    sections.push(`- Suggested Strategy: ${analysis.suggestedStrategy}`);
    sections.push(`- Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
    sections.push('');

    // Related code
    if (analysis.relatedCode.length > 0) {
      sections.push(`## Related Code`);
      for (const segment of analysis.relatedCode.slice(0, 3)) {
        sections.push(`\`\`\`typescript`);
        sections.push(`// Lines ${segment.startLine + 1}-${segment.endLine + 1}`);
        sections.push(segment.code);
        sections.push(`\`\`\``);
        sections.push('');
      }
    }

    // Full implementation
    sections.push(`## Current Implementation`);
    sections.push('```typescript');
    sections.push(this.addLineNumbers(implementation));
    sections.push('```');
    sections.push('');

    // Behavior spec
    sections.push(`## Behavior Specification`);
    sections.push(`- Name: ${behavior.name.name}`);
    if (behavior.description) {
      sections.push(`- Description: ${behavior.description.value}`);
    }
    sections.push('');

    // Specific instructions based on failure type
    sections.push(`## Fix Instructions`);
    sections.push(this.getFixInstructions(failure.type, analysis.suggestedStrategy));
    sections.push('');

    sections.push('Generate the minimal set of patches to fix this verification failure.');

    return sections.join('\n');
  }

  private getFixInstructions(failureType: string, strategy: FixStrategy): string {
    const instructions: Record<string, string> = {
      'add_precondition_check': `Add a validation check at the start of the function that:
1. Validates the condition specified in the predicate
2. Throws an appropriate error if the validation fails
3. Does NOT modify any other logic`,

      'fix_return_value': `Fix the return value by:
1. Locating where the incorrect value is set
2. Changing it to the expected value
3. Ensuring the change doesn't break other postconditions`,

      'add_error_handler': `Add error handling by:
1. Adding a try-catch block if not present
2. Adding a specific handler for the missing error case
3. Ensuring the error is properly thrown or returned`,

      'fix_state_mutation': `Fix the state mutation by:
1. Adding validation before the mutation
2. Ensuring the invariant holds after the change
3. Consider using Math.max/min for bounds`,

      'add_timeout': `Add timeout handling by:
1. Wrapping the slow operation with a timeout
2. Using Promise.race with a timeout promise
3. Throwing a TimeoutError if exceeded`,

      'add_retry': `Add retry logic by:
1. Wrapping the operation in a retry loop
2. Using exponential backoff between retries
3. Setting a maximum retry count`,

      'add_cache': `Add caching by:
1. Creating a cache key from the inputs
2. Checking cache before expensive operations
3. Setting appropriate TTL`,

      'ai_assisted': `Analyze the failure carefully and determine:
1. The root cause of the failure
2. The minimal change needed to fix it
3. Any potential side effects`,
    };

    return instructions[strategy] ?? instructions['ai_assisted']!;
  }

  private addLineNumbers(code: string): string {
    return code
      .split('\n')
      .map((line, i) => `${String(i + 1).padStart(3, ' ')} | ${line}`)
      .join('\n');
  }

  private async callAI(systemPrompt: string, userPrompt: string): Promise<string> {
    // Try to use the ai-generator package if available
    try {
      const { generateWithClaude } = await import('@isl-lang/ai-generator');
      return await generateWithClaude(systemPrompt, userPrompt, {
        apiKey: this.options.apiKey || undefined,
        model: this.options.model,
        maxTokens: this.options.maxTokens,
        temperature: this.options.temperature,
      });
    } catch {
      // Fall back to direct API call
      return this.fallbackAICall(systemPrompt, userPrompt);
    }
  }

  private async fallbackAICall(systemPrompt: string, userPrompt: string): Promise<string> {
    // If no API key, return a mock response for testing
    if (!this.options.apiKey && !process.env['ANTHROPIC_API_KEY'] && !process.env['OPENAI_API_KEY']) {
      return this.generateMockResponse();
    }

    // Try Anthropic
    if (this.options.provider === 'anthropic' || process.env['ANTHROPIC_API_KEY']) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ 
        apiKey: this.options.apiKey || process.env['ANTHROPIC_API_KEY'] 
      });
      
      const response = await client.messages.create({
        model: this.options.model,
        max_tokens: this.options.maxTokens,
        temperature: this.options.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content = response.content[0];
      if (content?.type === 'text') {
        return content.text;
      }
    }

    // Try OpenAI
    if (this.options.provider === 'openai' || process.env['OPENAI_API_KEY']) {
      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({ 
        apiKey: this.options.apiKey || process.env['OPENAI_API_KEY'] 
      });
      
      const response = await client.chat.completions.create({
        model: this.options.model.includes('claude') ? 'gpt-4-turbo-preview' : this.options.model,
        max_tokens: this.options.maxTokens,
        temperature: this.options.temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      return response.choices[0]?.message.content ?? '';
    }

    return this.generateMockResponse();
  }

  private generateMockResponse(): string {
    return JSON.stringify({
      patches: [{
        type: 'insert',
        line: 2,
        content: '  // AI fix placeholder - configure API key for actual fixes',
        description: 'Placeholder fix',
      }],
      explanation: 'AI fix generation requires an API key. Configure ANTHROPIC_API_KEY or OPENAI_API_KEY.',
      confidence: 0.1,
    });
  }

  private parseResponse(response: string, context: AIFixContext): AIFixResult {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1]! : response;
      
      const parsed = JSON.parse(jsonStr);

      // Validate and normalize patches
      const patches: Patch[] = (parsed.patches ?? []).map((p: Partial<Patch>) => ({
        type: p.type ?? 'insert',
        file: 'implementation',
        line: p.line ?? 1,
        content: p.content,
        original: p.original,
        replacement: p.replacement,
        description: p.description ?? 'AI-generated fix',
        confidence: parsed.confidence ?? 0.5,
      }));

      return {
        patches,
        explanation: parsed.explanation ?? 'AI-generated fix',
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
        alternativeSuggestions: parsed.alternatives,
      };
    } catch (error) {
      // If parsing fails, try to extract useful information
      return {
        patches: [],
        explanation: `Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
      };
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate an AI fix for a verification failure
 */
export async function generateAIFix(
  context: AIFixContext,
  options?: AIFixOptions
): Promise<AIFixResult> {
  const generator = new AIFixGenerator(options);
  return generator.generateFix(context);
}

/**
 * Check if AI generation is available
 */
export function isAIAvailable(): boolean {
  return !!(
    process.env['ANTHROPIC_API_KEY'] ||
    process.env['OPENAI_API_KEY']
  );
}
