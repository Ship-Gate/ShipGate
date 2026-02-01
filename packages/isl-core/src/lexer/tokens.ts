/**
 * ISL Token Types
 * 
 * Defines all token types for the Intent Specification Language.
 * The lexer produces a stream of these tokens for the parser to consume.
 */

export enum TokenType {
  // Keywords - Domain Structure
  DOMAIN = 'DOMAIN',
  ENTITY = 'ENTITY',
  BEHAVIOR = 'BEHAVIOR',
  TYPE = 'TYPE',
  ENUM = 'ENUM',
  
  // Keywords - Behavior Sections
  INPUT = 'INPUT',
  OUTPUT = 'OUTPUT',
  PRECONDITIONS = 'PRECONDITIONS',
  POSTCONDITIONS = 'POSTCONDITIONS',
  INVARIANTS = 'INVARIANTS',
  TEMPORAL = 'TEMPORAL',
  SECURITY = 'SECURITY',
  COMPLIANCE = 'COMPLIANCE',
  ACTORS = 'ACTORS',
  ERRORS = 'ERRORS',
  
  // Keywords - Modifiers & Conditions
  IMPLIES = 'IMPLIES',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  WHEN = 'WHEN',
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  IN = 'IN',
  
  // Keywords - Temporal
  EVENTUALLY = 'EVENTUALLY',
  WITHIN = 'WITHIN',
  IMMEDIATELY = 'IMMEDIATELY',
  NEVER = 'NEVER',
  ALWAYS = 'ALWAYS',
  
  // Keywords - Types
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  NULL = 'NULL',
  
  // Literals
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  
  // Operators
  EQUALS = 'EQUALS',           // ==
  NOT_EQUALS = 'NOT_EQUALS',   // !=
  ASSIGN = 'ASSIGN',           // =
  GT = 'GT',                   // >
  LT = 'LT',                   // <
  GTE = 'GTE',                 // >=
  LTE = 'LTE',                 // <=
  ARROW = 'ARROW',             // ->
  FAT_ARROW = 'FAT_ARROW',     // =>
  
  // Delimiters
  LBRACE = 'LBRACE',           // {
  RBRACE = 'RBRACE',           // }
  LPAREN = 'LPAREN',           // (
  RPAREN = 'RPAREN',           // )
  LBRACKET = 'LBRACKET',       // [
  RBRACKET = 'RBRACKET',       // ]
  
  // Punctuation
  COLON = 'COLON',             // :
  COMMA = 'COMMA',             // ,
  DOT = 'DOT',                 // .
  QUESTION = 'QUESTION',       // ?
  DASH = 'DASH',               // -
  PIPE = 'PIPE',               // |
  AT = 'AT',                   // @
  HASH = 'HASH',               // #
  
  // Special
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',
  
  // Error token for recovery
  ERROR = 'ERROR',
}

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface SourceSpan {
  start: SourceLocation;
  end: SourceLocation;
  file?: string;
}

export interface Token {
  type: TokenType;
  value: string;
  span: SourceSpan;
}

/**
 * Reserved keywords mapped to their token types
 */
export const KEYWORDS: Record<string, TokenType> = {
  // Domain structure
  domain: TokenType.DOMAIN,
  entity: TokenType.ENTITY,
  behavior: TokenType.BEHAVIOR,
  type: TokenType.TYPE,
  enum: TokenType.ENUM,
  
  // Behavior sections
  input: TokenType.INPUT,
  output: TokenType.OUTPUT,
  preconditions: TokenType.PRECONDITIONS,
  postconditions: TokenType.POSTCONDITIONS,
  invariants: TokenType.INVARIANTS,
  temporal: TokenType.TEMPORAL,
  security: TokenType.SECURITY,
  compliance: TokenType.COMPLIANCE,
  actors: TokenType.ACTORS,
  errors: TokenType.ERRORS,
  
  // Conditions
  implies: TokenType.IMPLIES,
  success: TokenType.SUCCESS,
  failure: TokenType.FAILURE,
  when: TokenType.WHEN,
  and: TokenType.AND,
  or: TokenType.OR,
  not: TokenType.NOT,
  in: TokenType.IN,
  
  // Temporal
  eventually: TokenType.EVENTUALLY,
  within: TokenType.WITHIN,
  immediately: TokenType.IMMEDIATELY,
  never: TokenType.NEVER,
  always: TokenType.ALWAYS,
  
  // Literals
  true: TokenType.TRUE,
  false: TokenType.FALSE,
  null: TokenType.NULL,
};

/**
 * Check if a string is a keyword
 */
export function isKeyword(str: string): boolean {
  return str.toLowerCase() in KEYWORDS;
}

/**
 * Get the token type for a keyword, or IDENTIFIER if not a keyword
 */
export function getKeywordType(str: string): TokenType {
  return KEYWORDS[str.toLowerCase()] ?? TokenType.IDENTIFIER;
}

/**
 * Create a token
 */
export function createToken(
  type: TokenType,
  value: string,
  start: SourceLocation,
  end: SourceLocation,
  file?: string
): Token {
  return {
    type,
    value,
    span: { start, end, file },
  };
}

/**
 * Human-readable token type names for error messages
 */
export function tokenTypeName(type: TokenType): string {
  switch (type) {
    case TokenType.LBRACE: return "'{'";
    case TokenType.RBRACE: return "'}'";
    case TokenType.LPAREN: return "'('";
    case TokenType.RPAREN: return "')'";
    case TokenType.LBRACKET: return "'['";
    case TokenType.RBRACKET: return "']'";
    case TokenType.COLON: return "':'";
    case TokenType.COMMA: return "','";
    case TokenType.DOT: return "'.'";
    case TokenType.EQUALS: return "'=='";
    case TokenType.ASSIGN: return "'='";
    case TokenType.ARROW: return "'->'";
    case TokenType.EOF: return "end of file";
    case TokenType.IDENTIFIER: return "identifier";
    case TokenType.STRING: return "string";
    case TokenType.NUMBER: return "number";
    default: return type.toLowerCase();
  }
}
