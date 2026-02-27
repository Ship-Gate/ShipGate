/**
 * @isl-lang/spec-assist Types
 * 
 * Type definitions for AI-assisted ISL spec generation.
 * 
 * Key design principle: AI is NOT allowed to directly ship code.
 * It can only produce:
 *   - ISL specs (validated by parser + semantic + verifier)
 *   - Mission prompts / fix recipes
 *   - Documentation drafts
 */

// ============================================================================
// PROVIDER TYPES
// ============================================================================

/**
 * Configuration for the AI provider
 */
export interface SpecAssistConfig {
  /** Provider type: 'stub' for offline/testing, 'anthropic' or 'openai' for real */
  provider: 'stub' | 'anthropic' | 'openai';
  /** API key for real providers */
  apiKey?: string;
  /** Model to use (e.g., 'claude-3-5-sonnet-20241022') */
  model?: string;
  /** Max tokens for generation */
  maxTokens?: number;
  /** Temperature (0-1, lower = more deterministic) */
  temperature?: number;
}

/**
 * Chat message for provider interaction
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Provider completion options
 */
export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  stop?: string[];
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to generate ISL spec from code
 */
export interface SpecAssistRequest {
  /** The source code to analyze */
  code: string;
  /** Programming language of the code */
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java';
  /** Function or class signature to focus on (optional) */
  signature?: string;
  /** Existing domain context (other specs to reference) */
  domainContext?: string;
  /** Hints about what the code should do */
  hints?: string[];
}

/**
 * Response from spec generation - either valid ISL or actionable diagnostics
 */
export interface SpecAssistResponse {
  /** Whether the generation was successful */
  success: boolean;
  /** The generated ISL spec (only if success=true and validated) */
  isl?: string;
  /** Validation result details */
  validation: ValidationResult;
  /** Diagnostics if validation failed (actionable) */
  diagnostics: Diagnostic[];
  /** Provider metadata */
  metadata: {
    provider: string;
    model?: string;
    tokens?: { input: number; output: number };
    durationMs: number;
  };
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Result of ISL validation pipeline
 */
export interface ValidationResult {
  /** Parse stage passed */
  parseOk: boolean;
  /** Semantic analysis stage passed */
  semanticOk: boolean;
  /** Quick verification stage passed */
  verifyOk: boolean;
  /** All stages passed */
  allPassed: boolean;
  /** Parse errors if any */
  parseErrors: ParseError[];
  /** Semantic errors if any */
  semanticErrors: SemanticError[];
  /** Verification issues if any */
  verifyIssues: VerifyIssue[];
}

export interface ParseError {
  line: number;
  column: number;
  message: string;
  code: string;
}

export interface SemanticError {
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
  category: string;
}

export interface VerifyIssue {
  behaviorName?: string;
  clauseType?: string;
  message: string;
  severity: 'blocking' | 'warning' | 'info';
}

/**
 * Diagnostic message for user feedback
 */
export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  fix?: string;
}

// ============================================================================
// OUTPUT ENVELOPE TYPES
// ============================================================================

/**
 * Strict output format from AI provider.
 * The AI must return EITHER:
 *   1. Pure ISL code (no prose, no markdown)
 *   2. A JSON envelope with an 'isl' field
 * 
 * Anything else is rejected as "slop".
 */
export interface AIOutputEnvelope {
  /** The ISL spec (required) */
  isl: string;
  /** Optional reasoning/explanation (not used in spec, just for logging) */
  reasoning?: string;
  /** Confidence score 0-1 */
  confidence?: number;
}

/**
 * Check if raw output is valid ISL or valid envelope
 */
export function isValidOutput(raw: string): { valid: boolean; isl?: string; reason?: string } {
  const trimmed = raw.trim();
  
  // Case 1: Try to parse as JSON envelope
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<AIOutputEnvelope>;
      if (typeof parsed.isl === 'string' && parsed.isl.length > 0) {
        return { valid: true, isl: parsed.isl };
      }
      return { valid: false, reason: 'JSON envelope missing required "isl" field' };
    } catch {
      // Not valid JSON, continue to check if it's ISL
    }
  }
  
  // Case 2: Check if it looks like ISL (starts with domain/behavior/entity/type)
  const islKeywords = /^(domain|behavior|entity|type|enum|policy|invariant|import)\s/m;
  if (islKeywords.test(trimmed)) {
    return { valid: true, isl: trimmed };
  }
  
  // Case 3: Check for markdown code block with ISL
  const codeBlockMatch = trimmed.match(/```(?:isl)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    const codeContent = codeBlockMatch[1].trim();
    if (islKeywords.test(codeContent)) {
      return { valid: true, isl: codeContent };
    }
  }
  
  // Invalid - likely "slop" (prose, explanations, etc.)
  return { 
    valid: false, 
    reason: 'Output is not valid ISL. Expected domain/behavior/entity declaration or JSON envelope with "isl" field.' 
  };
}

// ============================================================================
// FEATURE FLAG TYPES
// ============================================================================

/**
 * Feature flag configuration
 */
export interface FeatureFlagConfig {
  /** Whether AI assist is enabled */
  enabled: boolean;
  /** Source of the flag (env, config, default) */
  source: 'env' | 'config' | 'default';
  /** Provider to use if enabled */
  provider?: SpecAssistConfig['provider'];
}
