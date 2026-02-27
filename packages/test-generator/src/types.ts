// ============================================================================
// Test Generator Types
// Domain-aware test generation with metadata support
// ============================================================================

import type * as AST from '@isl-lang/parser';

// ============================================================================
// CORE TYPES
// ============================================================================

export type TestFramework = 'jest' | 'vitest';

export type DomainType = 'auth' | 'payments' | 'uploads' | 'webhooks' | 'generic';

export type AssertionStatus = 'supported' | 'needs_impl' | 'unsupported';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface GenerateOptions {
  /** Test framework to target */
  framework: TestFramework;
  /** Output directory for generated files */
  outputDir?: string;
  /** Include helper utilities */
  includeHelpers?: boolean;
  /** Include property-based tests */
  includePropertyTests?: boolean;
  /** Include snapshot tests for structured outputs */
  includeSnapshots?: boolean;
  /** Auto-detect domain from spec patterns */
  autoDetectDomain?: boolean;
  /** Force specific domain strategy */
  forceDomain?: DomainType;
  /** Emit detailed metadata for verifier */
  emitMetadata?: boolean;
}

// ============================================================================
// OUTPUT TYPES
// ============================================================================

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'test' | 'fixture' | 'helper' | 'config' | 'metadata';
}

export interface GenerateResult {
  success: boolean;
  files: GeneratedFile[];
  errors: GeneratorError[];
  metadata: GenerationMetadata;
}

export interface GeneratorError {
  message: string;
  location?: AST.SourceLocation;
  code: ErrorCode;
  severity: 'error' | 'warning';
}

export type ErrorCode =
  | 'PARSE_ERROR'
  | 'UNSUPPORTED_PATTERN'
  | 'MISSING_CONTEXT'
  | 'DOMAIN_MISMATCH'
  | 'GENERATION_ERROR';

// ============================================================================
// METADATA TYPES
// ============================================================================

export interface GenerationMetadata {
  /** Domain detected/used */
  domain: DomainType;
  /** Behaviors processed */
  behaviors: BehaviorMetadata[];
  /** Open questions for unsupported patterns */
  openQuestions: OpenQuestion[];
  /** Summary statistics */
  stats: GenerationStats;
}

export interface BehaviorMetadata {
  name: string;
  domain: DomainType;
  assertions: AssertionMetadata[];
  coverage: CoverageInfo;
}

export interface AssertionMetadata {
  /** Description of what's being asserted */
  description: string;
  /** Pattern category */
  pattern: AssertionPattern;
  /** Current support status */
  status: AssertionStatus;
  /** If needs_impl, what's required */
  implementationHint?: string;
  /** Source expression location */
  location?: AST.SourceLocation;
}

export type AssertionPattern =
  // Auth patterns
  | 'auth.invalid_provider'
  | 'auth.invalid_email'
  | 'auth.invalid_password'
  | 'auth.token_present'
  | 'auth.session_expiry'
  | 'auth.mfa_required'
  | 'auth.account_locked'
  // Payment patterns
  | 'payment.amount_positive'
  | 'payment.status_succeeded'
  | 'payment.idempotency_key'
  | 'payment.currency_valid'
  | 'payment.refund_valid'
  // Upload patterns
  | 'upload.file_type'
  | 'upload.file_size'
  | 'upload.result_url'
  | 'upload.content_type'
  // Webhook patterns
  | 'webhook.signature_valid'
  | 'webhook.replay_protection'
  | 'webhook.event_type'
  | 'webhook.delivery_attempt'
  // Generic patterns
  | 'generic.precondition'
  | 'generic.postcondition'
  | 'generic.invariant'
  | 'generic.temporal'
  | 'generic.unknown';

export interface OpenQuestion {
  /** Unique ID for tracking */
  id: string;
  /** What pattern couldn't be handled */
  pattern: string;
  /** Why it couldn't be handled */
  reason: string;
  /** Suggested implementation approach */
  suggestion: string;
  /** Related behavior */
  behavior: string;
  /** Source location */
  location?: AST.SourceLocation;
}

export interface CoverageInfo {
  /** Total preconditions */
  totalPreconditions: number;
  /** Preconditions with assertions */
  coveredPreconditions: number;
  /** Total postconditions */
  totalPostconditions: number;
  /** Postconditions with assertions */
  coveredPostconditions: number;
  /** Total invariants */
  totalInvariants: number;
  /** Invariants with assertions */
  coveredInvariants: number;
}

export interface GenerationStats {
  totalBehaviors: number;
  totalAssertions: number;
  supportedAssertions: number;
  needsImplAssertions: number;
  unsupportedAssertions: number;
  openQuestionsCount: number;
}

// ============================================================================
// STRATEGY TYPES
// ============================================================================

export interface DomainStrategy {
  /** Domain identifier */
  domain: DomainType;
  /** Check if this strategy applies to a behavior */
  matches(behavior: AST.Behavior, domain: AST.Domain): boolean;
  /** Generate assertions for preconditions */
  generatePreconditionAssertions(
    precondition: AST.Expression,
    behavior: AST.Behavior,
    context: StrategyContext
  ): GeneratedAssertion[];
  /** Generate assertions for postconditions */
  generatePostconditionAssertions(
    postcondition: AST.PostconditionBlock,
    behavior: AST.Behavior,
    context: StrategyContext
  ): GeneratedAssertion[];
  /** Generate assertions for error cases */
  generateErrorAssertions(
    errorSpec: AST.ErrorSpec,
    behavior: AST.Behavior,
    context: StrategyContext
  ): GeneratedAssertion[];
}

export interface StrategyContext {
  /** Test framework */
  framework: TestFramework;
  /** Entity names in domain */
  entityNames: string[];
  /** Domain name */
  domainName: string;
  /** Register open question */
  addOpenQuestion(question: Omit<OpenQuestion, 'id'>): void;
}

export interface GeneratedAssertion {
  /** Assertion code */
  code: string;
  /** Description for comments */
  description: string;
  /** Pattern category */
  pattern: AssertionPattern;
  /** Support status */
  status: AssertionStatus;
  /** Implementation hint if needs_impl */
  implementationHint?: string;
}

// ============================================================================
// TEST BLOCK TYPES
// ============================================================================

export interface TestBlock {
  name: string;
  type: 'describe' | 'it' | 'test';
  body: string;
  children?: TestBlock[];
  metadata?: AssertionMetadata[];
}

export interface PreconditionTest {
  name: string;
  expression: AST.Expression;
  assertions: GeneratedAssertion[];
  testCode: string;
}

export interface PostconditionTest {
  name: string;
  condition: string;
  expressions: AST.Expression[];
  assertions: GeneratedAssertion[];
  testCode: string;
}

export interface ErrorTest {
  name: string;
  errorSpec: AST.ErrorSpec;
  assertions: GeneratedAssertion[];
  testCode: string;
}

// ============================================================================
// COMPILER CONTEXT
// ============================================================================

export interface CompilerContext {
  /** Entity names in the domain */
  entities: Set<string>;
  /** Whether inside old() expression */
  inOldExpr?: boolean;
  /** Current domain strategy */
  domain?: DomainType;
}
