import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "Core Types - ISL Standard Library",
  description: "Essential types for common data patterns.",
};

export default function CorePage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Core Types</h1>

        <p className="lead text-xl text-muted-foreground">
          Essential types for common data patterns including email, phone, 
          money, and more.
        </p>

        <h2>Import</h2>

        <CodeBlock
          code={`import { Email, Phone, URL, Money, Percentage } from "@stdlib/core"`}
          language="isl"
        />

        <h2>String Types</h2>

        <h3>Email</h3>

        <CodeBlock
          code={`# Definition
type Email = String {
  format: "email"
  max_length: 254
}

# Usage
entity User {
  email: Email [unique]
}`}
          language="isl"
        />

        <h3>Phone</h3>

        <CodeBlock
          code={`# Definition  
type Phone = String {
  pattern: "^\\+[1-9]\\d{1,14}$"
  format: "E.164"
}

# Usage
entity Contact {
  phone: Phone?
  mobile: Phone?
}`}
          language="isl"
        />

        <h3>URL</h3>

        <CodeBlock
          code={`# Definition
type URL = String {
  format: "uri"
  max_length: 2048
}

# Usage
entity Website {
  homepage: URL
  callback_url: URL?
}`}
          language="isl"
        />

        <h3>Slug</h3>

        <CodeBlock
          code={`# Definition
type Slug = String {
  pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$"
  min_length: 1
  max_length: 100
}

# Usage
entity Post {
  slug: Slug [unique]
}`}
          language="isl"
        />

        <h2>Numeric Types</h2>

        <h3>Money</h3>

        <CodeBlock
          code={`# Definition
type Money = Decimal {
  precision: 2
  min: 0
}

# Usage
entity Order {
  subtotal: Money
  tax: Money
  total: Money
  
  invariants {
    total == subtotal + tax
  }
}`}
          language="isl"
        />

        <h3>Percentage</h3>

        <CodeBlock
          code={`# Definition
type Percentage = Decimal {
  min: 0
  max: 100
  precision: 2
}

# Usage
entity Discount {
  percentage: Percentage
  
  invariants {
    percentage <= 100
  }
}`}
          language="isl"
        />

        <h3>PositiveInt</h3>

        <CodeBlock
          code={`# Definition
type PositiveInt = Int {
  min: 1
}

# Usage
entity OrderItem {
  quantity: PositiveInt
}`}
          language="isl"
        />

        <h3>NonNegativeInt</h3>

        <CodeBlock
          code={`# Definition
type NonNegativeInt = Int {
  min: 0
}

# Usage
entity Product {
  stock: NonNegativeInt
}`}
          language="isl"
        />

        <h2>ID Types</h2>

        <h3>EntityId</h3>

        <CodeBlock
          code={`# Definition
type EntityId = UUID {
  immutable: true
  unique: true
}

# Usage
entity User {
  id: EntityId
}`}
          language="isl"
        />

        <h3>ExternalId</h3>

        <CodeBlock
          code={`# Definition
type ExternalId = String {
  min_length: 1
  max_length: 255
}

# Usage - for third-party system IDs
entity Payment {
  stripe_id: ExternalId [unique]
}`}
          language="isl"
        />

        <h2>Address Type</h2>

        <CodeBlock
          code={`# Definition
type Address = {
  line1: String { max_length: 100 }
  line2: String { max_length: 100 }?
  city: String { max_length: 50 }
  state: String { max_length: 50 }?
  postal_code: String { max_length: 20 }
  country: CountryCode
}

type CountryCode = String {
  pattern: "^[A-Z]{2}$"
  format: "ISO 3166-1 alpha-2"
}

# Usage
entity Customer {
  billing_address: Address
  shipping_address: Address?
}`}
          language="isl"
        />

        <h2>Date/Time Types</h2>

        <h3>FutureTimestamp</h3>

        <CodeBlock
          code={`# Definition
type FutureTimestamp = Timestamp {
  constraint: value > now()
}

# Usage
entity Reminder {
  remind_at: FutureTimestamp
}`}
          language="isl"
        />

        <h3>DateRange</h3>

        <CodeBlock
          code={`# Definition
type DateRange = {
  start: Date
  end: Date
  
  invariants {
    end >= start
  }
}

# Usage
entity Booking {
  dates: DateRange
}`}
          language="isl"
        />

        <h2>All Core Types</h2>

        <table className="my-6">
          <thead>
            <tr>
              <th>Type</th>
              <th>Base</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>Email</code></td>
              <td>String</td>
              <td>Valid email address</td>
            </tr>
            <tr>
              <td><code>Phone</code></td>
              <td>String</td>
              <td>E.164 phone number</td>
            </tr>
            <tr>
              <td><code>URL</code></td>
              <td>String</td>
              <td>Valid URL</td>
            </tr>
            <tr>
              <td><code>Slug</code></td>
              <td>String</td>
              <td>URL-safe identifier</td>
            </tr>
            <tr>
              <td><code>Money</code></td>
              <td>Decimal</td>
              <td>Monetary amount (2 decimal places)</td>
            </tr>
            <tr>
              <td><code>Percentage</code></td>
              <td>Decimal</td>
              <td>0-100 percentage</td>
            </tr>
            <tr>
              <td><code>PositiveInt</code></td>
              <td>Int</td>
              <td>Integer &gt;= 1</td>
            </tr>
            <tr>
              <td><code>NonNegativeInt</code></td>
              <td>Int</td>
              <td>Integer &gt;= 0</td>
            </tr>
            <tr>
              <td><code>EntityId</code></td>
              <td>UUID</td>
              <td>Immutable unique ID</td>
            </tr>
            <tr>
              <td><code>Address</code></td>
              <td>Object</td>
              <td>Postal address</td>
            </tr>
            <tr>
              <td><code>CountryCode</code></td>
              <td>String</td>
              <td>ISO country code</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
