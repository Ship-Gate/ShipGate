/**
 * ISL Completions
 * 
 * Auto-completion suggestions for ISL.
 */

import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
} from 'vscode-languageserver';
import { KEYWORDS, BUILTIN_TYPES, type Symbol, type Position } from './parser.js';

// ─────────────────────────────────────────────────────────────────────────────
// Completion Context
// ─────────────────────────────────────────────────────────────────────────────

export type CompletionContext = 
  | 'top-level'
  | 'domain'
  | 'entity'
  | 'behavior'
  | 'type-annotation'
  | 'input'
  | 'output'
  | 'preconditions'
  | 'postconditions'
  | 'scenarios'
  | 'unknown';

export function getCompletionContext(
  text: string,
  position: Position,
  symbols: Symbol[]
): CompletionContext {
  const lines = text.split('\n');
  const linesBefore = lines.slice(0, position.line + 1);
  const currentLine = linesBefore[linesBefore.length - 1] ?? '';
  const textBefore = linesBefore.join('\n').slice(0, -currentLine.length + position.character);

  // Count braces to determine nesting
  let braceStack: string[] = [];
  let inBlock = '';

  for (const char of textBefore) {
    if (char === '{') {
      braceStack.push(inBlock);
    } else if (char === '}') {
      braceStack.pop();
    }
  }

  // Check what keyword preceded last open brace
  const keywords = textBefore.match(/\b(domain|entity|behavior|type|enum|input|output|preconditions|postconditions|scenarios?|invariants|lifecycle)\s*{?/g);
  
  if (!keywords || keywords.length === 0) {
    return 'top-level';
  }

  const lastKeyword = keywords[keywords.length - 1].trim().replace(/\s*{$/, '');

  switch (lastKeyword) {
    case 'domain':
      return 'domain';
    case 'entity':
      return 'entity';
    case 'behavior':
      return 'behavior';
    case 'input':
      return 'input';
    case 'output':
      return 'output';
    case 'preconditions':
      return 'preconditions';
    case 'postconditions':
      return 'postconditions';
    case 'scenario':
    case 'scenarios':
      return 'scenarios';
    default:
      return 'unknown';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Completion Items
// ─────────────────────────────────────────────────────────────────────────────

function createCompletion(
  label: string,
  kind: CompletionItemKind,
  detail?: string,
  documentation?: string,
  insertText?: string,
  insertTextFormat?: InsertTextFormat
): CompletionItem {
  return {
    label,
    kind,
    detail,
    documentation: documentation ? {
      kind: MarkupKind.Markdown,
      value: documentation,
    } : undefined,
    insertText,
    insertTextFormat,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyword Completions
// ─────────────────────────────────────────────────────────────────────────────

const TOP_LEVEL_COMPLETIONS: CompletionItem[] = [
  createCompletion(
    'domain',
    CompletionItemKind.Module,
    'Define a domain',
    'Creates a new ISL domain that contains entities, behaviors, and types.',
    'domain ${1:DomainName} {\n  version: "${2:1.0.0}"\n  \n  $0\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'import',
    CompletionItemKind.Reference,
    'Import from another domain',
    'Import entities or behaviors from another ISL file.',
    'import { ${1:Entity} } from "${2:./path}"\n',
    InsertTextFormat.Snippet
  ),
];

const DOMAIN_COMPLETIONS: CompletionItem[] = [
  createCompletion(
    'entity',
    CompletionItemKind.Class,
    'Define an entity',
    'Entities represent domain objects with identity and state.',
    'entity ${1:EntityName} {\n  id: ${2:ID} [immutable, unique]\n  $0\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'behavior',
    CompletionItemKind.Function,
    'Define a behavior',
    'Behaviors define operations that can be performed in the domain.',
    'behavior ${1:BehaviorName} {\n  description: "${2:Description}"\n  \n  input {\n    $3\n  }\n  \n  output {\n    success: ${4:Result}\n    errors {\n      $5\n    }\n  }\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'type',
    CompletionItemKind.TypeParameter,
    'Define a type alias',
    'Create a named type alias with optional constraints.',
    'type ${1:TypeName} = ${2:BaseType} {\n  $0\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'enum',
    CompletionItemKind.Enum,
    'Define an enumeration',
    'Enumerations define a set of named values.',
    'enum ${1:EnumName} {\n  ${2:VALUE1}\n  ${3:VALUE2}\n  $0\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'version',
    CompletionItemKind.Property,
    'Domain version',
    'Specify the semantic version of this domain.',
    'version: "${1:1.0.0}"',
    InsertTextFormat.Snippet
  ),
];

const ENTITY_COMPLETIONS: CompletionItem[] = [
  createCompletion(
    'invariants',
    CompletionItemKind.Property,
    'Entity invariants',
    'Conditions that must always be true for this entity.',
    'invariants {\n  ${1:condition} as "${2:description}"\n  $0\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'lifecycle',
    CompletionItemKind.Property,
    'Entity lifecycle',
    'Define state transitions for the entity.',
    'lifecycle {\n  ${1:STATE1} -> ${2:STATE2}\n  $0\n}',
    InsertTextFormat.Snippet
  ),
];

const BEHAVIOR_COMPLETIONS: CompletionItem[] = [
  createCompletion(
    'input',
    CompletionItemKind.Property,
    'Behavior input',
    'Define input parameters for this behavior.',
    'input {\n  ${1:param}: ${2:Type}\n  $0\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'output',
    CompletionItemKind.Property,
    'Behavior output',
    'Define output structure for this behavior.',
    'output {\n  success: ${1:Result}\n  errors {\n    ${2:ERROR_CODE} { when: "${3:condition}" }\n  }\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'preconditions',
    CompletionItemKind.Property,
    'Behavior preconditions',
    'Conditions that must be true before executing.',
    'preconditions {\n  ${1:condition} as "${2:description}"\n  $0\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'postconditions',
    CompletionItemKind.Property,
    'Behavior postconditions',
    'Conditions that must be true after executing.',
    'postconditions {\n  success implies {\n    ${1:condition}\n  }\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'temporal',
    CompletionItemKind.Property,
    'Temporal constraints',
    'Define timing and performance requirements.',
    'temporal {\n  response within ${1:100}.ms (p99)\n  $0\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'description',
    CompletionItemKind.Property,
    'Behavior description',
    'Human-readable description of the behavior.',
    'description: "${1:Description}"',
    InsertTextFormat.Snippet
  ),
];

const SCENARIO_COMPLETIONS: CompletionItem[] = [
  createCompletion(
    'scenario',
    CompletionItemKind.Event,
    'Define a scenario',
    'A test scenario for this behavior.',
    'scenario "${1:scenario name}" {\n  given {\n    $2\n  }\n  \n  when {\n    result = ${3:BehaviorName}($4)\n  }\n  \n  then {\n    result is success\n    $0\n  }\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'given',
    CompletionItemKind.Keyword,
    'Scenario preconditions',
    'Set up the initial state for the scenario.',
    'given {\n  $0\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'when',
    CompletionItemKind.Keyword,
    'Scenario action',
    'Execute the behavior being tested.',
    'when {\n  result = ${1:Behavior}($2)\n}',
    InsertTextFormat.Snippet
  ),
  createCompletion(
    'then',
    CompletionItemKind.Keyword,
    'Scenario assertions',
    'Assert expected outcomes.',
    'then {\n  result is ${1:success}\n  $0\n}',
    InsertTextFormat.Snippet
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// Type Completions
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_COMPLETIONS: CompletionItem[] = Array.from(BUILTIN_TYPES).map(type => 
  createCompletion(
    type,
    CompletionItemKind.TypeParameter,
    `Built-in type: ${type}`,
    getTypeDocumentation(type)
  )
);

function getTypeDocumentation(type: string): string {
  const docs: Record<string, string> = {
    String: 'A text value. Can include patterns and constraints.',
    Int: 'An integer number.',
    Float: 'A floating-point number.',
    Boolean: 'A true/false value.',
    UUID: 'A universally unique identifier.',
    ID: 'A unique identifier (alias for UUID).',
    Timestamp: 'A point in time with timezone.',
    Duration: 'A length of time.',
    Date: 'A calendar date without time.',
    Time: 'A time of day without date.',
    DateTime: 'A combined date and time.',
    Email: 'A validated email address.',
    URL: 'A validated URL.',
    JSON: 'Arbitrary JSON data.',
    Any: 'Any type (use sparingly).',
    Void: 'No return value.',
    List: 'An ordered collection. Usage: `List<Type>`',
    Map: 'A key-value collection. Usage: `Map<Key, Value>`',
    Set: 'A unique collection. Usage: `Set<Type>`',
    Optional: 'A nullable value. Shorthand: `Type?`',
  };
  return docs[type] ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Completion Provider
// ─────────────────────────────────────────────────────────────────────────────

export function getCompletions(
  text: string,
  position: Position,
  symbols: Symbol[]
): CompletionItem[] {
  const context = getCompletionContext(text, position, symbols);
  const items: CompletionItem[] = [];

  // Get current line and check if we're after a colon (type annotation)
  const lines = text.split('\n');
  const currentLine = lines[position.line] ?? '';
  const beforeCursor = currentLine.slice(0, position.character);
  
  if (beforeCursor.includes(':') && !beforeCursor.includes('{')) {
    // Type annotation context
    items.push(...TYPE_COMPLETIONS);
    
    // Add custom types from symbols
    for (const symbol of symbols) {
      if (symbol.kind === 'domain' && symbol.children) {
        for (const child of symbol.children) {
          if (child.kind === 'entity' || child.kind === 'type' || child.kind === 'enum') {
            items.push(createCompletion(
              child.name,
              child.kind === 'entity' ? CompletionItemKind.Class :
              child.kind === 'enum' ? CompletionItemKind.Enum :
              CompletionItemKind.TypeParameter,
              `Custom ${child.kind}: ${child.name}`
            ));
          }
        }
      }
    }
    return items;
  }

  // Context-specific completions
  switch (context) {
    case 'top-level':
      items.push(...TOP_LEVEL_COMPLETIONS);
      break;
    case 'domain':
      items.push(...DOMAIN_COMPLETIONS);
      break;
    case 'entity':
      items.push(...ENTITY_COMPLETIONS);
      items.push(...TYPE_COMPLETIONS);
      break;
    case 'behavior':
      items.push(...BEHAVIOR_COMPLETIONS);
      break;
    case 'input':
    case 'output':
      items.push(...TYPE_COMPLETIONS);
      break;
    case 'scenarios':
      items.push(...SCENARIO_COMPLETIONS);
      break;
    case 'preconditions':
    case 'postconditions':
      // Add logical operators
      items.push(
        createCompletion('and', CompletionItemKind.Operator, 'Logical AND'),
        createCompletion('or', CompletionItemKind.Operator, 'Logical OR'),
        createCompletion('not', CompletionItemKind.Operator, 'Logical NOT'),
        createCompletion('implies', CompletionItemKind.Operator, 'Implication'),
        createCompletion('forall', CompletionItemKind.Keyword, 'Universal quantifier'),
        createCompletion('exists', CompletionItemKind.Keyword, 'Existential quantifier'),
      );
      break;
    default:
      items.push(...DOMAIN_COMPLETIONS);
  }

  return items;
}
