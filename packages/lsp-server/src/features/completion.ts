// ============================================================================
// ISL Completion Provider
// Context-aware completion suggestions
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Position } from 'vscode-languageserver';
import type { ISLDocumentManager } from '../documents.js';
import type { ISLCompletionInfo, ContextType } from '@intentos/lsp-core';

// ============================================================================
// ISL Keywords by Context
// ============================================================================

const TOP_LEVEL_KEYWORDS = [
  { label: 'domain', doc: 'Define a new domain' },
];

const DOMAIN_KEYWORDS = [
  { label: 'entity', doc: 'Define a persistent entity' },
  { label: 'behavior', doc: 'Define a behavior/operation' },
  { label: 'type', doc: 'Define a custom type' },
  { label: 'enum', doc: 'Define an enumeration' },
  { label: 'invariants', doc: 'Define global invariants' },
  { label: 'policy', doc: 'Define a policy' },
  { label: 'view', doc: 'Define a view/projection' },
  { label: 'scenarios', doc: 'Define test scenarios' },
  { label: 'chaos', doc: 'Define chaos tests' },
  { label: 'version', doc: 'Domain version' },
  { label: 'owner', doc: 'Domain owner' },
  { label: 'imports', doc: 'Import from other domains' },
];

const ENTITY_KEYWORDS = [
  { label: 'invariants', doc: 'Entity invariants' },
  { label: 'lifecycle', doc: 'Entity lifecycle states' },
];

const BEHAVIOR_KEYWORDS = [
  { label: 'description', doc: 'Behavior description' },
  { label: 'actors', doc: 'Authorized actors' },
  { label: 'input', doc: 'Input parameters' },
  { label: 'output', doc: 'Output specification' },
  { label: 'preconditions', doc: 'Preconditions' },
  { label: 'postconditions', doc: 'Postconditions' },
  { label: 'invariants', doc: 'Behavior invariants' },
  { label: 'temporal', doc: 'Temporal constraints' },
  { label: 'security', doc: 'Security requirements' },
  { label: 'compliance', doc: 'Compliance requirements' },
  { label: 'observability', doc: 'Observability settings' },
];

const OUTPUT_KEYWORDS = [
  { label: 'success', doc: 'Success return type' },
  { label: 'errors', doc: 'Error cases' },
];

const ERROR_KEYWORDS = [
  { label: 'when', doc: 'Error condition description' },
  { label: 'retriable', doc: 'Whether error is retriable' },
  { label: 'retry_after', doc: 'Retry delay' },
  { label: 'returns', doc: 'Error return type' },
];

const TEMPORAL_KEYWORDS = [
  { label: 'response', doc: 'Response time constraint' },
  { label: 'eventually', doc: 'Eventually happens' },
  { label: 'always', doc: 'Always true' },
  { label: 'never', doc: 'Never happens' },
  { label: 'within', doc: 'Within time constraint' },
  { label: 'immediately', doc: 'Immediate effect' },
];

const SECURITY_KEYWORDS = [
  { label: 'requires', doc: 'Required permission/capability' },
  { label: 'rate_limit', doc: 'Rate limiting' },
  { label: 'brute_force_protection', doc: 'Brute force protection' },
];

const EXPRESSION_KEYWORDS = [
  { label: 'forall', doc: 'Universal quantifier' },
  { label: 'exists', doc: 'Existential quantifier' },
  { label: 'implies', doc: 'Logical implication' },
  { label: 'and', doc: 'Logical and' },
  { label: 'or', doc: 'Logical or' },
  { label: 'not', doc: 'Logical negation' },
  { label: 'true', doc: 'Boolean true' },
  { label: 'false', doc: 'Boolean false' },
  { label: 'null', doc: 'Null value' },
];

const POSTCONDITION_KEYWORDS = [
  { label: 'old', doc: 'Reference to pre-state value' },
  { label: 'result', doc: 'Reference to operation result' },
  { label: 'success', doc: 'Success postcondition block' },
  { label: 'failure', doc: 'Failure postcondition block' },
  ...EXPRESSION_KEYWORDS,
];

const SCENARIO_KEYWORDS = [
  { label: 'scenario', doc: 'Define a test scenario' },
  { label: 'given', doc: 'Setup state' },
  { label: 'when', doc: 'Action to test' },
  { label: 'then', doc: 'Expected outcome' },
];

// ============================================================================
// Built-in Types
// ============================================================================

const BUILTIN_TYPES: ISLCompletionInfo[] = [
  { label: 'String', kind: 'type', detail: 'UTF-8 text value', documentation: 'A sequence of Unicode characters' },
  { label: 'Int', kind: 'type', detail: 'Integer value', documentation: '64-bit signed integer' },
  { label: 'Decimal', kind: 'type', detail: 'Decimal number', documentation: 'Arbitrary precision decimal' },
  { label: 'Boolean', kind: 'type', detail: 'Boolean value', documentation: 'true or false' },
  { label: 'UUID', kind: 'type', detail: 'Universally unique identifier', documentation: '128-bit identifier' },
  { label: 'Timestamp', kind: 'type', detail: 'Date and time with timezone', documentation: 'Instant in time' },
  { label: 'Duration', kind: 'type', detail: 'Time duration', documentation: 'Length of time (ms, seconds, minutes, hours, days)' },
  { label: 'Date', kind: 'type', detail: 'Calendar date', documentation: 'Date without time' },
  { label: 'Time', kind: 'type', detail: 'Time of day', documentation: 'Time without date' },
  { label: 'List', kind: 'type', detail: 'Ordered collection', documentation: 'List<T> - ordered sequence of elements', insertText: 'List<${1:T}>', insertTextFormat: 'snippet' },
  { label: 'Map', kind: 'type', detail: 'Key-value collection', documentation: 'Map<K, V> - key-value pairs', insertText: 'Map<${1:K}, ${2:V}>', insertTextFormat: 'snippet' },
  { label: 'Set', kind: 'type', detail: 'Unique collection', documentation: 'Set<T> - unique elements', insertText: 'Set<${1:T}>', insertTextFormat: 'snippet' },
  { label: 'Optional', kind: 'type', detail: 'Nullable value', documentation: 'Optional<T> - may be null', insertText: 'Optional<${1:T}>', insertTextFormat: 'snippet' },
];

// ============================================================================
// Built-in Functions
// ============================================================================

const BUILTIN_FUNCTIONS: ISLCompletionInfo[] = [
  { label: 'old', kind: 'function', detail: 'Previous value', documentation: 'Reference to value before operation', insertText: 'old(${1:expr})', insertTextFormat: 'snippet' },
  { label: 'len', kind: 'function', detail: 'Length of collection', documentation: 'Returns the number of elements', insertText: 'len(${1:collection})', insertTextFormat: 'snippet' },
  { label: 'sum', kind: 'function', detail: 'Sum of collection', documentation: 'Sum all numeric elements', insertText: 'sum(${1:collection})', insertTextFormat: 'snippet' },
  { label: 'count', kind: 'function', detail: 'Count elements', documentation: 'Count matching elements', insertText: 'count(${1:collection}, ${2:predicate})', insertTextFormat: 'snippet' },
  { label: 'filter', kind: 'function', detail: 'Filter collection', documentation: 'Filter elements by predicate', insertText: 'filter(${1:collection}, ${2:predicate})', insertTextFormat: 'snippet' },
  { label: 'all', kind: 'function', detail: 'All match', documentation: 'Check if all elements match predicate', insertText: 'all(${1:collection}, ${2:item} => ${3:predicate})', insertTextFormat: 'snippet' },
  { label: 'any', kind: 'function', detail: 'Any match', documentation: 'Check if any element matches predicate', insertText: 'any(${1:collection}, ${2:item} => ${3:predicate})', insertTextFormat: 'snippet' },
  { label: 'none', kind: 'function', detail: 'None match', documentation: 'Check if no elements match predicate', insertText: 'none(${1:collection}, ${2:item} => ${3:predicate})', insertTextFormat: 'snippet' },
  { label: 'now', kind: 'function', detail: 'Current timestamp', documentation: 'Returns the current timestamp', insertText: 'now()' },
  { label: 'exists', kind: 'function', detail: 'Entity exists', documentation: 'Check if entity exists', insertText: 'exists(${1:id})', insertTextFormat: 'snippet' },
  { label: 'lookup', kind: 'function', detail: 'Lookup entity', documentation: 'Find entity by ID or field', insertText: 'lookup(${1:id})', insertTextFormat: 'snippet' },
];

// ============================================================================
// Snippets
// ============================================================================

const DOMAIN_SNIPPET: ISLCompletionInfo = {
  label: 'domain',
  kind: 'snippet',
  detail: 'Create a new domain',
  insertText: `domain \${1:Name} {
  version: "\${2:1.0.0}"

  $0
}`,
  insertTextFormat: 'snippet',
  preselect: true,
};

const ENTITY_SNIPPET: ISLCompletionInfo = {
  label: 'entity',
  kind: 'snippet',
  detail: 'Create a new entity',
  insertText: `entity \${1:Name} {
  id: UUID [immutable, unique]
  \${2:field}: \${3:String}

  invariants {
    $0
  }
}`,
  insertTextFormat: 'snippet',
};

const BEHAVIOR_SNIPPET: ISLCompletionInfo = {
  label: 'behavior',
  kind: 'snippet',
  detail: 'Create a new behavior',
  insertText: `behavior \${1:Name} {
  description: "\${2:Description}"

  input {
    \${3:param}: \${4:String}
  }

  output {
    success: \${5:Boolean}

    errors {
      \${6:ERROR_NAME} {
        when: "\${7:Error description}"
        retriable: \${8|true,false|}
      }
    }
  }

  preconditions {
    \${9:input.param != null}
  }

  postconditions {
    success implies {
      $0
    }
  }
}`,
  insertTextFormat: 'snippet',
};

const TYPE_SNIPPET: ISLCompletionInfo = {
  label: 'type',
  kind: 'snippet',
  detail: 'Create a custom type',
  insertText: `type \${1:Name} = \${2:String} {
  \${3:constraint}: \${4:value}
}`,
  insertTextFormat: 'snippet',
};

const ENUM_SNIPPET: ISLCompletionInfo = {
  label: 'enum',
  kind: 'snippet',
  detail: 'Create an enumeration',
  insertText: `enum \${1:Name} {
  \${2:VARIANT1}
  \${3:VARIANT2}
  $0
}`,
  insertTextFormat: 'snippet',
};

const INVARIANT_SNIPPET: ISLCompletionInfo = {
  label: 'invariants',
  kind: 'snippet',
  detail: 'Create an invariant block',
  insertText: `invariants \${1:Name} {
  description: "\${2:Description}"
  scope: \${3|global,transaction|}

  always {
    $0
  }
}`,
  insertTextFormat: 'snippet',
};

const SCENARIO_SNIPPET: ISLCompletionInfo = {
  label: 'scenario',
  kind: 'snippet',
  detail: 'Create a test scenario',
  insertText: `scenario "\${1:Test scenario}" {
  given {
    \${2:setup}
  }

  when {
    \${3:action}
  }

  then {
    $0
  }
}`,
  insertTextFormat: 'snippet',
};

// ============================================================================
// Completion Provider
// ============================================================================

export class ISLCompletionProvider {
  constructor(private documentManager: ISLDocumentManager) {}

  provideCompletions(document: TextDocument, position: Position): ISLCompletionInfo[] {
    const context = this.documentManager.getCompletionContext(document, position);
    const items: ISLCompletionInfo[] = [];

    // Get context-appropriate completions
    switch (context.contextType) {
      case 'top-level':
        items.push(DOMAIN_SNIPPET);
        items.push(...TOP_LEVEL_KEYWORDS.map(k => ({ 
          label: k.label, 
          kind: 'keyword' as const, 
          detail: k.doc 
        })));
        break;

      case 'domain':
        items.push(ENTITY_SNIPPET);
        items.push(BEHAVIOR_SNIPPET);
        items.push(TYPE_SNIPPET);
        items.push(ENUM_SNIPPET);
        items.push(INVARIANT_SNIPPET);
        items.push(...DOMAIN_KEYWORDS.map(k => ({ 
          label: k.label, 
          kind: 'keyword' as const, 
          detail: k.doc 
        })));
        break;

      case 'entity':
      case 'entity-field':
        items.push(...ENTITY_KEYWORDS.map(k => ({ 
          label: k.label, 
          kind: 'keyword' as const, 
          detail: k.doc 
        })));
        break;

      case 'behavior':
        items.push(...BEHAVIOR_KEYWORDS.map(k => ({ 
          label: k.label, 
          kind: 'keyword' as const, 
          detail: k.doc 
        })));
        break;

      case 'behavior-input':
      case 'behavior-output':
        // Type completions for field declarations
        break;

      case 'behavior-pre':
        items.push(...EXPRESSION_KEYWORDS.map(k => ({ 
          label: k.label, 
          kind: 'keyword' as const, 
          detail: k.doc 
        })));
        items.push(...BUILTIN_FUNCTIONS.filter(f => f.label !== 'old' && f.label !== 'result'));
        break;

      case 'behavior-post':
        items.push(...POSTCONDITION_KEYWORDS.map(k => ({ 
          label: k.label, 
          kind: 'keyword' as const, 
          detail: k.doc 
        })));
        items.push(...BUILTIN_FUNCTIONS);
        break;

      case 'behavior-temporal':
        items.push(...TEMPORAL_KEYWORDS.map(k => ({ 
          label: k.label, 
          kind: 'keyword' as const, 
          detail: k.doc 
        })));
        break;

      case 'behavior-security':
        items.push(...SECURITY_KEYWORDS.map(k => ({ 
          label: k.label, 
          kind: 'keyword' as const, 
          detail: k.doc 
        })));
        break;

      case 'scenario':
        items.push(SCENARIO_SNIPPET);
        items.push(...SCENARIO_KEYWORDS.map(k => ({ 
          label: k.label, 
          kind: 'keyword' as const, 
          detail: k.doc 
        })));
        break;

      case 'type-annotation':
        items.push(...BUILTIN_TYPES);
        items.push(...this.getCustomTypeCompletions());
        items.push(...this.getEntityCompletions());
        break;

      case 'expression':
      case 'invariant':
      case 'policy':
        items.push(...EXPRESSION_KEYWORDS.map(k => ({ 
          label: k.label, 
          kind: 'keyword' as const, 
          detail: k.doc 
        })));
        items.push(...BUILTIN_FUNCTIONS);
        break;

      default:
        // Default: mix of keywords and types
        items.push(...EXPRESSION_KEYWORDS.map(k => ({ 
          label: k.label, 
          kind: 'keyword' as const, 
          detail: k.doc 
        })));
    }

    // Add trigger-specific completions
    if (context.triggerCharacter === ':') {
      items.push(...BUILTIN_TYPES);
      items.push(...this.getCustomTypeCompletions());
      items.push(...this.getEntityCompletions());
    }

    if (context.triggerCharacter === '.') {
      items.push(...this.getMemberCompletions(context));
    }

    if (context.triggerCharacter === '@') {
      items.push(...this.getAnnotationCompletions());
    }

    // Add entity/behavior references if in expression context
    if (['expression', 'behavior-pre', 'behavior-post', 'invariant'].includes(context.contextType)) {
      items.push(...this.getEntityCompletions());
      items.push(...this.getBehaviorCompletions());
    }

    // Filter by prefix
    if (context.prefix) {
      const prefix = context.prefix.toLowerCase();
      return items.filter(item => 
        item.label.toLowerCase().startsWith(prefix) ||
        item.filterText?.toLowerCase().startsWith(prefix)
      );
    }

    return items;
  }

  private getCustomTypeCompletions(): ISLCompletionInfo[] {
    const types = this.documentManager.getTypeNames();
    return types.map(name => ({
      label: name,
      kind: 'type' as const,
      detail: 'Custom type',
    }));
  }

  private getEntityCompletions(): ISLCompletionInfo[] {
    const entities = this.documentManager.getEntityNames();
    return entities.map(name => ({
      label: name,
      kind: 'entity' as const,
      detail: 'Entity',
    }));
  }

  private getBehaviorCompletions(): ISLCompletionInfo[] {
    const behaviors = this.documentManager.getBehaviorNames();
    return behaviors.map(name => ({
      label: name,
      kind: 'behavior' as const,
      detail: 'Behavior',
    }));
  }

  private getMemberCompletions(context: { prefix: string; parentSymbol?: string }): ISLCompletionInfo[] {
    const items: ISLCompletionInfo[] = [];

    // Common entity methods
    items.push(
      { label: 'lookup', kind: 'function', detail: 'Find by ID', insertText: 'lookup(${1:id})', insertTextFormat: 'snippet' },
      { label: 'exists', kind: 'function', detail: 'Check existence', insertText: 'exists(${1:id})', insertTextFormat: 'snippet' },
      { label: 'all', kind: 'function', detail: 'Get all entities' },
      { label: 'count', kind: 'function', detail: 'Count entities' },
      { label: 'filter', kind: 'function', detail: 'Filter entities', insertText: 'filter(${1:predicate})', insertTextFormat: 'snippet' },
    );

    // Duration units
    items.push(
      { label: 'ms', kind: 'property', detail: 'Milliseconds' },
      { label: 'seconds', kind: 'property', detail: 'Seconds' },
      { label: 'minutes', kind: 'property', detail: 'Minutes' },
      { label: 'hours', kind: 'property', detail: 'Hours' },
      { label: 'days', kind: 'property', detail: 'Days' },
    );

    // String methods
    items.push(
      { label: 'length', kind: 'property', detail: 'String length' },
      { label: 'is_valid', kind: 'function', detail: 'Validate format' },
      { label: 'is_empty', kind: 'function', detail: 'Check if empty' },
    );

    // If we know the parent, add its fields
    if (context.parentSymbol) {
      const fields = this.documentManager.getFields(context.parentSymbol);
      for (const field of fields) {
        items.push({
          label: field.name,
          kind: 'field',
          detail: field.detail || field.type,
        });
      }
    }

    return items;
  }

  private getAnnotationCompletions(): ISLCompletionInfo[] {
    return [
      { label: 'unique', kind: 'keyword', detail: 'Field must be unique' },
      { label: 'immutable', kind: 'keyword', detail: 'Field cannot be changed' },
      { label: 'indexed', kind: 'keyword', detail: 'Field is indexed' },
      { label: 'sensitive', kind: 'keyword', detail: 'Contains sensitive data' },
      { label: 'secret', kind: 'keyword', detail: 'Contains secret data' },
      { label: 'pii', kind: 'keyword', detail: 'Personally identifiable information' },
      { label: 'computed', kind: 'keyword', detail: 'Derived from other fields' },
      { label: 'deprecated', kind: 'keyword', detail: 'Mark as deprecated' },
      { label: 'default', kind: 'keyword', detail: 'Default value', insertText: 'default: ${1:value}', insertTextFormat: 'snippet' },
    ];
  }
}
