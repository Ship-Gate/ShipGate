// ============================================================================
// ISL Hover Provider
// Provides hover information for ISL elements
// ============================================================================

import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Position, Range } from 'vscode-languageserver';
import type { ISLDocumentManager } from '../documents';

export interface HoverResult {
  contents: string;
  range?: Range;
}

// ============================================================================
// Built-in Type Documentation
// ============================================================================

const BUILTIN_DOCS: Record<string, string> = {
  String: `**String** - UTF-8 text value

A sequence of Unicode characters. Supports common string operations.

\`\`\`isl
username: String
\`\`\``,

  Int: `**Int** - Integer value

A 64-bit signed integer. Range: -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807

\`\`\`isl
count: Int
\`\`\``,

  Decimal: `**Decimal** - Arbitrary precision decimal

Use for monetary values and other precise calculations.

\`\`\`isl
price: Decimal
\`\`\``,

  Boolean: `**Boolean** - Logical value

Either \`true\` or \`false\`.

\`\`\`isl
isActive: Boolean
\`\`\``,

  UUID: `**UUID** - Universally Unique Identifier

A 128-bit identifier, typically used for entity IDs.

\`\`\`isl
id: UUID @unique
\`\`\``,

  Timestamp: `**Timestamp** - Date and time with timezone

An instant in time with nanosecond precision.

\`\`\`isl
createdAt: Timestamp
\`\`\``,

  Duration: `**Duration** - Time duration

A length of time. Can be specified in ms, seconds, minutes, hours, days.

\`\`\`isl
timeout: Duration = 30.seconds
\`\`\``,

  Date: `**Date** - Calendar date

A date without time component.

\`\`\`isl
birthDate: Date
\`\`\``,

  Time: `**Time** - Time of day

A time without date component.

\`\`\`isl
startTime: Time
\`\`\``,

  List: `**List<T>** - Ordered collection

An ordered sequence of elements of type T.

\`\`\`isl
tags: List<String>
orders: List<Order>
\`\`\``,

  Map: `**Map<K, V>** - Key-value collection

A collection of key-value pairs with unique keys.

\`\`\`isl
metadata: Map<String, String>
\`\`\``,

  Set: `**Set<T>** - Unique collection

A collection of unique elements.

\`\`\`isl
categories: Set<String>
\`\`\``,

  Optional: `**Optional<T>** - Nullable value

A value that may or may not be present. Can also use \`?\` suffix.

\`\`\`isl
middleName: Optional<String>
// or
middleName: String?
\`\`\``,
};

// ============================================================================
// Keyword Documentation
// ============================================================================

const KEYWORD_DOCS: Record<string, string> = {
  domain: `**domain** - Root container for ISL specification

A domain defines a bounded context containing entities, behaviors, types, and policies.

\`\`\`isl
domain Ecommerce {
  version: "1.0.0"
  // ... declarations
}
\`\`\``,

  entity: `**entity** - Persistent data model

Entities represent core data structures with identity, state, and behavior.

\`\`\`isl
entity User {
  id: UUID @unique
  email: Email
  status: UserStatus
  
  invariants {
    email.is_valid()
  }
}
\`\`\``,

  behavior: `**behavior** - Operation with contracts

Behaviors define operations with input/output types, preconditions, and postconditions.

\`\`\`isl
behavior CreateUser {
  input {
    email: Email
    username: String
  }
  
  output {
    success: User
    errors { ... }
  }
  
  preconditions {
    not User.exists_by_email(input.email)
  }
  
  postconditions {
    success implies {
      User.exists(result.id)
    }
  }
}
\`\`\``,

  type: `**type** - Custom type definition

Define constrained or aliased types.

\`\`\`isl
type Email = String { format: "email", max_length: 254 }
type Money = Decimal { min: 0 }
\`\`\``,

  enum: `**enum** - Enumeration type

Define a set of named values.

\`\`\`isl
enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}
\`\`\``,

  invariants: `**invariants** - Constraints that must always hold

Define business rules that must be maintained across all operations.

\`\`\`isl
invariants PositiveBalance {
  scope: global
  
  always {
    forall account: Account =>
      account.balance >= 0
  }
}
\`\`\``,

  preconditions: `**preconditions** - Conditions before operation

Conditions that must be true before the operation executes.

\`\`\`isl
preconditions {
  User.exists(input.userId)
  input.amount > 0
}
\`\`\``,

  postconditions: `**postconditions** - Conditions after operation

Conditions guaranteed to be true after successful execution.

\`\`\`isl
postconditions {
  success implies {
    result.status == Active
  }
}
\`\`\``,

  old: `**old(expr)** - Previous value

References the value of an expression before the operation. Only valid in postconditions.

\`\`\`isl
postconditions {
  success implies {
    account.balance == old(account.balance) - input.amount
  }
}
\`\`\``,

  result: `**result** - Operation output

References the return value of a successful operation. Only valid in postconditions.

\`\`\`isl
postconditions {
  success implies {
    result.id != null
    result.createdAt <= now()
  }
}
\`\`\``,

  forall: `**forall** - Universal quantifier

Asserts a condition holds for all elements in a collection.

\`\`\`isl
forall user: User => user.email.is_valid()
\`\`\``,

  exists: `**exists** - Existential quantifier

Asserts at least one element satisfies a condition.

\`\`\`isl
exists order: Order => order.status == Pending
\`\`\``,

  implies: `**implies** - Logical implication

If the left side is true, the right side must also be true.

\`\`\`isl
user.isAdmin implies user.verified
\`\`\``,

  temporal: `**temporal** - Timing constraints

Define response time and timing requirements.

\`\`\`isl
temporal {
  response within 200.ms (p50)
  response within 500.ms (p99)
  eventually within 5.minutes: audit_logged
}
\`\`\``,

  security: `**security** - Security requirements

Define access control, rate limiting, and security constraints.

\`\`\`isl
security {
  requires: authenticated
  rate_limit 100 per hour per ip_address
}
\`\`\``,

  scenario: `**scenario** - Test scenario

Define test cases using given/when/then structure.

\`\`\`isl
scenario "Successful login" {
  given {
    user = User.create(email: "test@example.com")
  }
  when {
    result = Login(email: user.email, password: "secret")
  }
  then {
    result.success
    Session.exists(result.sessionId)
  }
}
\`\`\``,

  lifecycle: `**lifecycle** - Entity state machine

Define valid state transitions for an entity.

\`\`\`isl
lifecycle {
  Created -> Active
  Active -> Suspended
  Suspended -> Active
  Active -> Archived
}
\`\`\``,
};

// ============================================================================
// Hover Provider
// ============================================================================

export class ISLHoverProvider {
  constructor(private documentManager: ISLDocumentManager) {}

  provideHover(document: TextDocument, position: Position): HoverResult | null {
    const word = this.documentManager.getWordAtPosition(document, position);
    if (!word) return null;

    const range = this.documentManager.getWordRangeAtPosition(document, position);

    // Check for built-in type
    if (BUILTIN_DOCS[word]) {
      return { contents: BUILTIN_DOCS[word], range };
    }

    // Check for keyword
    if (KEYWORD_DOCS[word]) {
      return { contents: KEYWORD_DOCS[word], range };
    }

    // Check for user-defined symbol
    const symbol = this.documentManager.findSymbol(word);
    if (symbol) {
      return { contents: this.formatSymbolHover(symbol), range };
    }

    // Check for symbol in current document with more context
    const docSymbols = this.documentManager.getSymbols(document.uri);
    const foundSymbol = this.findSymbolByName(docSymbols, word);
    if (foundSymbol) {
      return { contents: this.formatSymbolInfoHover(foundSymbol), range };
    }

    return null;
  }

  private findSymbolByName(
    symbols: Array<{ name: string; kind: string; detail?: string; documentation?: string; children?: unknown[] }>,
    name: string
  ): { name: string; kind: string; detail?: string; documentation?: string; children?: unknown[] } | undefined {
    for (const sym of symbols) {
      if (sym.name === name) return sym;
      if (sym.children) {
        const found = this.findSymbolByName(sym.children as typeof symbols, name);
        if (found) return found;
      }
    }
    return undefined;
  }

  private formatSymbolHover(symbol: { name: string; kind: string; detail?: string; type?: string }): string {
    let md = `**${symbol.kind}** \`${symbol.name}\`\n\n`;

    if (symbol.type) {
      md += `**Type:** \`${symbol.type}\`\n\n`;
    }

    if (symbol.detail) {
      md += `${symbol.detail}\n`;
    }

    return md;
  }

  private formatSymbolInfoHover(
    symbol: { name: string; kind: string; detail?: string; documentation?: string; children?: unknown[] }
  ): string {
    let md = `**${symbol.kind}** \`${symbol.name}\`\n\n`;

    if (symbol.detail) {
      md += `${symbol.detail}\n\n`;
    }

    if (symbol.documentation) {
      md += `${symbol.documentation}\n\n`;
    }

    if (symbol.children && symbol.children.length > 0) {
      const childSymbols = symbol.children as Array<{ name: string; kind: string; detail?: string }>;
      
      // Group children by kind
      const fields = childSymbols.filter(c => c.kind === 'field' || c.kind === 'input' || c.kind === 'output');
      const errors = childSymbols.filter(c => c.kind === 'error');
      const states = childSymbols.filter(c => c.kind === 'lifecycle-state');

      if (fields.length > 0) {
        md += '**Fields:**\n';
        for (const field of fields) {
          const typeInfo = field.detail ? `: ${field.detail}` : '';
          md += `- \`${field.name}\`${typeInfo}\n`;
        }
        md += '\n';
      }

      if (errors.length > 0) {
        md += '**Errors:**\n';
        for (const error of errors) {
          md += `- \`${error.name}\`${error.detail ? ` - ${error.detail}` : ''}\n`;
        }
        md += '\n';
      }

      if (states.length > 0) {
        md += '**Lifecycle States:**\n';
        md += states.map(s => `\`${s.name}\``).join(' → ') + '\n';
      }
    }

    return md;
  }
}
