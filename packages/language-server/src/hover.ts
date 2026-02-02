/**
 * ISL Hover Information
 */

import {
  Hover,
  Position,
  MarkupKind,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ISLAnalyzer } from './analyzer';

/**
 * Get hover information at position
 */
export function getHover(
  document: TextDocument,
  position: Position,
  analyzer: ISLAnalyzer
): Hover | null {
  const text = document.getText();
  const word = getWordAtPosition(text, document.offsetAt(position));

  if (!word) return null;

  // Check if it's a keyword
  const keywordHover = getKeywordHover(word);
  if (keywordHover) return keywordHover;

  // Check if it's a built-in type
  const typeHover = getBuiltinTypeHover(word);
  if (typeHover) return typeHover;

  // Check if it's an annotation
  const annotationHover = getAnnotationHover(word);
  if (annotationHover) return annotationHover;

  // Check symbols
  const symbol = analyzer.findDefinition(word);
  if (symbol) {
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: formatSymbolHover(symbol),
      },
    };
  }

  return null;
}

function getWordAtPosition(text: string, offset: number): string | null {
  // Find word boundaries
  let start = offset;
  let end = offset;

  while (start > 0) {
    const char = text[start - 1];
    if (!char || !/\w/.test(char)) break;
    start--;
  }

  while (end < text.length) {
    const char = text[end];
    if (!char || !/\w/.test(char)) break;
    end++;
  }

  if (start === end) return null;

  return text.substring(start, end);
}

function getKeywordHover(word: string): Hover | null {
  const keywordDocs: Record<string, string> = {
    domain: `
## domain

Defines a new ISL domain - a logical grouping of related types, entities, and behaviors.

\`\`\`isl
domain MyDomain {
  version: "1.0.0"
  
  // Types, entities, behaviors go here
}
\`\`\`
`,
    type: `
## type

Defines a new type with optional constraints.

\`\`\`isl
type Email = String {
  pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
  max_length: 254
}
\`\`\`
`,
    entity: `
## entity

Defines a domain entity with fields and invariants.

\`\`\`isl
entity User {
  id: UUID [primary_key]
  email: Email [unique]
  name: String
  
  invariants {
    email_verified or status != ACTIVE
  }
}
\`\`\`
`,
    behavior: `
## behavior

Defines a behavior (operation) with inputs, outputs, and contracts.

\`\`\`isl
behavior CreateUser {
  input {
    email: Email
    name: String
  }
  
  output {
    success: { user: User }
    errors { EMAIL_EXISTS }
  }
  
  preconditions {
    not User.exists(email: input.email)
  }
}
\`\`\`
`,
    preconditions: `
## preconditions

Conditions that must be true before a behavior executes.

\`\`\`isl
preconditions {
  input.amount > 0
  Account.balance >= input.amount
}
\`\`\`
`,
    postconditions: `
## postconditions

Conditions that must be true after a behavior executes.

\`\`\`isl
postconditions {
  success implies {
    Account.balance == old(Account.balance) - input.amount
  }
}
\`\`\`
`,
    temporal: `
## temporal

Defines timing constraints for behaviors.

\`\`\`isl
temporal {
  - within 100.ms (p99): response time
  - eventually within 30.s: event delivered
}
\`\`\`
`,
    invariants: `
## invariants

Conditions that must always be true.

\`\`\`isl
invariants SecurityRules {
  scope: global
  
  always {
    - passwords never stored in plain text
    - PII encrypted at rest
  }
}
\`\`\`
`,
    scenarios: `
## scenarios

Define test scenarios for behaviors.

\`\`\`isl
scenarios CreateUser {
  scenario "successful creation" {
    when {
      result = CreateUser(email: "test@example.com")
    }
    then {
      result is success
      User.exists(email: "test@example.com")
    }
  }
}
\`\`\`
`,
  };

  const doc = keywordDocs[word.toLowerCase()];
  if (!doc) return null;

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: doc.trim(),
    },
  };
}

function getBuiltinTypeHover(word: string): Hover | null {
  const typeDocs: Record<string, string> = {
    String: 'A sequence of Unicode characters.',
    Int: 'A 64-bit signed integer.',
    Float: 'A 64-bit floating-point number.',
    Boolean: 'A true or false value.',
    UUID: 'A universally unique identifier (128-bit).',
    Timestamp: 'A point in time with nanosecond precision.',
    Duration: 'A length of time (e.g., `100.ms`, `5.seconds`).',
    Date: 'A calendar date (year, month, day).',
    Time: 'A time of day (hour, minute, second).',
    DateTime: 'A combined date and time.',
    Decimal: 'An arbitrary-precision decimal number.',
    Bytes: 'A sequence of bytes (binary data).',
    Any: 'Any type (use sparingly).',
    List: 'An ordered collection of elements. `List<T>`',
    Set: 'An unordered collection of unique elements. `Set<T>`',
    Map: 'A key-value mapping. `Map<K, V>`',
    Result: 'A success or error result. `Result<T, E>`',
    Option: 'An optional value. `Option<T>`',
    Stream: 'A lazy sequence of values. `Stream<T>`',
  };

  const doc = typeDocs[word];
  if (!doc) return null;

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: `**${word}** - Built-in type\n\n${doc}`,
    },
  };
}

function getAnnotationHover(word: string): Hover | null {
  const annotationDocs: Record<string, string> = {
    pii: 'Marks field as containing Personally Identifiable Information. Subject to privacy regulations.',
    secret: 'Marks field as containing sensitive data. Never logged or exposed.',
    unique: 'Field value must be unique across all instances.',
    immutable: 'Field cannot be modified after creation.',
    primary_key: 'Field is the primary identifier for the entity.',
    foreign_key: 'Field references another entity.',
    index: 'Create an index on this field for faster queries.',
    never_log: 'Never include this field in logs.',
    deprecated: 'This field/type/behavior is deprecated.',
  };

  const doc = annotationDocs[word];
  if (!doc) return null;

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: `**[${word}]** - Annotation\n\n${doc}`,
    },
  };
}

function formatSymbolHover(symbol: {
  name: string;
  kind: string;
  detail?: string;
  documentation?: string;
}): string {
  let hover = `**${symbol.name}** - ${symbol.kind}`;

  if (symbol.detail) {
    hover += `\n\n${symbol.detail}`;
  }

  if (symbol.documentation) {
    hover += `\n\n${symbol.documentation}`;
  }

  return hover;
}
