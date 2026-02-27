/**
 * AI Generator - Main Logic
 * 
 * Generates implementations from ISL specifications using LLM APIs.
 */

import type { DomainDeclaration, BehaviorDeclaration } from '@isl-lang/isl-core';
import { AnthropicClient } from './models/anthropic.js';
import { OpenAIClient } from './models/openai.js';
import { getCompleteSystemPrompt, type SystemPromptOptions } from './prompts/system.js';
import { generateBehaviorPrompt, generateTypesFromDomain, type BehaviorPromptContext } from './prompts/behavior.js';
import { extractPrimaryCode, validateExtraction } from './extraction.js';
import { validateCode, type ValidationResult, type ValidationOptions } from './validation.js';

// ============================================================================
// Types
// ============================================================================

export interface GeneratorOptions {
  model: string;
  language: string;
  apiKey?: string;
  provider?: 'anthropic' | 'openai';
  maxTokens?: number;
  temperature?: number;
  strict?: boolean;
  validateOutput?: boolean;
  maxRetries?: number;
}

export interface GenerationResult {
  code: string;
  confidence: number;
  model: string;
  provider: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  validation?: ValidationResult;
  metadata: GenerationMetadata;
}

export interface GenerationMetadata {
  behaviorName: string;
  domainName: string;
  language: string;
  generatedAt: Date;
  duration: number;
  attempts: number;
}

export interface GeneratorError extends Error {
  code: string;
  details?: unknown;
}

// ============================================================================
// Generator Class
// ============================================================================

export class Generator {
  private anthropicClient: AnthropicClient | null = null;
  private openaiClient: OpenAIClient | null = null;
  private options: Required<GeneratorOptions>;

  constructor(options: GeneratorOptions) {
    this.options = {
      model: options.model,
      language: options.language,
      apiKey: options.apiKey ?? '',
      provider: options.provider ?? this.detectProvider(options.model),
      maxTokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0,
      strict: options.strict ?? true,
      validateOutput: options.validateOutput ?? true,
      maxRetries: options.maxRetries ?? 3,
    };

    // Initialize the appropriate client
    this.initializeClient();
  }

  /**
   * Generate implementation for a behavior
   */
  async generateBehavior(
    domain: DomainDeclaration,
    behavior: BehaviorDeclaration
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.options.maxRetries) {
      attempts++;

      try {
        const result = await this.attemptGeneration(domain, behavior);
        
        return {
          ...result,
          metadata: {
            behaviorName: behavior.name.name,
            domainName: domain.name.name,
            language: this.options.language,
            generatedAt: new Date(),
            duration: Date.now() - startTime,
            attempts,
          },
        };
      } catch (error) {
        lastError = error as Error;
        
        // If validation failed, try again with adjusted prompts
        if (this.isValidationError(error)) {
          continue;
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }

    throw this.createError(
      'GENERATION_FAILED',
      `Failed to generate valid code after ${attempts} attempts`,
      lastError
    );
  }

  /**
   * Generate implementations for all behaviors in a domain
   */
  async generateDomain(domain: DomainDeclaration): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];

    for (const behavior of domain.behaviors) {
      const result = await this.generateBehavior(domain, behavior);
      results.push(result);
    }

    return results;
  }

  /**
   * Generate with streaming output
   */
  async generateBehaviorStream(
    domain: DomainDeclaration,
    behavior: BehaviorDeclaration,
    onChunk: (chunk: string) => void
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    
    // Build prompts
    const { systemPrompt, userPrompt } = this.buildPrompts(domain, behavior);

    let response;
    if (this.options.provider === 'anthropic' && this.anthropicClient) {
      response = await this.anthropicClient.generateStream(
        systemPrompt,
        userPrompt,
        onChunk
      );
    } else if (this.options.provider === 'openai' && this.openaiClient) {
      response = await this.openaiClient.generateStream(
        systemPrompt,
        userPrompt,
        onChunk
      );
    } else {
      throw this.createError('NO_CLIENT', 'No API client configured');
    }

    // Extract and validate code
    const extracted = this.extractAndValidate(response.content);

    return {
      code: extracted.code,
      confidence: extracted.confidence,
      model: response.model,
      provider: this.options.provider,
      usage: {
        inputTokens: response.usage?.inputTokens ?? 0,
        outputTokens: response.usage?.outputTokens ?? 0,
      },
      validation: extracted.validation,
      metadata: {
        behaviorName: behavior.name.name,
        domainName: domain.name.name,
        language: this.options.language,
        generatedAt: new Date(),
        duration: Date.now() - startTime,
        attempts: 1,
      },
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private detectProvider(model: string): 'anthropic' | 'openai' {
    if (model.startsWith('claude') || model.includes('anthropic')) {
      return 'anthropic';
    }
    if (model.startsWith('gpt') || model.startsWith('o1') || model.includes('openai')) {
      return 'openai';
    }
    // Default to Anthropic
    return 'anthropic';
  }

  private initializeClient(): void {
    const { provider, apiKey, model, maxTokens, temperature } = this.options;

    if (provider === 'anthropic') {
      this.anthropicClient = new AnthropicClient({
        apiKey: apiKey || undefined,
        model,
        maxTokens,
        temperature,
      });
    } else {
      this.openaiClient = new OpenAIClient({
        apiKey: apiKey || undefined,
        model,
        maxTokens,
        temperature,
      });
    }
  }

  private async attemptGeneration(
    domain: DomainDeclaration,
    behavior: BehaviorDeclaration
  ): Promise<Omit<GenerationResult, 'metadata'>> {
    // Build prompts
    const { systemPrompt, userPrompt } = this.buildPrompts(domain, behavior);

    // Call the appropriate API
    let response;
    if (this.options.provider === 'anthropic' && this.anthropicClient) {
      response = await this.anthropicClient.generateWithRetry(
        systemPrompt,
        userPrompt
      );
    } else if (this.options.provider === 'openai' && this.openaiClient) {
      response = await this.openaiClient.generateWithRetry(
        systemPrompt,
        userPrompt
      );
    } else {
      throw this.createError('NO_CLIENT', 'No API client configured');
    }

    // Extract and validate code
    const extracted = this.extractAndValidate(response.content);

    return {
      code: extracted.code,
      confidence: extracted.confidence,
      model: response.model,
      provider: this.options.provider,
      usage: {
        inputTokens: response.usage?.inputTokens ?? 0,
        outputTokens: response.usage?.outputTokens ?? 0,
      },
      validation: extracted.validation,
    };
  }

  private buildPrompts(
    domain: DomainDeclaration,
    behavior: BehaviorDeclaration
  ): { systemPrompt: string; userPrompt: string } {
    // Generate types from domain
    const generatedTypes = generateTypesFromDomain(domain, this.options.language);

    // Build system prompt
    const systemPromptOptions: SystemPromptOptions = {
      language: this.options.language,
      strict: this.options.strict,
      includeTests: false,
    };
    const systemPrompt = getCompleteSystemPrompt(systemPromptOptions);

    // Build behavior prompt
    const ctx: BehaviorPromptContext = {
      domain,
      behavior,
      generatedTypes,
      language: this.options.language,
    };
    const userPrompt = generateBehaviorPrompt(ctx);

    return { systemPrompt, userPrompt };
  }

  private extractAndValidate(response: string): {
    code: string;
    confidence: number;
    validation?: ValidationResult;
  } {
    // Extract code from response
    const extracted = extractPrimaryCode(response, this.options.language);

    // Validate extraction
    const extractionValidation = validateExtraction(extracted);
    if (!extractionValidation.valid) {
      throw this.createError(
        'EXTRACTION_FAILED',
        `Code extraction issues: ${extractionValidation.issues.join(', ')}`
      );
    }

    // Validate code quality
    let validation: ValidationResult | undefined;
    if (this.options.validateOutput) {
      const validationOptions: ValidationOptions = {
        language: this.options.language,
        strict: this.options.strict,
        checkTypes: true,
        maxComplexity: 20,
      };
      validation = validateCode(extracted.code, validationOptions);

      // If strict mode and validation fails, throw
      if (this.options.strict && !validation.valid) {
        const errorMessages = validation.errors.map(e => e.message).join('; ');
        throw this.createError('VALIDATION_FAILED', `Code validation failed: ${errorMessages}`);
      }
    }

    // Calculate confidence
    let confidence = extracted.confidence;
    if (validation) {
      // Adjust confidence based on validation
      if (validation.valid) {
        confidence = Math.min(1, confidence + 0.1);
      } else {
        confidence = Math.max(0, confidence - 0.2 * validation.errors.length);
      }
    }

    return {
      code: extracted.code,
      confidence,
      validation,
    };
  }

  private isValidationError(error: unknown): boolean {
    if (error instanceof Error) {
      const generatorError = error as GeneratorError;
      return generatorError.code === 'VALIDATION_FAILED' || 
             generatorError.code === 'EXTRACTION_FAILED';
    }
    return false;
  }

  private createError(code: string, message: string, cause?: unknown): GeneratorError {
    const error = new Error(message) as GeneratorError;
    error.code = code;
    error.details = cause;
    error.name = 'GeneratorError';
    return error;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a generator with Anthropic (Claude)
 */
export function createAnthropicGenerator(options?: Partial<GeneratorOptions>): Generator {
  return new Generator({
    model: options?.model ?? 'claude-sonnet-4-20250514',
    language: options?.language ?? 'typescript',
    provider: 'anthropic',
    ...options,
  });
}

/**
 * Create a generator with OpenAI (GPT)
 */
export function createOpenAIGenerator(options?: Partial<GeneratorOptions>): Generator {
  return new Generator({
    model: options?.model ?? 'gpt-4-turbo-preview',
    language: options?.language ?? 'typescript',
    provider: 'openai',
    ...options,
  });
}

/**
 * Create a generator that automatically selects provider based on model
 */
export function createGenerator(options: GeneratorOptions): Generator {
  return new Generator(options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a model string is supported
 */
export function isModelSupported(model: string): boolean {
  return AnthropicClient.isValidModel(model) || OpenAIClient.isValidModel(model);
}

/**
 * Get all supported models
 */
export function getSupportedModels(): { anthropic: string[]; openai: string[] } {
  return {
    anthropic: AnthropicClient.getAvailableModels(),
    openai: OpenAIClient.getAvailableModels(),
  };
}
