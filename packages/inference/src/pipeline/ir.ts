/**
 * TypedIntentIR — The intermediate representation for the 3-tier inference pipeline.
 *
 * Tier 1 produces this IR from static analysis of source code.
 * Tier 2 enriches it with semantic rule inference.
 * Tier 3 fills gaps via AI when confidence is low.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Top-level IR
// ─────────────────────────────────────────────────────────────────────────────

export interface TypedIntentIR {
  /** Source files that were analyzed */
  sourceFiles: string[];
  /** Language of the source code */
  language: 'typescript' | 'javascript' | 'python';
  /** All exported (and optionally internal) symbols */
  symbols: IRSymbol[];
  /** Runtime behavior hints detected in function bodies */
  runtimeHints: IRRuntimeHint[];
  /** Doc comments and JSDoc metadata */
  documentation: IRDocEntry[];
  /** Tier at which each piece of data was produced */
  provenance: IRProvenance[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Symbols
// ─────────────────────────────────────────────────────────────────────────────

export type IRSymbol =
  | IRFunction
  | IRMethod
  | IRInterface
  | IRTypeAlias
  | IREnum
  | IRClass;

export interface IRSourceLocation {
  file: string;
  line: number;
  column: number;
}

export interface IRBaseSymbol {
  name: string;
  exported: boolean;
  location: IRSourceLocation;
}

export interface IRFunction extends IRBaseSymbol {
  kind: 'function';
  async: boolean;
  parameters: IRParameter[];
  returnType: IRTypeRef;
  throwsErrors: IRThrownError[];
  /** Guard clauses: `if (!x) throw ...` at the top of the body */
  guardClauses: IRGuardClause[];
  /** Side effects detected in the body */
  sideEffects: IRSideEffect[];
  /** JSDoc / doc comment for this function */
  jsdoc?: IRJSDoc;
}

export interface IRMethod extends IRBaseSymbol {
  kind: 'method';
  className: string;
  async: boolean;
  visibility: 'public' | 'protected' | 'private';
  static: boolean;
  parameters: IRParameter[];
  returnType: IRTypeRef;
  throwsErrors: IRThrownError[];
  guardClauses: IRGuardClause[];
  sideEffects: IRSideEffect[];
  jsdoc?: IRJSDoc;
}

export interface IRInterface extends IRBaseSymbol {
  kind: 'interface';
  properties: IRProperty[];
  extends: string[];
}

export interface IRTypeAlias extends IRBaseSymbol {
  kind: 'typeAlias';
  /** The raw TS type string */
  typeString: string;
  /** If this is a union of string literals, the members */
  unionMembers?: string[];
  /** Whether this is a union type */
  isUnion: boolean;
  /** Whether all union members are string literals (can become enum) */
  isStringLiteralUnion: boolean;
}

export interface IREnum extends IRBaseSymbol {
  kind: 'enum';
  members: string[];
  /** Whether it's a const enum */
  isConst: boolean;
}

export interface IRClass extends IRBaseSymbol {
  kind: 'class';
  properties: IRProperty[];
  methods: IRMethod[];
  extends?: string;
  implements: string[];
  isAbstract: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-structures
// ─────────────────────────────────────────────────────────────────────────────

export interface IRParameter {
  name: string;
  type: IRTypeRef;
  optional: boolean;
  defaultValue?: string;
  /** Whether the parameter is mutated inside the function body */
  mutated: boolean;
}

export interface IRTypeRef {
  /** The printed type string, e.g. "string", "Promise<User>", "User | null" */
  text: string;
  /** Whether the type includes null or undefined (union types, optional) */
  nullable: boolean;
  /** Whether this is a Promise type */
  isPromise: boolean;
  /** The inner type if this is a Promise<T> */
  promiseInner?: string;
  /** Whether this is an array type */
  isArray: boolean;
  /** Union constituents, if any */
  unionParts?: string[];
}

export interface IRProperty {
  name: string;
  type: IRTypeRef;
  optional: boolean;
  readonly: boolean;
  initializer?: string;
}

export interface IRThrownError {
  /** Error class name, e.g. "Error", "ValidationError" */
  errorClass: string;
  /** The error message if it's a string literal */
  message?: string;
  /** The guard condition that triggers this throw, if detectable */
  guardCondition?: string;
}

export interface IRGuardClause {
  /** The raw condition text, e.g. "!email.includes('@')" */
  condition: string;
  /** The negated (positive) form: what must be true for the fn to proceed */
  positiveCondition: string;
  /** The error thrown if the guard fails */
  error?: IRThrownError;
  /** Which parameter(s) this guard references */
  referencedParams: string[];
}

export interface IRSideEffect {
  type: 'db-read' | 'db-write' | 'db-delete' | 'http' | 'fs' | 'crypto' | 'random' | 'time' | 'global-write' | 'param-mutation' | 'external';
  /** What is being accessed/mutated, e.g. "db.users", "fetch", "fs.readFile" */
  target: string;
  /** Raw call expression text */
  callText: string;
}

export interface IRJSDoc {
  description?: string;
  params: Map<string, string>;
  returns?: string;
  throws: string[];
  tags: Map<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime behavior hints (Tier 1 detects, Tier 2 interprets)
// ─────────────────────────────────────────────────────────────────────────────

export interface IRRuntimeHint {
  /** Which function/method this hint belongs to */
  symbolName: string;
  /** Category of the hint */
  category: 'io' | 'mutation' | 'nondeterminism' | 'side-effect' | 'security';
  /** Specific detail */
  detail: string;
  /** Source location of the hint */
  location: IRSourceLocation;
}

// ─────────────────────────────────────────────────────────────────────────────
// Documentation entries
// ─────────────────────────────────────────────────────────────────────────────

export interface IRDocEntry {
  symbolName: string;
  jsdoc: IRJSDoc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provenance tracking
// ─────────────────────────────────────────────────────────────────────────────

export interface IRProvenance {
  /** Which data field this provenance describes */
  path: string;
  /** Which tier produced this data */
  tier: 1 | 2 | 3;
  /** Confidence 0-1 */
  confidence: number;
  /** Human-readable reason */
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 2 output: inferred rules
// ─────────────────────────────────────────────────────────────────────────────

export interface InferredRule {
  /** Which symbol this rule applies to */
  symbolName: string;
  /** Rule category */
  category: 'precondition' | 'postcondition' | 'invariant' | 'effect' | 'error-case' | 'nullability' | 'exhaustiveness';
  /** The rule expressed in ISL-like syntax */
  rule: string;
  /** Confidence 0-1 */
  confidence: number;
  /** Why this rule was inferred */
  evidence: string;
  /** Which heuristic produced this rule */
  heuristic: string;
}

export interface Tier2Result {
  rules: InferredRule[];
  /** Categories that have no coverage and may need AI help */
  gaps: InferenceGap[];
}

export interface InferenceGap {
  symbolName: string;
  missingCategory: InferredRule['category'];
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 3 output: AI-completed rules
// ─────────────────────────────────────────────────────────────────────────────

export interface AICompletedRule extends InferredRule {
  /** The evidence from the source code that grounds this rule */
  groundedEvidence: string;
  /** Whether the AI output passed structured validation */
  validated: boolean;
}

export interface Tier3Result {
  rules: AICompletedRule[];
  /** Whether AI was actually invoked (vs skipped because Tier 2 was sufficient) */
  aiInvoked: boolean;
  /** Reason AI was or wasn't invoked */
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full pipeline result
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineResult {
  ir: TypedIntentIR;
  tier2: Tier2Result;
  tier3: Tier3Result;
  /** The final generated ISL */
  isl: string;
  /** Overall confidence */
  confidence: number;
  /** Diagnostics / warnings */
  diagnostics: PipelineDiagnostic[];
}

export interface PipelineDiagnostic {
  severity: 'info' | 'warning' | 'error';
  tier: 1 | 2 | 3;
  message: string;
  symbolName?: string;
}
