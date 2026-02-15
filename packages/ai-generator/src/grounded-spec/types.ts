/**
 * Grounded Spec Generation Types
 *
 * Types for evidence-grounded AI spec generation that avoids hallucination
 * by requiring AI to cite code facts for every constraint it proposes.
 *
 * @module @isl-lang/ai-generator/grounded-spec/types
 */

// ============================================================================
// Code Fact Types — extracted statically from source code
// ============================================================================

/** A typed function/method signature extracted from source */
export interface FunctionSignature {
  name: string;
  params: ParameterInfo[];
  returnType: string | null;
  isAsync: boolean;
  isExported: boolean;
  isGenerator: boolean;
  typeParameters: string[];
  location: SourceSpan;
}

export interface ParameterInfo {
  name: string;
  type: string | null;
  optional: boolean;
  defaultValue: string | null;
  rest: boolean;
}

export interface SourceSpan {
  file: string;
  startLine: number;
  endLine: number;
}

/** Intermediate representation of control flow for a function */
export interface ControlFlowIR {
  functionName: string;
  throwSites: ThrowSite[];
  externalCalls: ExternalCall[];
  returnShapes: ReturnShape[];
  branches: number;
  loops: number;
  earlyReturns: number;
  awaitPoints: number;
}

export interface ThrowSite {
  errorType: string;
  message: string | null;
  line: number;
  condition: string | null;
}

export interface ExternalCall {
  callee: string;
  method: string | null;
  line: number;
  isAwait: boolean;
}

export interface ReturnShape {
  expression: string;
  line: number;
  fields: string[];
}

/** Docstring/JSDoc extracted from a function */
export interface DocstringInfo {
  summary: string;
  params: { name: string; description: string }[];
  returns: string | null;
  throws: { type: string; description: string }[];
  tags: { tag: string; value: string }[];
}

/** Detected validation schema (zod, yup, prisma, etc.) */
export interface SchemaInfo {
  kind: 'zod' | 'yup' | 'prisma' | 'joi' | 'ajv' | 'typebox' | 'unknown';
  name: string;
  fields: SchemaField[];
  raw: string;
  location: SourceSpan;
}

export interface SchemaField {
  name: string;
  type: string;
  constraints: string[];
  optional: boolean;
}

/** Example call site found via static grep */
export interface CallSiteExample {
  file: string;
  line: number;
  snippet: string;
  args: string[];
}

/** Complete code facts bundle for a single function */
export interface CodeFacts {
  signature: FunctionSignature;
  controlFlow: ControlFlowIR;
  docstring: DocstringInfo | null;
  schemas: SchemaInfo[];
  callSites: CallSiteExample[];
  sourceCode: string;
}

// ============================================================================
// AI Output Schema — structured JSON the AI must produce
// ============================================================================

/** A single precondition/postcondition proposed by AI */
export interface GroundedCondition {
  expr: string;
  confidence: number;
  evidence: string[];
}

/** An error case proposed by AI */
export interface GroundedError {
  when: string;
  throws: string;
  confidence: number;
  evidence: string[];
}

/** A side-effect proposed by AI */
export interface GroundedEffect {
  type: 'db_write' | 'db_read' | 'http_call' | 'event_emit' | 'file_io' | 'cache' | 'log' | 'unknown';
  target: string;
  confidence: number;
  evidence: string[];
}

/** A single behavior spec proposed by AI — the core output unit */
export interface GroundedBehavior {
  name: string;
  description: string;
  inputs: { name: string; type: string }[];
  output: { type: string };
  preconditions: GroundedCondition[];
  postconditions: GroundedCondition[];
  invariants: GroundedCondition[];
  errors: GroundedError[];
  effects: GroundedEffect[];
}

/** Top-level AI response schema */
export interface GroundedSpecResponse {
  behaviors: GroundedBehavior[];
}

// ============================================================================
// Confidence Budget Types
// ============================================================================

export type EvidenceQuality = 'strong' | 'moderate' | 'weak' | 'speculative';

export interface ConfidenceAssessment {
  condition: string;
  rawConfidence: number;
  evidenceQuality: EvidenceQuality;
  adjustedConfidence: number;
  evidenceCount: number;
  speculative: boolean;
  reason: string;
}

export interface SpecConfidenceBudget {
  totalBudget: number;
  usedBudget: number;
  remainingBudget: number;
  assessments: ConfidenceAssessment[];
  strongCount: number;
  moderateCount: number;
  weakCount: number;
  speculativeCount: number;
  overallScore: number;
}

// ============================================================================
// Pipeline Types
// ============================================================================

export interface GroundedSpecOptions {
  /** Source file path */
  filePath: string;
  /** Source code content (if already read) */
  sourceCode?: string;
  /** Project root for call-site search */
  projectRoot?: string;
  /** AI provider */
  provider?: 'anthropic' | 'openai';
  /** AI model */
  model?: string;
  /** API key */
  apiKey?: string;
  /** Max call sites to find per function */
  maxCallSites?: number;
  /** Minimum confidence to include a rule in ISL output */
  minConfidence?: number;
  /** If true, include speculative rules with [speculative] annotation */
  includeSpeculative?: boolean;
}

export interface GroundedSpecResult {
  /** Generated ISL spec string */
  isl: string;
  /** Structured behaviors (pre-ISL) */
  behaviors: GroundedBehavior[];
  /** Confidence budget analysis */
  budget: SpecConfidenceBudget;
  /** Code facts that were extracted */
  facts: CodeFacts[];
  /** AI usage stats */
  usage: { inputTokens: number; outputTokens: number };
}
