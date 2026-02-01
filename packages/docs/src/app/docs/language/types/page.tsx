import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Types - ISL Documentation",
  description: "ISL type system: primitives, custom types, and constraints.",
};

export default function TypesPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Types</h1>

        <p className="lead text-xl text-muted-foreground">
          ISL has a rich type system with built-in primitives, custom type 
          definitions, and powerful constraints.
        </p>

        <h2>Primitive Types</h2>

        <p>ISL includes these built-in primitive types:</p>

        <table className="my-6">
          <thead>
            <tr>
              <th>Type</th>
              <th>Description</th>
              <th>Example</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>String</code></td>
              <td>Text value</td>
              <td><code>&quot;hello&quot;</code></td>
            </tr>
            <tr>
              <td><code>Int</code></td>
              <td>Integer number</td>
              <td><code>42</code></td>
            </tr>
            <tr>
              <td><code>Decimal</code></td>
              <td>Decimal number</td>
              <td><code>19.99</code></td>
            </tr>
            <tr>
              <td><code>Boolean</code></td>
              <td>True or false</td>
              <td><code>true</code></td>
            </tr>
            <tr>
              <td><code>UUID</code></td>
              <td>Unique identifier</td>
              <td><code>&quot;550e8400-e29b-41d4-a716-446655440000&quot;</code></td>
            </tr>
            <tr>
              <td><code>Timestamp</code></td>
              <td>Date and time</td>
              <td><code>2024-01-15T10:30:00Z</code></td>
            </tr>
            <tr>
              <td><code>Date</code></td>
              <td>Date only</td>
              <td><code>2024-01-15</code></td>
            </tr>
            <tr>
              <td><code>Time</code></td>
              <td>Time only</td>
              <td><code>10:30:00</code></td>
            </tr>
            <tr>
              <td><code>Duration</code></td>
              <td>Time duration</td>
              <td><code>5m</code>, <code>2h</code>, <code>1d</code></td>
            </tr>
          </tbody>
        </table>

        <h2>Custom Types</h2>

        <p>
          Define custom types with constraints to enforce validation rules:
        </p>

        <CodeBlock
          code={`# String with constraints
type Email = String { format: "email", max_length: 254 }
type Password = String { min_length: 8, max_length: 128 }
type Username = String { pattern: "^[a-zA-Z0-9_]+$", min_length: 3 }

# Numeric constraints
type Age = Int { min: 0, max: 150 }
type Price = Decimal { min: 0, precision: 2 }
type Percentage = Decimal { min: 0, max: 100 }

# UUID with modifiers
type UserId = UUID { immutable: true, unique: true }
type OrderId = UUID { immutable: true }`}
          language="isl"
        />

        <h3>String Constraints</h3>

        <table className="my-6">
          <thead>
            <tr>
              <th>Constraint</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>min_length</code></td>
              <td>Minimum number of characters</td>
            </tr>
            <tr>
              <td><code>max_length</code></td>
              <td>Maximum number of characters</td>
            </tr>
            <tr>
              <td><code>pattern</code></td>
              <td>Regular expression pattern</td>
            </tr>
            <tr>
              <td><code>format</code></td>
              <td>Built-in format: <code>email</code>, <code>url</code>, <code>phone</code></td>
            </tr>
          </tbody>
        </table>

        <h3>Numeric Constraints</h3>

        <table className="my-6">
          <thead>
            <tr>
              <th>Constraint</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>min</code></td>
              <td>Minimum value (inclusive)</td>
            </tr>
            <tr>
              <td><code>max</code></td>
              <td>Maximum value (inclusive)</td>
            </tr>
            <tr>
              <td><code>precision</code></td>
              <td>Decimal places (for Decimal type)</td>
            </tr>
            <tr>
              <td><code>positive</code></td>
              <td>Must be greater than zero</td>
            </tr>
          </tbody>
        </table>

        <h2>Enumerations</h2>

        <p>
          Define a fixed set of allowed values:
        </p>

        <CodeBlock
          code={`enum UserStatus {
  PENDING
  ACTIVE
  SUSPENDED
  DELETED
}

enum PaymentMethod {
  CREDIT_CARD
  DEBIT_CARD
  BANK_TRANSFER
  CRYPTO
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}`}
          language="isl"
        />

        <h2>Collection Types</h2>

        <p>
          ISL supports list and map collections:
        </p>

        <CodeBlock
          code={`# List of items
type Tags = List<String>
type OrderItems = List<OrderItem>

# Map/dictionary
type Metadata = Map<String, String>
type Scores = Map<UserId, Int>

# With constraints
type RecentOrders = List<Order> { max_length: 100 }`}
          language="isl"
        />

        <h2>Optional Types</h2>

        <p>
          Use <code>?</code> to make a type optional (nullable):
        </p>

        <CodeBlock
          code={`entity User {
  id: UUID
  email: String
  phone: String?          # Optional
  bio: String?            # Optional
  avatar_url: String?     # Optional
  deleted_at: Timestamp?  # Null if not deleted
}`}
          language="isl"
        />

        <h2>Object Types</h2>

        <p>
          Define inline object types for structured data:
        </p>

        <CodeBlock
          code={`behavior GetUser {
  output {
    success: {
      user: User
      permissions: List<String>
      metadata: {
        last_login: Timestamp?
        login_count: Int
      }
    }
  }
}`}
          language="isl"
        />

        <h2>Type Aliases</h2>

        <p>
          Create aliases for complex types:
        </p>

        <CodeBlock
          code={`# Simple alias
type Money = Decimal { min: 0, precision: 2 }

# Reuse in multiple places
entity Order {
  subtotal: Money
  tax: Money
  total: Money
}

entity Invoice {
  amount_due: Money
  amount_paid: Money
}`}
          language="isl"
        />

        <h2>Type Composition</h2>

        <p>
          Types can reference other types:
        </p>

        <CodeBlock
          code={`type UserId = UUID { immutable: true }
type OrderId = UUID { immutable: true }

entity Order {
  id: OrderId
  user_id: UserId      # References UserId type
  items: List<OrderItem>
  
  # Inline constraints still work
  notes: String { max_length: 500 }?
}`}
          language="isl"
        />

        <h2>Next Steps</h2>

        <div className="not-prose">
          <Link
            href="/docs/language/entities"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                Entities
              </div>
              <div className="text-sm text-muted-foreground">
                Learn about domain objects and their properties
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
