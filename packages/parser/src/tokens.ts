// ============================================================================
// ISL Token Types and Definitions
// ============================================================================

import type { SourceLocation } from './ast.js';

// Token categories
export type TokenType =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'OPERATOR'
  | 'PUNCTUATION'
  | 'COMMENT'
  | 'DURATION'
  | 'REGEX'
  | 'WHITESPACE'
  | 'NEWLINE'
  | 'EOF'
  | 'ERROR';

// Specific token kinds for precise parsing
export type TokenKind =
  // Keywords
  | 'DOMAIN' | 'VERSION' | 'OWNER' | 'IMPORTS' | 'FROM' | 'AS'
  | 'TYPE' | 'ENUM' | 'ENTITY' | 'BEHAVIOR' | 'VIEW' | 'POLICY'
  | 'INVARIANTS' | 'SCENARIOS' | 'CHAOS' | 'COMPOSITION'
  | 'INPUT' | 'OUTPUT' | 'SUCCESS' | 'ERRORS' | 'WHEN' | 'RETRIABLE' | 'RETRY_AFTER' | 'RETURNS'
  | 'PRECONDITIONS' | 'POSTCONDITIONS' | 'IMPLIES'
  | 'TEMPORAL' | 'EVENTUALLY' | 'ALWAYS' | 'WITHIN' | 'NEVER' | 'IMMEDIATELY'
  | 'SECURITY' | 'REQUIRES' | 'RATE_LIMIT' | 'COMPLIANCE'
  | 'OBSERVABILITY' | 'METRICS' | 'TRACES' | 'LOGS' | 'SPAN'
  | 'ACTORS' | 'MUST' | 'DESCRIPTION' | 'LIFECYCLE'
  | 'GIVEN' | 'THEN' | 'INJECT' | 'SCENARIO'
  | 'FOR' | 'FIELDS' | 'CONSISTENCY' | 'CACHE' | 'TTL' | 'INVALIDATE_ON'
  | 'SCOPE' | 'GLOBAL' | 'TRANSACTION' | 'APPLIES_TO' | 'RULES' | 'DEFAULT'
  | 'STEP' | 'COMPENSATIONS' | 'TIMEOUT' | 'ON_FAILURE'
  // Type keywords
  | 'STRING_TYPE' | 'INT_TYPE' | 'DECIMAL_TYPE' | 'BOOLEAN_TYPE'
  | 'TIMESTAMP_TYPE' | 'UUID_TYPE' | 'DURATION_TYPE' | 'LIST' | 'MAP'
  // Boolean literals
  | 'TRUE' | 'FALSE'
  // Operators
  | 'EQUALS' | 'NOT_EQUALS' | 'LT' | 'GT' | 'LTE' | 'GTE'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT'
  | 'AND' | 'OR' | 'NOT' | 'IN' | 'IFF'
  | 'ASSIGN' | 'ARROW' | 'FAT_ARROW' | 'DOUBLE_COLON'
  // Quantifiers
  | 'ALL' | 'ANY' | 'NONE' | 'COUNT' | 'SUM' | 'FILTER'
  // Special expressions
  | 'OLD' | 'RESULT' | 'NOW' | 'THIS'
  // Punctuation
  | 'LBRACE' | 'RBRACE' | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET'
  | 'COMMA' | 'COLON' | 'SEMICOLON' | 'DOT' | 'QUESTION' | 'PIPE' | 'AT'
  // Literals
  | 'IDENTIFIER' | 'STRING_LITERAL' | 'NUMBER_LITERAL' | 'REGEX_LITERAL' | 'DURATION_LITERAL'
  // Other
  | 'COMMENT' | 'WHITESPACE' | 'NEWLINE' | 'EOF' | 'ERROR'
  // Additional context keywords
  | 'COUNTER' | 'GAUGE' | 'HISTOGRAM' | 'BY'
  | 'ON' | 'LEVEL' | 'INCLUDE' | 'EXCLUDE'
  | 'EVENTUAL' | 'STRONG' | 'STRONGLY_CONSISTENT'
  | 'PER' | 'AUTHENTICATED' | 'REFERENCES';

export interface Token {
  type: TokenType;
  kind: TokenKind;
  value: string;
  location: SourceLocation;
}

// Keywords mapping
export const KEYWORDS: Map<string, TokenKind> = new Map([
  // Top-level
  ['domain', 'DOMAIN'],
  ['version', 'VERSION'],
  ['owner', 'OWNER'],
  ['imports', 'IMPORTS'],
  ['from', 'FROM'],
  ['as', 'AS'],
  
  // Declarations
  ['type', 'TYPE'],
  ['enum', 'ENUM'],
  ['entity', 'ENTITY'],
  ['behavior', 'BEHAVIOR'],
  ['view', 'VIEW'],
  ['policy', 'POLICY'],
  ['invariants', 'INVARIANTS'],
  ['scenarios', 'SCENARIOS'],
  ['chaos', 'CHAOS'],
  ['composition', 'COMPOSITION'],
  
  // Behavior parts
  ['input', 'INPUT'],
  ['output', 'OUTPUT'],
  ['success', 'SUCCESS'],
  ['errors', 'ERRORS'],
  ['when', 'WHEN'],
  ['retriable', 'RETRIABLE'],
  ['retry_after', 'RETRY_AFTER'],
  ['returns', 'RETURNS'],
  ['preconditions', 'PRECONDITIONS'],
  ['postconditions', 'POSTCONDITIONS'],
  ['implies', 'IMPLIES'],
  ['description', 'DESCRIPTION'],
  ['actors', 'ACTORS'],
  ['must', 'MUST'],
  ['lifecycle', 'LIFECYCLE'],
  
  // Temporal
  ['temporal', 'TEMPORAL'],
  ['eventually', 'EVENTUALLY'],
  ['always', 'ALWAYS'],
  ['within', 'WITHIN'],
  ['never', 'NEVER'],
  ['immediately', 'IMMEDIATELY'],
  ['response', 'TEMPORAL'], // contextual
  
  // Security
  ['security', 'SECURITY'],
  ['requires', 'REQUIRES'],
  ['rate_limit', 'RATE_LIMIT'],
  ['compliance', 'COMPLIANCE'],
  ['authentication', 'AUTHENTICATED'],
  ['authenticated', 'AUTHENTICATED'],
  
  // Observability
  ['observability', 'OBSERVABILITY'],
  ['metrics', 'METRICS'],
  ['traces', 'TRACES'],
  ['logs', 'LOGS'],
  ['span', 'SPAN'],
  ['counter', 'COUNTER'],
  ['gauge', 'GAUGE'],
  ['histogram', 'HISTOGRAM'],
  ['by', 'BY'],
  ['on', 'ON'],
  ['level', 'LEVEL'],
  ['include', 'INCLUDE'],
  ['exclude', 'EXCLUDE'],
  
  // Scenarios
  ['given', 'GIVEN'],
  ['then', 'THEN'],
  ['inject', 'INJECT'],
  ['scenario', 'SCENARIO'],
  
  // Views
  ['for', 'FOR'],
  ['fields', 'FIELDS'],
  ['consistency', 'CONSISTENCY'],
  ['cache', 'CACHE'],
  ['ttl', 'TTL'],
  ['invalidate_on', 'INVALIDATE_ON'],
  ['eventual', 'EVENTUAL'],
  ['strong', 'STRONG'],
  ['strongly_consistent', 'STRONGLY_CONSISTENT'],
  
  // Invariants/Policy
  ['scope', 'SCOPE'],
  ['global', 'GLOBAL'],
  ['transaction', 'TRANSACTION'],
  ['applies_to', 'APPLIES_TO'],
  ['rules', 'RULES'],
  ['default', 'DEFAULT'],
  
  // Composition
  ['step', 'STEP'],
  ['compensations', 'COMPENSATIONS'],
  ['timeout', 'TIMEOUT'],
  ['on_failure', 'ON_FAILURE'],
  
  // Types
  ['String', 'STRING_TYPE'],
  ['Int', 'INT_TYPE'],
  ['Decimal', 'DECIMAL_TYPE'],
  ['Boolean', 'BOOLEAN_TYPE'],
  ['Timestamp', 'TIMESTAMP_TYPE'],
  ['UUID', 'UUID_TYPE'],
  ['Duration', 'DURATION_TYPE'],
  ['List', 'LIST'],
  ['Map', 'MAP'],
  
  // Boolean
  ['true', 'TRUE'],
  ['false', 'FALSE'],
  
  // Logical operators
  ['and', 'AND'],
  ['or', 'OR'],
  ['not', 'NOT'],
  ['in', 'IN'],
  ['iff', 'IFF'],
  
  // Quantifiers
  ['all', 'ALL'],
  ['any', 'ANY'],
  ['none', 'NONE'],
  ['count', 'COUNT'],
  ['sum', 'SUM'],
  ['filter', 'FILTER'],
  
  // Special expressions
  ['old', 'OLD'],
  ['result', 'RESULT'],
  ['now', 'NOW'],
  ['this', 'THIS'],
  
  // Other
  ['per', 'PER'],
  ['references', 'REFERENCES'],
  ['is', 'EQUALS'], // contextual equals
  ['error', 'ERROR'],
  ['any_error', 'ANY'],
]);

// Duration units
export const DURATION_UNITS = ['ms', 'seconds', 'minutes', 'hours', 'days'] as const;
export type DurationUnit = typeof DURATION_UNITS[number];

// Operator precedence for expression parsing
export const PRECEDENCE: Record<string, number> = {
  'or': 1,
  '||': 1,
  'and': 2,
  '&&': 2,
  'implies': 2,
  'iff': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '>': 4,
  '<=': 4,
  '>=': 4,
  'in': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
  'not': 7,
};

// Check if a string is a primitive type
export function isPrimitiveType(name: string): boolean {
  return ['String', 'Int', 'Decimal', 'Boolean', 'Timestamp', 'UUID', 'Duration'].includes(name);
}

// Create a token helper
export function createToken(
  type: TokenType,
  kind: TokenKind,
  value: string,
  file: string,
  line: number,
  column: number,
  endLine: number,
  endColumn: number
): Token {
  return {
    type,
    kind,
    value,
    location: { file, line, column, endLine, endColumn },
  };
}
