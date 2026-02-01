import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Language Reference - ISL Documentation",
  description: "Complete guide to ISL syntax and features.",
};

export default function LanguagePage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Language Reference</h1>

        <p className="lead text-xl text-muted-foreground">
          A complete guide to the Intent Specification Language syntax, 
          constructs, and features.
        </p>

        <h2>Domain Structure</h2>

        <p>
          Every ISL file defines one or more domains. A domain is a bounded 
          context containing related types, entities, and behaviors:
        </p>

        <CodeBlock
          code={`domain DomainName {
  version: "1.0.0"
  
  # Type definitions
  type CustomType = BaseType { constraints }
  
  # Enumerations
  enum Status { VALUE1, VALUE2 }
  
  # Entities with invariants
  entity Entity { ... }
  
  # Behaviors with contracts
  behavior Operation { ... }
  
  # Global invariants
  invariants GlobalRules { ... }
}`}
          language="isl"
        />

        <h2>Core Concepts</h2>

        <div className="not-prose grid md:grid-cols-2 gap-4 my-8">
          <Link
            href="/docs/language/types"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
              Types
            </h3>
            <p className="text-sm text-muted-foreground">
              Primitive types, custom types, and type constraints
            </p>
          </Link>
          <Link
            href="/docs/language/entities"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
              Entities
            </h3>
            <p className="text-sm text-muted-foreground">
              Domain objects with fields, invariants, and lifecycles
            </p>
          </Link>
          <Link
            href="/docs/language/behaviors"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
              Behaviors
            </h3>
            <p className="text-sm text-muted-foreground">
              Operations with preconditions, postconditions, and errors
            </p>
          </Link>
          <Link
            href="/docs/language/scenarios"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
              Scenarios
            </h3>
            <p className="text-sm text-muted-foreground">
              Test scenarios with given/when/then structure
            </p>
          </Link>
        </div>

        <h2>Comments</h2>

        <p>
          ISL supports single-line comments starting with <code>#</code>:
        </p>

        <CodeBlock
          code={`# This is a comment
domain Example {
  # Entity for user data
  entity User {
    id: UUID  # Unique identifier
  }
}`}
          language="isl"
        />

        <h2>Identifiers</h2>

        <p>
          Identifiers (names for types, entities, behaviors, etc.) must:
        </p>

        <ul>
          <li>Start with a letter (a-z, A-Z)</li>
          <li>Contain only letters, digits, and underscores</li>
          <li>Be unique within their scope</li>
        </ul>

        <CodeBlock
          code={`# Valid identifiers
type UserEmail = String
entity OrderItem { ... }
behavior CreatePayment { ... }

# Convention: PascalCase for types/entities/behaviors
# Convention: snake_case for fields and parameters`}
          language="isl"
        />

        <h2>Modifiers</h2>

        <p>
          Fields can have modifiers in square brackets:
        </p>

        <CodeBlock
          code={`entity User {
  id: UUID [immutable, unique]     # Cannot change, must be unique
  email: String [unique, indexed]  # Must be unique, optimized for lookups
  password: String [secret]        # Should never appear in logs/responses
  role: Role [default: USER]       # Has a default value
  bio: String?                     # Optional (nullable)
}`}
          language="isl"
        />

        <h3>Available Modifiers</h3>

        <table className="my-6">
          <thead>
            <tr>
              <th>Modifier</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>immutable</code></td>
              <td>Cannot be changed after creation</td>
            </tr>
            <tr>
              <td><code>unique</code></td>
              <td>Must be unique across all instances</td>
            </tr>
            <tr>
              <td><code>indexed</code></td>
              <td>Should be indexed for fast lookups</td>
            </tr>
            <tr>
              <td><code>secret</code></td>
              <td>Sensitive data, never expose</td>
            </tr>
            <tr>
              <td><code>sensitive</code></td>
              <td>Should not appear in logs</td>
            </tr>
            <tr>
              <td><code>default: value</code></td>
              <td>Default value if not provided</td>
            </tr>
          </tbody>
        </table>

        <h2>Expressions</h2>

        <p>
          ISL supports expressions in preconditions, postconditions, and invariants:
        </p>

        <CodeBlock
          code={`# Comparison operators
amount > 0
status == ACTIVE
name != null

# Logical operators
condition1 and condition2
condition1 or condition2
not condition

# Implication
success implies result != null

# Property access
user.email.is_valid
order.items.length > 0

# Temporal references
old(user.balance)  # Value before the operation
now()              # Current timestamp`}
          language="isl"
        />

        <h2>Next Steps</h2>

        <div className="not-prose">
          <Link
            href="/docs/language/types"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                Types
              </div>
              <div className="text-sm text-muted-foreground">
                Learn about the ISL type system
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
