import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";

export const metadata = {
  title: "Types",
  description: "Type system in ISL including primitives, collections, and custom types.",
};

export default function TypesPage() {
  return (
    <div>
      <h1>Types</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        ISL&apos;s type system for describing data shapes and constraints.
      </p>

      <h2 id="primitive-types">Primitive Types</h2>
      
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Type</th>
              <th className="text-left py-2 px-3">Description</th>
              <th className="text-left py-2 px-3">Example Values</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>String</code></td>
              <td className="py-2 px-3">Text values</td>
              <td className="py-2 px-3"><code>&quot;hello&quot;</code>, <code>&quot;&quot;</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>Number</code></td>
              <td className="py-2 px-3">Numeric values (integer or float)</td>
              <td className="py-2 px-3"><code>42</code>, <code>3.14</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>Int</code></td>
              <td className="py-2 px-3">Integer values only</td>
              <td className="py-2 px-3"><code>1</code>, <code>-100</code>, <code>0</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>Boolean</code></td>
              <td className="py-2 px-3">True/false values</td>
              <td className="py-2 px-3"><code>true</code>, <code>false</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>UUID</code></td>
              <td className="py-2 px-3">Universally unique identifier</td>
              <td className="py-2 px-3"><code>&quot;550e8400-e29b...&quot;</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>Timestamp</code></td>
              <td className="py-2 px-3">Date and time value</td>
              <td className="py-2 px-3"><code>2024-01-15T10:30:00Z</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>Date</code></td>
              <td className="py-2 px-3">Date only (no time)</td>
              <td className="py-2 px-3"><code>2024-01-15</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>Decimal</code></td>
              <td className="py-2 px-3">Precise decimal numbers</td>
              <td className="py-2 px-3"><code>99.99</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="semantic-types">Semantic Types</h2>
      <p>
        ISL provides semantic types that carry additional meaning and validation:
      </p>

      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Type</th>
              <th className="text-left py-2 px-3">Base Type</th>
              <th className="text-left py-2 px-3">Validation</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>Email</code></td>
              <td className="py-2 px-3">String</td>
              <td className="py-2 px-3">Valid email format</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>URL</code></td>
              <td className="py-2 px-3">String</td>
              <td className="py-2 px-3">Valid URL format</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>Password</code></td>
              <td className="py-2 px-3">String</td>
              <td className="py-2 px-3">Marked sensitive, not logged</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>JSON</code></td>
              <td className="py-2 px-3">Any</td>
              <td className="py-2 px-3">Valid JSON structure</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="collection-types">Collection Types</h2>
      <CodeBlock
        code={`// Array - ordered list of items
items: Array<Product>
tags: Array<String>

// Set - unique items only
categories: Set<String>

// Map - key-value pairs
settings: Map<String, Any>
userRoles: Map<UUID, Array<Role>>`}
        language="isl"
      />

      <h2 id="optional-types">Optional Types</h2>
      <p>
        Use <code>?</code> to mark a type as optional (can be null/undefined):
      </p>

      <CodeBlock
        code={`intent UpdateUser {
  // Optional fields
  middleName: String?
  phoneNumber: String?
  
  pre {
    // Check if optional value exists
    phoneNumber != null implies phoneNumber.isValidPhone()
  }
}`}
        language="isl"
      />

      <h2 id="custom-types">Custom Type Definitions</h2>
      <p>
        Define custom types with constraints:
      </p>

      <CodeBlock
        code={`// Type alias with constraints
type PositiveInt = Int where value > 0
type Percentage = Number where value >= 0 && value <= 100
type NonEmptyString = String where length > 0

// Struct-like types
type Address {
  street: String
  city: String
  zipCode: String
  country: String
}

// Enum types
type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled"
type Priority = "low" | "medium" | "high" | "critical"`}
        language="isl"
        showLineNumbers
      />

      <h2 id="type-constraints">Type Constraints</h2>
      <p>
        Add constraints to types using the <code>where</code> clause:
      </p>

      <CodeBlock
        code={`// String constraints
type Username = String where {
  length >= 3
  length <= 20
  matches(/^[a-z0-9_]+$/)
}

// Number constraints  
type Age = Int where {
  value >= 0
  value <= 150
}

// Array constraints
type CartItems = Array<Product> where {
  length > 0
  length <= 100
}`}
        language="isl"
      />

      <Callout type="tip">
        Custom types with constraints are validated at runtime. This ensures
        data integrity throughout your application.
      </Callout>

      <h2 id="type-modifiers">Type Modifiers</h2>
      <p>
        Modifiers provide additional metadata about fields:
      </p>

      <CodeBlock
        code={`type User {
  id: UUID [immutable, unique]     // Cannot change, must be unique
  email: Email [unique, indexed]    // Unique, database indexed
  password: Password [sensitive]    // Not logged/exposed
  role: Role [default: "user"]      // Default value
  createdAt: Timestamp [immutable]  // Set once
  updatedAt: Timestamp              // Can change
}`}
        language="isl"
      />

      <h3>Available Modifiers</h3>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Modifier</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>immutable</code></td>
              <td className="py-2 px-3">Cannot be changed after creation</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>unique</code></td>
              <td className="py-2 px-3">Must be unique across all instances</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>indexed</code></td>
              <td className="py-2 px-3">Hint for database indexing</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>sensitive</code></td>
              <td className="py-2 px-3">Should not be logged or exposed</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>optional</code></td>
              <td className="py-2 px-3">Field can be omitted</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>default: value</code></td>
              <td className="py-2 px-3">Default value if not provided</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="generic-types">Generic Types</h2>
      <CodeBlock
        code={`// Generic result type
type Result<T, E> = {
  success: T?
  error: E?
}

// Generic pagination
type Page<T> {
  items: Array<T>
  total: Int
  page: Int
  pageSize: Int
  hasNext: Boolean
}`}
        language="isl"
      />
    </div>
  );
}
