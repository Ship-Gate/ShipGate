/**
 * ISL Hover Provider
 * 
 * Provides hover information for ISL symbols.
 */

import { Hover, MarkupKind } from 'vscode-languageserver';
import { 
  type Position, 
  type Symbol, 
  type Token, 
  tokenize,
  KEYWORDS,
  BUILTIN_TYPES,
} from './parser.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HoverResult {
  contents: string;
  range?: {
    start: Position;
    end: Position;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Documentation
// ─────────────────────────────────────────────────────────────────────────────

const KEYWORD_DOCS: Record<string, { signature: string; description: string }> = {
  domain: {
    signature: 'domain DomainName { ... }',
    description: 'Defines a bounded context containing entities, behaviors, types, and enums.',
  },
  entity: {
    signature: 'entity EntityName { fields... }',
    description: 'An object with identity that persists over time. Contains fields and invariants.',
  },
  behavior: {
    signature: 'behavior BehaviorName { input, output, ... }',
    description: 'A named operation that transforms input to output with defined contracts.',
  },
  type: {
    signature: 'type TypeName = BaseType { constraints }',
    description: 'A named type alias with optional constraints and validation rules.',
  },
  enum: {
    signature: 'enum EnumName { VALUE1, VALUE2, ... }',
    description: 'A fixed set of named values.',
  },
  input: {
    signature: 'input { field: Type, ... }',
    description: 'Defines the input parameters for a behavior.',
  },
  output: {
    signature: 'output { success: Type, errors { ... } }',
    description: 'Defines the possible outputs for a behavior, including success and error cases.',
  },
  preconditions: {
    signature: 'preconditions { condition as "description" }',
    description: 'Conditions that must be true before a behavior can execute.',
  },
  postconditions: {
    signature: 'postconditions { success implies { ... } }',
    description: 'Conditions that must be true after successful execution.',
  },
  invariants: {
    signature: 'invariants { condition as "description" }',
    description: 'Conditions that must always be true for an entity.',
  },
  lifecycle: {
    signature: 'lifecycle { STATE1 -> STATE2 }',
    description: 'Defines valid state transitions for an entity.',
  },
  scenario: {
    signature: 'scenario "name" { given, when, then }',
    description: 'A test case that verifies behavior under specific conditions.',
  },
  temporal: {
    signature: 'temporal { response within X.ms (p99) }',
    description: 'Performance and timing constraints for a behavior.',
  },
  chaos: {
    signature: 'chaos { inject { failure }, when { ... }, then { ... } }',
    description: 'Chaos engineering tests that verify behavior under failure conditions.',
  },
  forall: {
    signature: 'forall x in collection: predicate',
    description: 'Universal quantifier - true if predicate holds for all elements.',
  },
  exists: {
    signature: 'exists x in collection: predicate',
    description: 'Existential quantifier - true if predicate holds for at least one element.',
  },
  implies: {
    signature: 'condition implies consequence',
    description: 'Logical implication - if condition is true, consequence must be true.',
  },
};

const TYPE_DOCS: Record<string, { signature: string; description: string; examples?: string[] }> = {
  String: {
    signature: 'String { pattern?: RegExp, minLength?: Int, maxLength?: Int }',
    description: 'A text value with optional constraints.',
    examples: ['type Email = String { pattern: /^[^@]+@[^@]+$/ }'],
  },
  Int: {
    signature: 'Int { min?: Int, max?: Int }',
    description: 'A 64-bit signed integer.',
    examples: ['type Age = Int { min: 0, max: 150 }'],
  },
  Float: {
    signature: 'Float { min?: Float, max?: Float, precision?: Int }',
    description: 'A 64-bit floating-point number.',
    examples: ['type Price = Float { min: 0, precision: 2 }'],
  },
  Boolean: {
    signature: 'Boolean',
    description: 'A true or false value.',
  },
  UUID: {
    signature: 'UUID',
    description: 'A universally unique identifier (v4 by default).',
  },
  ID: {
    signature: 'ID',
    description: 'Alias for UUID, used for entity identifiers.',
  },
  Timestamp: {
    signature: 'Timestamp',
    description: 'A point in time with microsecond precision and timezone.',
  },
  Duration: {
    signature: 'Duration',
    description: 'A length of time. Literals: `5.seconds`, `1.hour`, `30.minutes`',
    examples: ['retry_delay: 5.seconds', 'timeout: 30.minutes'],
  },
  Date: {
    signature: 'Date',
    description: 'A calendar date without time component.',
  },
  Time: {
    signature: 'Time',
    description: 'A time of day without date component.',
  },
  DateTime: {
    signature: 'DateTime',
    description: 'Combined date and time without timezone.',
  },
  Email: {
    signature: 'Email',
    description: 'A validated email address string.',
  },
  URL: {
    signature: 'URL',
    description: 'A validated URL string.',
  },
  JSON: {
    signature: 'JSON',
    description: 'Arbitrary JSON-compatible data.',
  },
  Any: {
    signature: 'Any',
    description: 'Any type. Use sparingly - prefer specific types.',
  },
  Void: {
    signature: 'Void',
    description: 'Indicates no return value.',
  },
  List: {
    signature: 'List<T>',
    description: 'An ordered, indexable collection of elements.',
    examples: ['tags: List<String>', 'items: List<OrderItem>'],
  },
  Map: {
    signature: 'Map<K, V>',
    description: 'A key-value collection.',
    examples: ['metadata: Map<String, Any>', 'scores: Map<UserId, Int>'],
  },
  Set: {
    signature: 'Set<T>',
    description: 'An unordered collection of unique elements.',
    examples: ['roles: Set<Role>', 'tags: Set<String>'],
  },
  Optional: {
    signature: 'Optional<T> or T?',
    description: 'A value that may be null. Shorthand: `Type?`',
    examples: ['email: String?', 'phone: Optional<String>'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Hover Provider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find token at position
 */
function findTokenAtPosition(tokens: Token[], position: Position): Token | undefined {
  for (const token of tokens) {
    if (
      token.range.start.line === position.line &&
      token.range.start.character <= position.character &&
      token.range.end.character >= position.character
    ) {
      return token;
    }
  }
  return undefined;
}

/**
 * Find symbol by name
 */
function findSymbol(symbols: Symbol[], name: string): Symbol | undefined {
  for (const symbol of symbols) {
    if (symbol.name === name) return symbol;
    if (symbol.children) {
      const found = findSymbol(symbol.children, name);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Format symbol documentation
 */
function formatSymbolDoc(symbol: Symbol): string {
  const lines: string[] = [];
  
  // Kind and name
  const kindLabel = symbol.kind.charAt(0).toUpperCase() + symbol.kind.slice(1);
  lines.push(`**${kindLabel}**: \`${symbol.name}\``);
  
  if (symbol.detail) {
    lines.push('');
    lines.push(`Type: \`${symbol.detail}\``);
  }
  
  if (symbol.documentation) {
    lines.push('');
    lines.push(symbol.documentation);
  }
  
  // Show children summary
  if (symbol.children && symbol.children.length > 0) {
    lines.push('');
    lines.push('**Members:**');
    
    for (const child of symbol.children.slice(0, 10)) {
      const detail = child.detail ? `: ${child.detail}` : '';
      lines.push(`- \`${child.name}\`${detail}`);
    }
    
    if (symbol.children.length > 10) {
      lines.push(`- ... and ${symbol.children.length - 10} more`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format keyword documentation
 */
function formatKeywordDoc(keyword: string): string {
  const doc = KEYWORD_DOCS[keyword];
  if (!doc) return '';
  
  const lines: string[] = [];
  lines.push(`**${keyword}**`);
  lines.push('');
  lines.push('```isl');
  lines.push(doc.signature);
  lines.push('```');
  lines.push('');
  lines.push(doc.description);
  
  return lines.join('\n');
}

/**
 * Format type documentation
 */
function formatTypeDoc(typeName: string): string {
  const doc = TYPE_DOCS[typeName];
  if (!doc) return '';
  
  const lines: string[] = [];
  lines.push(`**${typeName}**`);
  lines.push('');
  lines.push('```isl');
  lines.push(doc.signature);
  lines.push('```');
  lines.push('');
  lines.push(doc.description);
  
  if (doc.examples && doc.examples.length > 0) {
    lines.push('');
    lines.push('**Examples:**');
    lines.push('```isl');
    lines.push(doc.examples.join('\n'));
    lines.push('```');
  }
  
  return lines.join('\n');
}

/**
 * Get hover information for position
 */
export function getHover(
  text: string,
  position: Position,
  symbols: Symbol[]
): Hover | null {
  const tokens = tokenize(text);
  const token = findTokenAtPosition(tokens, position);
  
  if (!token) return null;
  
  let contents = '';
  
  // Check keywords
  if (token.type === 'keyword') {
    contents = formatKeywordDoc(token.value);
  }
  // Check built-in types
  else if (token.type === 'identifier' && BUILTIN_TYPES.has(token.value)) {
    contents = formatTypeDoc(token.value);
  }
  // Check symbols
  else if (token.type === 'identifier') {
    const symbol = findSymbol(symbols, token.value);
    if (symbol) {
      contents = formatSymbolDoc(symbol);
    }
  }
  
  if (!contents) return null;
  
  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: contents,
    },
    range: {
      start: token.range.start,
      end: token.range.end,
    },
  };
}
