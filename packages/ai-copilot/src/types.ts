/**
 * AI Copilot Types
 */

export interface CopilotConfig {
  provider: 'anthropic' | 'openai' | 'local';
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  cacheEnabled?: boolean;
  contextWindow?: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationContext {
  messages: ConversationMessage[];
  islContext?: ISLContext;
  codeContext?: CodeContext;
}

export interface ISLContext {
  currentDomain?: string;
  entities: string[];
  behaviors: string[];
  types: string[];
  imports: string[];
}

export interface CodeContext {
  language: string;
  filePath?: string;
  selectedCode?: string;
  surroundingCode?: string;
  projectStructure?: string[];
}

export interface GenerationRequest {
  type: 'isl' | 'code' | 'test' | 'documentation' | 'review';
  prompt: string;
  context?: ConversationContext;
  options?: GenerationOptions;
}

export interface GenerationOptions {
  style?: 'concise' | 'detailed' | 'formal';
  includeExamples?: boolean;
  includeExplanation?: boolean;
  targetLanguage?: string;
  framework?: string;
}

export interface GenerationResult {
  content: string;
  type: GenerationRequest['type'];
  confidence: number;
  suggestions?: Suggestion[];
  warnings?: Warning[];
  tokens: {
    input: number;
    output: number;
  };
}

export interface Suggestion {
  type: 'improvement' | 'security' | 'performance' | 'style';
  message: string;
  code?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface Warning {
  type: 'error' | 'warning' | 'info';
  message: string;
  location?: {
    line: number;
    column: number;
  };
}

export interface NLToISLRequest {
  naturalLanguage: string;
  domainHint?: string;
  existingSpec?: string;
  examples?: Example[];
}

export interface Example {
  input: string;
  output: string;
  explanation?: string;
}

export interface ISLToCodeRequest {
  islSpec: string;
  targetLanguage: string;
  framework?: string;
  options?: {
    includeTests?: boolean;
    includeValidation?: boolean;
    style?: 'functional' | 'oop' | 'hybrid';
  };
}

export interface CodeToISLRequest {
  code: string;
  language: string;
  inferBehaviors?: boolean;
  inferInvariants?: boolean;
  inferTypes?: boolean;
}

export interface ReviewRequest {
  islSpec: string;
  reviewType: 'security' | 'completeness' | 'consistency' | 'performance' | 'all';
  strictness?: 'lenient' | 'normal' | 'strict';
}

export interface ReviewResult {
  score: number;
  issues: ReviewIssue[];
  suggestions: Suggestion[];
  summary: string;
}

export interface ReviewIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  location?: {
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
  };
  fix?: string;
}

export interface CompletionRequest {
  prefix: string;
  suffix?: string;
  context?: ISLContext;
  maxCompletions?: number;
}

export interface CompletionResult {
  completions: Completion[];
}

export interface Completion {
  text: string;
  displayText: string;
  kind: 'keyword' | 'type' | 'entity' | 'behavior' | 'field' | 'snippet';
  detail?: string;
  documentation?: string;
  insertText?: string;
  score: number;
}

export interface ExplainRequest {
  islSpec: string;
  targetAudience: 'developer' | 'business' | 'technical';
  format: 'prose' | 'bullet' | 'diagram';
}

export interface RefactorRequest {
  islSpec: string;
  refactorType: 'extract' | 'inline' | 'rename' | 'restructure' | 'optimize';
  target?: string;
  newName?: string;
}

export interface TestGenerationRequest {
  islSpec: string;
  testType: 'unit' | 'integration' | 'property' | 'contract';
  coverage?: 'minimal' | 'standard' | 'comprehensive';
  framework?: string;
}
