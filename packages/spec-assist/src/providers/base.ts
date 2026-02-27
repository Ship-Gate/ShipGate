/**
 * Base Provider Interface
 * 
 * Abstract interface for AI providers. All providers must implement this.
 * Providers are responsible for generating raw ISL output.
 * They do NOT validate the output - that's done by the SpecAssist service.
 */

import type { ChatMessage, CompletionOptions, SpecAssistConfig } from '../types.js';

/**
 * AI Provider Interface
 */
export interface AIProvider {
  /** Provider name for logging/debugging */
  readonly name: string;
  
  /** Whether the provider is initialized and ready */
  isReady(): boolean;
  
  /** Initialize the provider with config */
  initialize(config: SpecAssistConfig): Promise<void>;
  
  /**
   * Generate completion from chat messages.
   * Returns raw string output - validation happens at a higher level.
   */
  complete(messages: ChatMessage[], options?: CompletionOptions): Promise<ProviderResponse>;
}

/**
 * Provider response with metadata
 */
export interface ProviderResponse {
  /** Raw output from the provider */
  content: string;
  /** Token usage if available */
  tokens?: {
    input: number;
    output: number;
  };
  /** Model used */
  model?: string;
  /** Any provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Base provider implementation with shared functionality
 */
export abstract class BaseProvider implements AIProvider {
  abstract readonly name: string;
  protected config: SpecAssistConfig | null = null;
  
  abstract initialize(config: SpecAssistConfig): Promise<void>;
  abstract complete(messages: ChatMessage[], options?: CompletionOptions): Promise<ProviderResponse>;
  
  isReady(): boolean {
    return this.config !== null;
  }
  
  /**
   * Build the system prompt for ISL generation.
   * This is critical - it constrains the model to output only valid ISL.
   */
  protected getSystemPrompt(): string {
    return `You are an ISL (Intent Specification Language) expert. Your ONLY job is to generate valid ISL specifications.

CRITICAL OUTPUT RULES:
1. Output ONLY valid ISL code - no prose, no explanations, no markdown formatting.
2. Start directly with 'domain', 'behavior', 'entity', 'type', or 'enum'.
3. Do NOT include phrases like "Here is..." or "The following...".
4. If you must include reasoning, use this JSON format:
   {"isl": "...your isl code...", "reasoning": "...brief note...", "confidence": 0.85}

ISL SYNTAX REFERENCE:
- domain DomainName { ... }
- entity EntityName { field: Type, ... }
- behavior BehaviorName { input {...}, output {...}, preconditions {...}, postconditions {...} }
- type TypeName = ...
- enum EnumName { VALUE1, VALUE2, ... }
- invariant "name" { predicate }

EXAMPLE OUTPUT (entity):
entity User {
  id: ID
  email: String @email
  name: String @min(1) @max(100)
  status: "active" | "suspended" | "deleted"
  createdAt: DateTime
}

EXAMPLE OUTPUT (behavior):
behavior CreateUser {
  input {
    email: String
    name: String
    password: String
  }
  
  output {
    user: User
    token: AuthToken
  }
  
  preconditions {
    require input.email.isValidEmail()
    require input.password.length >= 8
  }
  
  postconditions {
    ensure result.user.email == input.email
    ensure result.user.status == "active"
  }
}

Remember: Output ISL only. No explanations. No markdown. Just code.`;
  }
}
