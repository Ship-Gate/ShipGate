"use strict";
// ============================================================================
// ISL Hover Provider
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISLHoverProvider = void 0;
// Built-in type documentation
const BUILTIN_DOCS = {
    String: `
**String** - UTF-8 text value

A sequence of Unicode characters. Supports common string operations.

\`\`\`isl
username: String
\`\`\`
`,
    Int: `
**Int** - Integer value

A 64-bit signed integer. Range: -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807

\`\`\`isl
count: Int
\`\`\`
`,
    Boolean: `
**Boolean** - Logical value

Either \`true\` or \`false\`.

\`\`\`isl
isActive: Boolean
\`\`\`
`,
    UUID: `
**UUID** - Universally Unique Identifier

A 128-bit identifier, typically used for entity IDs.

\`\`\`isl
id: UUID @unique
\`\`\`
`,
    Timestamp: `
**Timestamp** - Date and time with timezone

An instant in time with nanosecond precision.

\`\`\`isl
createdAt: Timestamp
\`\`\`
`,
    Decimal: `
**Decimal** - Arbitrary precision decimal

Use for monetary values and other precise calculations.

\`\`\`isl
price: Decimal
\`\`\`
`,
    Duration: `
**Duration** - Time duration

A length of time. Can be specified in ms, seconds, minutes, hours, days.

\`\`\`isl
timeout: Duration = 30.seconds
\`\`\`
`,
    List: `
**List<T>** - Ordered collection

An ordered sequence of elements of type T.

\`\`\`isl
tags: List<String>
orders: List<Order>
\`\`\`
`,
    Map: `
**Map<K, V>** - Key-value collection

A collection of key-value pairs with unique keys.

\`\`\`isl
metadata: Map<String, String>
\`\`\`
`,
    Optional: `
**Optional<T>** - Nullable value

A value that may or may not be present.

\`\`\`isl
middleName: Optional<String>
\`\`\`
`,
};
// Keyword documentation
const KEYWORD_DOCS = {
    domain: `
**domain** - Root container for ISL specification

A domain defines a bounded context containing entities, behaviors, types, and policies.

\`\`\`isl
domain Ecommerce {
  version: "1.0.0"
  // ... declarations
}
\`\`\`
`,
    entity: `
**entity** - Persistent data model

Entities represent the core data structures with identity, state, and behavior.

\`\`\`isl
entity User {
  id: UUID @unique
  email: Email
  status: UserStatus
  
  invariant {
    email.isValid()
  }
}
\`\`\`
`,
    behavior: `
**behavior** - Operation with contracts

Behaviors define operations with input/output types, preconditions, and postconditions.

\`\`\`isl
behavior CreateUser {
  input {
    email: Email
    username: String
  }
  
  output {
    success: User
    error DuplicateEmail
  }
  
  pre {
    not User.exists(email: input.email)
  }
  
  post {
    User.exists(id: result.id)
  }
}
\`\`\`
`,
    invariant: `
**invariant** - Constraint that must always hold

Invariants define business rules that must be maintained across all operations.

\`\`\`isl
invariant PositiveBalance {
  scope: global
  
  forall account: Account =>
    account.balance >= 0
}
\`\`\`
`,
    pre: `
**pre** - Precondition

Conditions that must be true before the operation executes.

\`\`\`isl
pre {
  User.exists(id: input.userId)
  input.amount > 0
}
\`\`\`
`,
    post: `
**post** - Postcondition

Conditions guaranteed to be true after successful execution.

\`\`\`isl
post {
  result.status == Active
  User.lookup(result.id).email == input.email
}
\`\`\`
`,
    old: `
**old(expr)** - Previous value

References the value of an expression before the operation.

\`\`\`isl
post {
  account.balance == old(account.balance) - input.amount
}
\`\`\`
`,
    result: `
**result** - Operation output

References the return value of a successful operation.

\`\`\`isl
post {
  result.id != null
  result.createdAt <= now()
}
\`\`\`
`,
    forall: `
**forall** - Universal quantifier

Asserts a condition holds for all elements in a collection.

\`\`\`isl
forall user: User => user.email.isValid()
\`\`\`
`,
    exists: `
**exists** - Existential quantifier

Asserts at least one element satisfies a condition.

\`\`\`isl
exists order: Order => order.status == Pending
\`\`\`
`,
    implies: `
**implies** - Logical implication

If the left side is true, the right side must also be true.

\`\`\`isl
user.isAdmin implies user.verified
\`\`\`
`,
};
class ISLHoverProvider {
    documentManager;
    constructor(documentManager) {
        this.documentManager = documentManager;
    }
    provideHover(document, position) {
        const word = this.documentManager.getWordAtPosition(document, position);
        if (!word)
            return null;
        // Check for built-in type
        if (BUILTIN_DOCS[word]) {
            return { contents: BUILTIN_DOCS[word] };
        }
        // Check for keyword
        if (KEYWORD_DOCS[word]) {
            return { contents: KEYWORD_DOCS[word] };
        }
        // Check for user-defined symbol
        const symbol = this.documentManager.findSymbol(word);
        if (symbol) {
            return { contents: this.formatSymbolHover(symbol) };
        }
        return null;
    }
    formatSymbolHover(symbol) {
        let md = `**${symbol.kind}** \`${symbol.name}\`\n\n`;
        if (symbol.detail) {
            md += `Type: \`${symbol.detail}\`\n\n`;
        }
        if (symbol.children && symbol.children.length > 0) {
            md += '**Fields:**\n';
            for (const child of symbol.children) {
                const typeInfo = child.detail ? `: ${child.detail}` : '';
                md += `- \`${child.name}\`${typeInfo}\n`;
            }
        }
        return md;
    }
}
exports.ISLHoverProvider = ISLHoverProvider;
//# sourceMappingURL=hover.js.map