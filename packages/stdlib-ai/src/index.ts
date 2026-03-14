/**
 * @isl-lang/stdlib-ai
 *
 * ISL standard library for AI/ML verification contracts.
 * Defines types and constraints for AI model usage, prompt safety,
 * output validation, and responsible AI guardrails.
 */

// ============================================================================
// Core Types
// ============================================================================

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'azure' | 'bedrock' | 'custom';
  model: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  /** Maximum cost per request in USD */
  maxCostPerRequest?: number;
  /** Maximum latency in milliseconds */
  maxLatencyMs?: number;
  /** Rate limit: max requests per minute */
  rateLimitRpm?: number;
}

export interface PromptSafetyPolicy {
  /** Reject prompts containing these patterns */
  blockedPatterns?: RegExp[];
  /** Maximum prompt length in characters */
  maxPromptLength?: number;
  /** Require system prompt to be present */
  requireSystemPrompt?: boolean;
  /** Prevent prompt injection via user input */
  sanitizeUserInput?: boolean;
  /** Allowed topic categories */
  allowedTopics?: string[];
  /** PII detection: reject prompts containing PII */
  blockPII?: boolean;
}

export interface OutputValidation {
  /** JSON schema the output must conform to */
  schema?: Record<string, unknown>;
  /** Maximum output length in characters */
  maxOutputLength?: number;
  /** Content moderation: block harmful content */
  moderateContent?: boolean;
  /** Require citations/sources for factual claims */
  requireCitations?: boolean;
  /** Hallucination check: verify claims against ground truth */
  verifyFacts?: boolean;
  /** Toxicity threshold (0-1, lower = stricter) */
  maxToxicity?: number;
}

export interface AIGuardrail {
  name: string;
  description: string;
  check: (input: string, output: string) => GuardrailResult;
}

export interface GuardrailResult {
  passed: boolean;
  reason?: string;
  severity?: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Responsible AI
// ============================================================================

export interface ResponsibleAIPolicy {
  /** Require human review for outputs above this confidence threshold */
  humanReviewThreshold?: number;
  /** Log all AI interactions for audit */
  auditLogging: boolean;
  /** Bias detection: flag outputs with demographic skew */
  biasDetection?: boolean;
  /** Explain AI decisions (require reasoning chain) */
  requireExplainability?: boolean;
  /** Maximum retry count before fallback */
  maxRetries?: number;
  /** Fallback behavior when AI fails */
  fallbackBehavior?: 'error' | 'default-value' | 'human-escalation';
  /** Data retention policy for prompts/outputs */
  dataRetention?: {
    retainPrompts: boolean;
    retainOutputs: boolean;
    retentionDays: number;
  };
}

// ============================================================================
// AI Contract (for ISL specs)
// ============================================================================

export interface AIContract {
  /** Model configuration constraints */
  model: ModelConfig;
  /** Prompt safety requirements */
  promptSafety?: PromptSafetyPolicy;
  /** Output validation requirements */
  outputValidation?: OutputValidation;
  /** Responsible AI policy */
  responsibleAI?: ResponsibleAIPolicy;
  /** Custom guardrails */
  guardrails?: AIGuardrail[];
}

// ============================================================================
// Validation
// ============================================================================

export function validatePrompt(prompt: string, policy: PromptSafetyPolicy): GuardrailResult {
  if (policy.maxPromptLength && prompt.length > policy.maxPromptLength) {
    return { passed: false, reason: `Prompt exceeds max length (${prompt.length} > ${policy.maxPromptLength})`, severity: 'warning' };
  }

  if (policy.blockedPatterns) {
    for (const pattern of policy.blockedPatterns) {
      if (pattern.test(prompt)) {
        return { passed: false, reason: `Prompt matches blocked pattern: ${pattern.source}`, severity: 'critical' };
      }
    }
  }

  if (policy.blockPII && containsPII(prompt)) {
    return { passed: false, reason: 'Prompt contains PII', severity: 'critical' };
  }

  return { passed: true };
}

export function validateOutput(output: string, validation: OutputValidation): GuardrailResult {
  if (validation.maxOutputLength && output.length > validation.maxOutputLength) {
    return { passed: false, reason: `Output exceeds max length (${output.length} > ${validation.maxOutputLength})`, severity: 'warning' };
  }

  return { passed: true };
}

export function runGuardrails(input: string, output: string, guardrails: AIGuardrail[]): GuardrailResult[] {
  return guardrails.map((g) => {
    try {
      return g.check(input, output);
    } catch (err) {
      return { passed: false, reason: `Guardrail "${g.name}" threw: ${err instanceof Error ? err.message : String(err)}`, severity: 'critical' as const };
    }
  });
}

// ============================================================================
// Helpers
// ============================================================================

const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,          // SSN
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,  // Email
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,  // Phone
];

function containsPII(text: string): boolean {
  return PII_PATTERNS.some((p) => p.test(text));
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
    'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
    'gpt-4o': { input: 0.005 / 1000, output: 0.015 / 1000 },
    'claude-3-opus': { input: 0.015 / 1000, output: 0.075 / 1000 },
    'claude-sonnet-4': { input: 0.003 / 1000, output: 0.015 / 1000 },
    'claude-3-haiku': { input: 0.00025 / 1000, output: 0.00125 / 1000 },
    'gemini-pro': { input: 0.0005 / 1000, output: 0.0015 / 1000 },
  };

  const key = Object.keys(PRICING).find((k) => model.toLowerCase().includes(k));
  if (!key) return 0;

  const pricing = PRICING[key]!;
  return inputTokens * pricing.input + outputTokens * pricing.output;
}
