/**
 * Shadow Spec AI Generator — LLM-powered ISL Inference
 *
 * Upgrades Agent 12's heuristic pattern-matching with actual LLM code
 * understanding. Reads source code and generates richer, more accurate
 * ISL behavioral specs.
 *
 * This is an OPTIONAL upgrade — it requires an API key and network access.
 * The heuristic version (`shadow-spec.ts`) remains the default fallback.
 *
 * @module @isl-lang/gate/specless/shadow-spec-ai
 */

import { parse } from '@isl-lang/parser';
import type { ParseResult, Domain, Behavior } from '@isl-lang/parser';
import { generateShadowSpec } from './shadow-spec.js';
import type { ShadowSpec, PatternMatch } from './shadow-spec.js';

// ============================================================================
// Configuration
// ============================================================================

/** Supported LLM providers */
export type AIProvider = 'anthropic' | 'openai';

/** Configuration for the AI spec generator */
export interface AISpecGeneratorConfig {
  /** LLM provider to use */
  provider: AIProvider;
  /** API key — falls back to env var if not provided */
  apiKey?: string;
  /** Model identifier — defaults per provider */
  model?: string;
  /** Max tokens for the LLM response */
  maxTokens?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/** Additional context to improve generation quality */
export interface AISpecContext {
  /** PR title for additional behavioral hints */
  prTitle?: string;
  /** Commit message for intent signal */
  commitMessage?: string;
  /** Existing .isl files in the project for style reference */
  relatedSpecs?: string[];
}

/** Internal resolved config with all defaults filled in */
interface ResolvedConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  maxTokens: number;
  timeout: number;
}

// ============================================================================
// Default Models
// ============================================================================

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
};

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT_MS = 30_000;

// ============================================================================
// Rate Limiting
// ============================================================================

/** Rate limiter configuration */
export interface RateLimitConfig {
  /** Maximum API calls per minute */
  maxCallsPerMinute: number;
  /** Maximum API calls per single verify run */
  maxCallsPerVerify: number;
  /** Skip files longer than this many characters */
  maxSourceLength: number;
  /** File patterns to skip entirely */
  skipPatterns: RegExp[];
}

/** Default rate limit settings */
export const DEFAULT_RATE_LIMITS: Readonly<RateLimitConfig> = {
  maxCallsPerMinute: 10,
  maxCallsPerVerify: 20,
  maxSourceLength: 10_000,
  skipPatterns: [
    /\.test\./,
    /\.spec\./,
    /\.d\.ts$/,
    /generated/,
  ],
};

/** Module-level rate limiter state */
interface RateLimiterState {
  /** Timestamps of recent calls (within the current minute window) */
  callTimestamps: number[];
  /** Number of calls in the current verify run */
  verifyCalls: number;
}

const rateLimiterState: RateLimiterState = {
  callTimestamps: [],
  verifyCalls: 0,
};

/**
 * Check whether a file should be skipped based on rate limits and patterns.
 * Returns a reason string if skipped, or `null` if the file should be processed.
 */
export function shouldSkipFile(
  filePath: string,
  sourceLength: number,
  limits: RateLimitConfig = DEFAULT_RATE_LIMITS,
): string | null {
  // Skip by file pattern
  for (const pattern of limits.skipPatterns) {
    if (pattern.test(filePath)) {
      return `skipped: matches pattern ${pattern.source}`;
    }
  }

  // Skip oversized files
  if (sourceLength > limits.maxSourceLength) {
    return `skipped: source length ${sourceLength} exceeds max ${limits.maxSourceLength}`;
  }

  return null;
}

/**
 * Check whether the rate limiter allows another API call.
 * Returns `true` if the call is allowed, `false` if rate-limited.
 */
export function isRateLimited(
  limits: RateLimitConfig = DEFAULT_RATE_LIMITS,
): boolean {
  const now = Date.now();

  // Purge timestamps older than 60 seconds
  rateLimiterState.callTimestamps = rateLimiterState.callTimestamps.filter(
    ts => now - ts < 60_000,
  );

  // Check per-minute limit
  if (rateLimiterState.callTimestamps.length >= limits.maxCallsPerMinute) {
    return true;
  }

  // Check per-verify limit
  if (rateLimiterState.verifyCalls >= limits.maxCallsPerVerify) {
    return true;
  }

  return false;
}

/** Record an API call for rate limiting purposes. */
function recordCall(): void {
  rateLimiterState.callTimestamps.push(Date.now());
  rateLimiterState.verifyCalls++;
}

/** Reset per-verify call counter. Call at the start of each verify run. */
export function resetVerifyCounter(): void {
  rateLimiterState.verifyCalls = 0;
}

/** Reset all rate limiter state. Useful for testing. */
export function resetRateLimiter(): void {
  rateLimiterState.callTimestamps = [];
  rateLimiterState.verifyCalls = 0;
}

// ============================================================================
// LLM Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are an ISL (Intent Specification Language) expert.
Given source code, generate an ISL spec that captures the code's intended behavior.

ISL syntax reference:
- A spec starts with: domain DomainName { version: "x.y.z" ... }
- Entities: entity Name { field: Type }
- Behaviors: behavior Name { input { ... } output { success: Type errors: [...] } preconditions { ... } postconditions { success implies { ... } } }
- Security: security { requires <expression> rate_limit <number> }
- Types: String, Integer, Decimal, Boolean, UUID, Email, JWT, DateTime, Date, Time, Duration
- Expressions: result, input, old(...), now, ==, !=, >, <, >=, <=, and, or, not, implies
- Temporal: temporal { eventually <expr> within <duration> }

Rules:
- Focus on BEHAVIORAL contracts, not implementation details
- Include postconditions that would catch real bugs
- Include security requirements if the code handles auth, payments, or user data
- Use stdlib types when appropriate (Email, UUID, JWT, etc.)
- Set realistic confidence based on how certain you are about the behavior
- Output ONLY valid ISL — no markdown, no explanation, no code fences`;

/**
 * Build the user prompt for the LLM.
 */
function buildUserPrompt(
  filePath: string,
  sourceCode: string,
  context?: AISpecContext,
): string {
  const language = detectLanguage(filePath);
  const parts: string[] = [];

  parts.push(`Generate an ISL spec for this ${language} file:`);
  parts.push('');
  parts.push(`File: ${filePath}`);

  if (context?.prTitle) {
    parts.push(`PR: ${context.prTitle}`);
  }
  if (context?.commitMessage) {
    parts.push(`Commit: ${context.commitMessage}`);
  }

  parts.push('');
  parts.push(`\`\`\`${language}`);
  parts.push(sourceCode);
  parts.push('```');

  if (context?.relatedSpecs && context.relatedSpecs.length > 0) {
    parts.push('');
    parts.push('Existing specs in this project (match style):');
    for (const spec of context.relatedSpecs.slice(0, 3)) {
      parts.push(spec);
    }
  }

  return parts.join('\n');
}

/**
 * Detect the language from a file path extension.
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
  };
  return langMap[ext] ?? ext;
}

// ============================================================================
// LLM API Calls
// ============================================================================

/**
 * Resolve configuration with defaults and env var fallback.
 * Throws if no API key is available.
 */
export function resolveConfig(config: AISpecGeneratorConfig): ResolvedConfig {
  const envKeyMap: Record<AIProvider, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
  };

  const apiKey = config.apiKey ?? process.env[envKeyMap[config.provider]];
  if (!apiKey) {
    throw new Error(
      `No API key provided for ${config.provider}. ` +
      `Set ${envKeyMap[config.provider]} environment variable or pass apiKey in config.`,
    );
  }

  return {
    provider: config.provider,
    apiKey,
    model: config.model ?? DEFAULT_MODELS[config.provider],
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
  };
}

/**
 * Call the LLM API and return the raw text response.
 * Supports Anthropic Messages API and OpenAI Chat Completions API.
 */
export async function callLLM(
  userPrompt: string,
  resolved: ResolvedConfig,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), resolved.timeout);

  try {
    if (resolved.provider === 'anthropic') {
      return await callAnthropic(userPrompt, resolved, controller.signal);
    }
    return await callOpenAI(userPrompt, resolved, controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callAnthropic(
  userPrompt: string,
  config: ResolvedConfig,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error');
    throw new Error(
      `Anthropic API error ${response.status}: ${errorText}`,
    );
  }

  const data = await response.json() as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content.find(b => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error('Anthropic API returned no text content');
  }

  return textBlock.text;
}

async function callOpenAI(
  userPrompt: string,
  config: ResolvedConfig,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error');
    throw new Error(
      `OpenAI API error ${response.status}: ${errorText}`,
    );
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('OpenAI API returned no message content');
  }

  return data.choices[0].message.content;
}

// ============================================================================
// ISL Cleaning & Validation
// ============================================================================

/**
 * Clean raw LLM output to extract just the ISL content.
 * Strips markdown code fences, leading prose, trailing explanation.
 */
export function cleanISLOutput(raw: string): string {
  let cleaned = raw.trim();

  // Remove markdown code fences (```isl ... ``` or ``` ... ```)
  const fenceMatch = cleaned.match(/```(?:isl)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Remove leading prose before 'domain'
  const domainIdx = cleaned.indexOf('domain ');
  if (domainIdx > 0) {
    cleaned = cleaned.slice(domainIdx);
  }

  // Remove trailing content after the domain block closes
  let depth = 0;
  let domainEnd = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    if (cleaned[i] === '}') {
      depth--;
      if (depth === 0) {
        domainEnd = i + 1;
        break;
      }
    }
  }
  if (domainEnd > 0 && domainEnd < cleaned.length) {
    cleaned = cleaned.slice(0, domainEnd);
  }

  return cleaned;
}

/**
 * Validate an ISL string by parsing it.
 * Returns the parse result which includes success, domain, and errors.
 */
export function validateISL(isl: string): ParseResult {
  return parse(isl, '<ai-generated>');
}

// ============================================================================
// Confidence Estimation
// ============================================================================

/**
 * Estimate confidence for an AI-generated spec based on structural quality.
 *
 * Does NOT trust the AI's self-reported confidence. Instead, examines the
 * parsed domain for specificity and completeness indicators.
 */
export function estimateConfidence(domain: Domain): number {
  let confidence = 0.6; // base for AI-generated

  // Boost for specificity
  if (domain.entities.length > 0) confidence += 0.05;

  const behaviors = domain.behaviors ?? [];

  if (behaviors.some((b: Behavior) => b.postconditions.length > 0)) {
    confidence += 0.1;
  }

  if (behaviors.some((b: Behavior) => b.security.length > 0)) {
    confidence += 0.05;
  }

  // Boost for rich specs
  if (behaviors.some((b: Behavior) => b.preconditions.length > 0)) {
    confidence += 0.03;
  }
  if (behaviors.some((b: Behavior) => b.input?.fields?.length > 0)) {
    confidence += 0.02;
  }

  // Penalize for vagueness
  if (behaviors.length === 0) confidence -= 0.3;
  if (behaviors.length > 0 && behaviors.every((b: Behavior) => b.postconditions.length === 0)) {
    confidence -= 0.2;
  }

  return Math.max(0.1, Math.min(0.9, confidence));
}

// ============================================================================
// Generation with Retry (Parse-Validation Loop)
// ============================================================================

/** Maximum number of retries when the LLM produces invalid ISL */
const MAX_RETRIES = 2;

/**
 * Generate an ISL spec with retry on parse failure.
 *
 * If the generated ISL doesn't parse, the error messages are fed back to
 * the LLM for correction (up to `MAX_RETRIES` times). On total failure,
 * falls back to the heuristic generator.
 */
export async function generateWithRetry(
  filePath: string,
  sourceCode: string,
  resolved: ResolvedConfig,
  context?: AISpecContext,
  maxRetries: number = MAX_RETRIES,
): Promise<ShadowSpec> {
  let userPrompt = buildUserPrompt(filePath, sourceCode, context);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    recordCall();

    const rawISL = await callLLM(userPrompt, resolved);
    const cleaned = cleanISLOutput(rawISL);
    const parseResult = validateISL(cleaned);

    if (parseResult.success && parseResult.domain) {
      const confidence = estimateConfidence(parseResult.domain);
      return buildAIShadowSpec(filePath, cleaned, confidence, parseResult);
    }

    // Append parse errors as context for the next attempt
    const errorMessages = parseResult.errors
      .map(e => e.message)
      .join('\n');

    userPrompt += `\n\nPrevious attempt had parse errors:\n${errorMessages}\nPlease fix and regenerate. Output ONLY valid ISL.`;
  }

  // All retries exhausted — fall back to heuristic
  return generateShadowSpec(filePath, sourceCode, context);
}

// ============================================================================
// Shadow Spec Assembly
// ============================================================================

/**
 * Build a ShadowSpec from a successful AI generation result.
 */
function buildAIShadowSpec(
  filePath: string,
  islFragment: string,
  confidence: number,
  parseResult: ParseResult,
): ShadowSpec {
  const domain = parseResult.domain;
  const behaviorNames = domain?.behaviors?.map(b => b.name.name) ?? [];

  // Build pattern matches from the parsed behaviors
  const patterns: PatternMatch[] = behaviorNames.map(name => ({
    pattern: 'ai-inferred',
    location: { file: filePath, line: 1 },
    inferredSpec: `behavior ${name} { /* AI-generated */ }`,
    confidence,
  }));

  return {
    filePath,
    inferredBehaviors: behaviorNames.map(
      name => `behavior ${name} { /* AI-generated — see islFragment */ }`,
    ),
    confidence,
    islFragment: addHeader(filePath, confidence, islFragment),
    patterns,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Add a comment header to the generated ISL fragment.
 */
function addHeader(
  filePath: string,
  confidence: number,
  isl: string,
): string {
  return [
    `// AI-generated shadow spec for ${filePath}`,
    `// Confidence: ${confidence.toFixed(2)} | Source: LLM`,
    `// Review and commit: isl adopt ${filePath}`,
    '',
    isl,
  ].join('\n');
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Generate a shadow spec using an LLM to infer ISL behavioral specs
 * from source code.
 *
 * This is the AI-powered upgrade to `generateShadowSpec`. It reads the
 * actual source code, sends it to an LLM, and validates the generated
 * ISL via the parser. Falls back to the heuristic generator on failure.
 *
 * @param filePath - Path to the source file
 * @param sourceCode - Raw source code content
 * @param config - LLM provider configuration
 * @param context - Optional PR/commit context for improved generation
 * @returns Shadow spec with ISL fragment and metadata
 *
 * @example
 * ```typescript
 * const spec = await generateShadowSpecAI(
 *   'src/auth/login.ts',
 *   sourceCode,
 *   { provider: 'anthropic' },
 *   { prTitle: 'Add user login' },
 * );
 * ```
 */
export async function generateShadowSpecAI(
  filePath: string,
  sourceCode: string,
  config: AISpecGeneratorConfig,
  context?: AISpecContext,
): Promise<ShadowSpec> {
  // Check rate limits and skip patterns
  const skipReason = shouldSkipFile(filePath, sourceCode.length);
  if (skipReason) {
    return generateShadowSpec(filePath, sourceCode, context);
  }

  if (isRateLimited()) {
    return generateShadowSpec(filePath, sourceCode, context);
  }

  // Resolve configuration (validates API key)
  let resolved: ResolvedConfig;
  try {
    resolved = resolveConfig(config);
  } catch {
    // No API key → graceful fallback to heuristic
    return generateShadowSpec(filePath, sourceCode, context);
  }

  // Generate with parse-validation retry loop
  try {
    return await generateWithRetry(filePath, sourceCode, resolved, context);
  } catch {
    // Network error, timeout, etc. → graceful fallback
    return generateShadowSpec(filePath, sourceCode, context);
  }
}
