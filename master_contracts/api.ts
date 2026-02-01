// ============================================================================
// ISL (Intent Specification Language) - Module API Contracts
// Version: 0.1.0
// ============================================================================

import type * as AST from './ast';

// ============================================================================
// PARSER API
// ============================================================================

export interface ParserAPI {
  /** Parse ISL source code into an AST */
  parse(source: string, filename?: string): ParseResult;
  
  /** Parse an ISL file from disk */
  parseFile(path: string): Promise<ParseResult>;
}

export interface ParseResult {
  success: boolean;
  domain?: AST.Domain;
  errors: Diagnostic[];
  tokens?: Token[]; // For tooling
}

export interface Token {
  type: TokenType;
  value: string;
  location: AST.SourceLocation;
}

export type TokenType =
  | 'KEYWORD' | 'IDENTIFIER' | 'STRING' | 'NUMBER' | 'BOOLEAN'
  | 'OPERATOR' | 'PUNCTUATION' | 'COMMENT' | 'WHITESPACE' | 'EOF';

// ============================================================================
// TYPE CHECKER API
// ============================================================================

export interface TypeCheckerAPI {
  /** Type check a parsed AST */
  check(domain: AST.Domain): TypeCheckResult;
  
  /** Incremental type checking for IDE */
  checkIncremental(domain: AST.Domain, changed: AST.SourceLocation[]): TypeCheckResult;
}

export interface TypeCheckResult {
  success: boolean;
  diagnostics: Diagnostic[];
  symbolTable: SymbolTable;
  typeMap: TypeMap;
}

export interface SymbolTable {
  lookup(name: string): Symbol | undefined;
  lookupQualified(parts: string[]): Symbol | undefined;
  getScope(location: AST.SourceLocation): Scope;
  getAllSymbols(): Symbol[];
}

export interface Symbol {
  name: string;
  kind: SymbolKind;
  type: ResolvedType;
  location: AST.SourceLocation;
  documentation?: string;
  modifiers: SymbolModifier[];
}

export type SymbolKind = 
  | 'type' | 'entity' | 'behavior' | 'field' | 'variable' 
  | 'parameter' | 'error' | 'invariant' | 'policy' | 'view';

export type SymbolModifier = 
  | 'immutable' | 'unique' | 'indexed' | 'pii' | 'secret' 
  | 'sensitive' | 'computed' | 'optional' | 'deprecated';

export interface Scope {
  name: string;
  symbols: Map<string, Symbol>;
  parent?: Scope;
  children: Scope[];
}

export type TypeMap = Map<AST.ASTNode, ResolvedType>;

export type ResolvedType =
  | PrimitiveResolvedType
  | EntityResolvedType
  | EnumResolvedType
  | StructResolvedType
  | ListResolvedType
  | MapResolvedType
  | OptionalResolvedType
  | UnionResolvedType
  | FunctionResolvedType
  | ErrorResolvedType
  | UnknownResolvedType;

export interface PrimitiveResolvedType {
  kind: 'primitive';
  name: string;
  constraints: ResolvedConstraint[];
}

export interface ResolvedConstraint {
  name: string;
  value: unknown;
}

export interface EntityResolvedType {
  kind: 'entity';
  name: string;
  fields: Map<string, ResolvedType>;
}

export interface EnumResolvedType {
  kind: 'enum';
  name: string;
  variants: string[];
}

export interface StructResolvedType {
  kind: 'struct';
  fields: Map<string, ResolvedType>;
}

export interface ListResolvedType {
  kind: 'list';
  element: ResolvedType;
}

export interface MapResolvedType {
  kind: 'map';
  key: ResolvedType;
  value: ResolvedType;
}

export interface OptionalResolvedType {
  kind: 'optional';
  inner: ResolvedType;
}

export interface UnionResolvedType {
  kind: 'union';
  variants: ResolvedType[];
}

export interface FunctionResolvedType {
  kind: 'function';
  params: ResolvedType[];
  returns: ResolvedType;
}

export interface ErrorResolvedType {
  kind: 'error';
  message: string;
}

export interface UnknownResolvedType {
  kind: 'unknown';
}

// ============================================================================
// CODE GENERATOR APIs
// ============================================================================

export interface TestGeneratorAPI {
  /** Generate test files from ISL spec */
  generate(domain: AST.Domain, options: TestGenOptions): Promise<TestGenResult>;
}

export interface TestGenOptions {
  framework: 'jest' | 'vitest' | 'pytest' | 'go-test';
  language: 'typescript' | 'python' | 'go';
  outputDir: string;
  includePropertyTests: boolean;
  includeChaosTests: boolean;
  includeScenarios: boolean;
}

export interface TestGenResult {
  success: boolean;
  files: GeneratedFile[];
  errors: Diagnostic[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'test' | 'fixture' | 'helper' | 'config';
}

export interface TypeGeneratorAPI {
  /** Generate type definitions from ISL spec */
  generate(domain: AST.Domain, options: TypeGenOptions): Promise<TypeGenResult>;
}

export interface TypeGenOptions {
  language: 'typescript' | 'python' | 'rust' | 'go';
  outputDir: string;
  includeValidation: boolean;
  includeSerdes: boolean;
  includeBuilders: boolean;
}

export interface TypeGenResult {
  success: boolean;
  files: GeneratedFile[];
  errors: Diagnostic[];
}

export interface DocGeneratorAPI {
  /** Generate documentation from ISL spec */
  generate(domain: AST.Domain, options: DocGenOptions): Promise<DocGenResult>;
}

export interface DocGenOptions {
  format: 'markdown' | 'html' | 'openapi' | 'asyncapi';
  outputDir: string;
  includeDiagrams: boolean;
  includeExamples: boolean;
  theme?: string;
}

export interface DocGenResult {
  success: boolean;
  files: GeneratedFile[];
  errors: Diagnostic[];
}

// ============================================================================
// AI GENERATOR API
// ============================================================================

export interface AIGeneratorAPI {
  /** Generate implementation from ISL spec */
  generate(domain: AST.Domain, behavior: string, options: AIGenOptions): Promise<AIGenResult>;
  
  /** Generate multiple implementations for comparison */
  generateMultiple(domain: AST.Domain, behavior: string, options: AIGenOptions, count: number): Promise<AIGenResult[]>;
}

export interface AIGenOptions {
  model: string; // 'claude-sonnet-4-20250514', 'gpt-4', etc.
  language: 'typescript' | 'python' | 'go';
  style: 'functional' | 'oop' | 'hybrid';
  framework?: string; // 'express', 'fastapi', etc.
  includeTests: boolean;
  maxTokens: number;
}

export interface AIGenResult {
  success: boolean;
  implementation: GeneratedFile;
  tests?: GeneratedFile;
  confidence: number;
  ambiguities: Ambiguity[];
  reasoning: string;
}

export interface Ambiguity {
  location: AST.SourceLocation;
  specText: string;
  description: string;
  possibleInterpretations: string[];
  chosenInterpretation: string;
  confidence: number;
}

// ============================================================================
// VERIFIER APIs
// ============================================================================

export interface RuntimeVerifierAPI {
  /** Verify implementation against spec at runtime */
  verify(request: VerifyRequest): Promise<VerifyResult>;
}

export interface ChaosVerifierAPI {
  /** Run chaos scenarios against implementation */
  verify(request: ChaosVerifyRequest): Promise<VerifyResult>;
}

export interface TemporalVerifierAPI {
  /** Verify temporal properties */
  verify(request: TemporalVerifyRequest): Promise<VerifyResult>;
}

export interface VerifyRequest {
  implementation: string; // Path to implementation file
  domain: AST.Domain;
  behavior: string;
  config?: VerifyConfig;
}

export interface ChaosVerifyRequest extends VerifyRequest {
  scenarios: string[]; // Names of chaos scenarios to run
  duration?: number; // Max duration in ms
}

export interface TemporalVerifyRequest extends VerifyRequest {
  timeout?: number; // Max time to wait for temporal properties
}

export interface VerifyConfig {
  timeout: number;
  retries: number;
  parallel: boolean;
  collectCoverage: boolean;
  recordVideo: boolean;
  recordTrace: boolean;
}

export interface VerifyResult {
  success: boolean;
  verdict: 'verified' | 'risky' | 'unsafe';
  score: number; // 0-100
  passed: TestResult[];
  failed: TestResult[];
  skipped: TestResult[];
  coverage: CoverageReport;
  timing: TimingReport;
  proofBundle?: ProofBundle;
}

export interface TestResult {
  name: string;
  type: 'precondition' | 'postcondition' | 'invariant' | 'temporal' | 'chaos' | 'scenario';
  passed: boolean;
  duration: number;
  error?: TestError;
  trace?: string;
}

export interface TestError {
  message: string;
  expected?: unknown;
  actual?: unknown;
  stack?: string;
  location?: AST.SourceLocation;
}

export interface CoverageReport {
  preconditions: CoverageMetric;
  postconditions: CoverageMetric;
  invariants: CoverageMetric;
  temporal: CoverageMetric;
  scenarios: CoverageMetric;
  chaos: CoverageMetric;
  overall: number;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface TimingReport {
  total: number;
  setup: number;
  execution: number;
  teardown: number;
  byTest: Map<string, number>;
}

export interface ProofBundle {
  id: string;
  version: string;
  timestamp: string;
  domain: string;
  behavior: string;
  implementation: string;
  implementationHash: string;
  verdict: 'verified' | 'risky' | 'unsafe';
  score: number;
  coverage: CoverageReport;
  artifacts: ProofArtifact[];
  environment: EnvironmentInfo;
  reproducible: boolean;
  seed?: string;
}

export interface ProofArtifact {
  type: 'trace' | 'screenshot' | 'video' | 'log' | 'timeline' | 'har' | 'coverage';
  name: string;
  path: string;
  size: number;
  hash: string;
}

export interface EnvironmentInfo {
  os: string;
  nodeVersion: string;
  dependencies: Map<string, string>;
  env: Map<string, string>; // Sanitized env vars
}

// ============================================================================
// LSP API
// ============================================================================

export interface LSPServerAPI {
  /** Initialize the LSP server */
  initialize(params: InitializeParams): Promise<InitializeResult>;
  
  /** Handle document open */
  onDocumentOpen(params: DocumentOpenParams): void;
  
  /** Handle document change */
  onDocumentChange(params: DocumentChangeParams): void;
  
  /** Get completions */
  getCompletions(params: CompletionParams): Promise<CompletionResult>;
  
  /** Get hover info */
  getHover(params: HoverParams): Promise<HoverResult | null>;
  
  /** Get diagnostics */
  getDiagnostics(params: DiagnosticParams): Promise<Diagnostic[]>;
  
  /** Go to definition */
  getDefinition(params: DefinitionParams): Promise<LocationResult | null>;
  
  /** Find references */
  getReferences(params: ReferenceParams): Promise<LocationResult[]>;
  
  /** Get document symbols */
  getDocumentSymbols(params: DocumentSymbolParams): Promise<DocumentSymbol[]>;
  
  /** Format document */
  formatDocument(params: FormatParams): Promise<TextEdit[]>;
  
  /** Get code actions */
  getCodeActions(params: CodeActionParams): Promise<CodeAction[]>;
}

export interface InitializeParams {
  rootUri: string;
  capabilities: ClientCapabilities;
}

export interface InitializeResult {
  capabilities: ServerCapabilities;
}

export interface ClientCapabilities {
  textDocument?: {
    completion?: boolean;
    hover?: boolean;
    definition?: boolean;
    references?: boolean;
    formatting?: boolean;
    codeAction?: boolean;
  };
}

export interface ServerCapabilities {
  textDocumentSync: number;
  completionProvider?: { triggerCharacters: string[] };
  hoverProvider?: boolean;
  definitionProvider?: boolean;
  referencesProvider?: boolean;
  documentFormattingProvider?: boolean;
  codeActionProvider?: boolean;
}

export interface DocumentOpenParams {
  uri: string;
  text: string;
  version: number;
}

export interface DocumentChangeParams {
  uri: string;
  changes: TextDocumentChange[];
  version: number;
}

export interface TextDocumentChange {
  range?: Range;
  text: string;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  character: number;
}

export interface CompletionParams {
  uri: string;
  position: Position;
  context?: CompletionContext;
}

export interface CompletionContext {
  triggerKind: number;
  triggerCharacter?: string;
}

export interface CompletionResult {
  items: CompletionItem[];
  isIncomplete: boolean;
}

export interface CompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText: string;
  sortText?: string;
}

export type CompletionItemKind = 
  | 'keyword' | 'type' | 'entity' | 'behavior' | 'field' 
  | 'variable' | 'function' | 'snippet';

export interface HoverParams {
  uri: string;
  position: Position;
}

export interface HoverResult {
  contents: string;
  range?: Range;
}

export interface DiagnosticParams {
  uri: string;
}

export interface DefinitionParams {
  uri: string;
  position: Position;
}

export interface LocationResult {
  uri: string;
  range: Range;
}

export interface ReferenceParams {
  uri: string;
  position: Position;
  includeDeclaration: boolean;
}

export interface DocumentSymbolParams {
  uri: string;
}

export interface DocumentSymbol {
  name: string;
  kind: SymbolKind;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}

export interface FormatParams {
  uri: string;
  options: FormatOptions;
}

export interface FormatOptions {
  tabSize: number;
  insertSpaces: boolean;
}

export interface TextEdit {
  range: Range;
  newText: string;
}

export interface CodeActionParams {
  uri: string;
  range: Range;
  context: CodeActionContext;
}

export interface CodeActionContext {
  diagnostics: Diagnostic[];
}

export interface CodeAction {
  title: string;
  kind: CodeActionKind;
  diagnostics?: Diagnostic[];
  edit?: WorkspaceEdit;
  command?: Command;
}

export type CodeActionKind = 'quickfix' | 'refactor' | 'source';

export interface WorkspaceEdit {
  changes: Map<string, TextEdit[]>;
}

export interface Command {
  title: string;
  command: string;
  arguments?: unknown[];
}

// ============================================================================
// CLI API
// ============================================================================

export interface CLIAPI {
  /** Parse and validate ISL files */
  check(files: string[], options: CheckOptions): Promise<CheckResult>;
  
  /** Generate code from ISL */
  generate(files: string[], options: GenerateOptions): Promise<GenerateResult>;
  
  /** Run verification */
  verify(files: string[], options: CLIVerifyOptions): Promise<VerifyResult>;
  
  /** Start watch mode */
  watch(files: string[], options: WatchOptions): Promise<void>;
  
  /** Initialize new ISL project */
  init(options: InitOptions): Promise<void>;
}

export interface CheckOptions {
  strict: boolean;
  quiet: boolean;
  format: 'text' | 'json';
}

export interface CheckResult {
  success: boolean;
  files: FileCheckResult[];
  summary: CheckSummary;
}

export interface FileCheckResult {
  file: string;
  success: boolean;
  diagnostics: Diagnostic[];
}

export interface CheckSummary {
  totalFiles: number;
  passedFiles: number;
  failedFiles: number;
  errors: number;
  warnings: number;
}

export interface GenerateOptions {
  target: 'types' | 'tests' | 'docs' | 'all';
  language: 'typescript' | 'python' | 'go';
  outputDir: string;
  overwrite: boolean;
}

export interface GenerateResult {
  success: boolean;
  files: GeneratedFile[];
  errors: Diagnostic[];
}

export interface CLIVerifyOptions {
  implementation: string;
  behavior?: string;
  chaos: boolean;
  temporal: boolean;
  timeout: number;
  output: 'text' | 'json' | 'html';
}

export interface WatchOptions {
  onCheck?: (result: CheckResult) => void;
  onGenerate?: (result: GenerateResult) => void;
}

export interface InitOptions {
  name: string;
  template: 'minimal' | 'full' | 'enterprise';
  packageManager: 'npm' | 'yarn' | 'pnpm';
}

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  location: AST.SourceLocation;
  source: string; // 'parser', 'typechecker', 'verifier', etc.
  relatedInformation?: RelatedInformation[];
  fix?: CodeFix;
  tags?: DiagnosticTag[];
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';
export type DiagnosticTag = 'unnecessary' | 'deprecated';

export interface RelatedInformation {
  message: string;
  location: AST.SourceLocation;
}

export interface CodeFix {
  title: string;
  edits: TextEdit[];
  isPreferred?: boolean;
}