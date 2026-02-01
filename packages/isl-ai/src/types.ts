// ============================================================================
// ISL AI Types
// ============================================================================

import type * as AST from '../../../master_contracts/ast';

// ============================================================================
// AI PROVIDER TYPES
// ============================================================================

export interface AIProvider {
  name: string;
  complete(prompt: string, options?: AICompletionOptions): Promise<string>;
  chat(messages: ChatMessage[], options?: AICompletionOptions): Promise<string>;
  embed(text: string): Promise<number[]>;
}

export interface AICompletionOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ============================================================================
// COMPLETION TYPES
// ============================================================================

export interface CompletionItem {
  label: string;
  kind: CompletionKind;
  detail?: string;
  documentation?: string;
  insertText: string;
  sortText?: string;
  filterText?: string;
  preselect?: boolean;
  additionalEdits?: TextEdit[];
}

export type CompletionKind =
  | 'entity'
  | 'behavior'
  | 'type'
  | 'field'
  | 'keyword'
  | 'snippet'
  | 'value'
  | 'constraint'
  | 'annotation';

export interface TextEdit {
  range: TextRange;
  newText: string;
}

export interface TextRange {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  column: number;
}

// ============================================================================
// GENERATION TYPES
// ============================================================================

export interface GenerationConfig {
  style?: 'concise' | 'detailed' | 'documented';
  includeExamples?: boolean;
  includeTests?: boolean;
  domainContext?: AST.Domain;
}

export interface GeneratedComponent {
  kind: 'entity' | 'behavior' | 'type' | 'invariant' | 'policy';
  name: string;
  code: string;
  confidence: number;
  alternatives?: string[];
}

// ============================================================================
// ANALYSIS TYPES
// ============================================================================

export interface CodeQualityMetric {
  name: string;
  score: number;  // 0-100
  description: string;
  suggestions?: string[];
}

export interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  location?: AST.SourceLocation;
  fix?: string;
}

export interface DesignPattern {
  name: string;
  description: string;
  applicable: boolean;
  recommendation?: string;
}

// ============================================================================
// EXPLANATION TYPES
// ============================================================================

export interface ExplanationLevel {
  audience: 'developer' | 'architect' | 'business' | 'beginner';
  detail: 'brief' | 'standard' | 'comprehensive';
}

export interface ConceptExplanation {
  concept: string;
  summary: string;
  details: string;
  examples?: string[];
  relatedConcepts?: string[];
}

// ============================================================================
// REFACTORING TYPES
// ============================================================================

export interface RefactoringOption {
  name: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  automated: boolean;
  preview: string;
}

export interface RefactoringResult {
  applied: RefactoringOption[];
  newCode: string;
  diff: string;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface ISLContext {
  currentFile?: string;
  cursorPosition?: Position;
  visibleRange?: TextRange;
  projectDomains?: AST.Domain[];
  recentEdits?: RecentEdit[];
  semanticContext?: SemanticContext;
}

export interface RecentEdit {
  file: string;
  range: TextRange;
  text: string;
  timestamp: Date;
}

export interface SemanticContext {
  currentEntity?: AST.Entity;
  currentBehavior?: AST.Behavior;
  availableTypes: string[];
  availableEntities: string[];
  availableBehaviors: string[];
  importedDomains: string[];
}

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

export interface PromptTemplate {
  name: string;
  template: string;
  variables: string[];
}

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  entityGeneration: {
    name: 'Entity Generation',
    template: `Generate an ISL entity definition based on the following description:

Description: {{description}}

The entity should include:
- Appropriate fields with types
- Relevant constraints
- A lifecycle if applicable
- Invariants to ensure data integrity

Existing types in the domain: {{existingTypes}}

Respond with valid ISL syntax.`,
    variables: ['description', 'existingTypes'],
  },

  behaviorGeneration: {
    name: 'Behavior Generation',
    template: `Generate an ISL behavior definition based on the following:

Name: {{name}}
Purpose: {{purpose}}
Actor: {{actor}}

Available entities: {{entities}}

The behavior should include:
- Complete input specification
- Success and error outputs
- Preconditions and postconditions
- Appropriate security constraints

Respond with valid ISL syntax.`,
    variables: ['name', 'purpose', 'actor', 'entities'],
  },

  codeCompletion: {
    name: 'Code Completion',
    template: `Complete the following ISL code:

{{prefix}}[CURSOR]{{suffix}}

Context:
- File: {{fileName}}
- Current construct: {{construct}}
- Available types: {{types}}

Provide a natural completion that follows ISL syntax and best practices.`,
    variables: ['prefix', 'suffix', 'fileName', 'construct', 'types'],
  },

  explanation: {
    name: 'Code Explanation',
    template: `Explain the following ISL code for a {{audience}} audience:

\`\`\`isl
{{code}}
\`\`\`

Provide a {{detail}} explanation covering:
- What the code does
- Key concepts used
- Design decisions
- Potential improvements`,
    variables: ['audience', 'detail', 'code'],
  },
};
