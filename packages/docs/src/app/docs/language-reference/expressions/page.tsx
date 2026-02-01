import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "Expressions",
  description: "Operators, precedence, and expression syntax in ISL.",
};

export default function ExpressionsPage() {
  return (
    <div>
      <h1>Expressions</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        ISL expressions for conditions, comparisons, and calculations.
      </p>

      <h2 id="operators">Operators</h2>

      <h3>Comparison Operators</h3>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Operator</th>
              <th className="text-left py-2 px-3">Description</th>
              <th className="text-left py-2 px-3">Example</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>==</code></td>
              <td className="py-2 px-3">Equal to</td>
              <td className="py-2 px-3"><code>a == b</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>!=</code></td>
              <td className="py-2 px-3">Not equal to</td>
              <td className="py-2 px-3"><code>a != b</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>&lt;</code></td>
              <td className="py-2 px-3">Less than</td>
              <td className="py-2 px-3"><code>a &lt; b</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>&gt;</code></td>
              <td className="py-2 px-3">Greater than</td>
              <td className="py-2 px-3"><code>a &gt; b</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>&lt;=</code></td>
              <td className="py-2 px-3">Less than or equal</td>
              <td className="py-2 px-3"><code>a &lt;= b</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>&gt;=</code></td>
              <td className="py-2 px-3">Greater than or equal</td>
              <td className="py-2 px-3"><code>a &gt;= b</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Logical Operators</h3>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Operator</th>
              <th className="text-left py-2 px-3">Description</th>
              <th className="text-left py-2 px-3">Example</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>&&</code></td>
              <td className="py-2 px-3">Logical AND</td>
              <td className="py-2 px-3"><code>a && b</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>||</code></td>
              <td className="py-2 px-3">Logical OR</td>
              <td className="py-2 px-3"><code>a || b</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>!</code></td>
              <td className="py-2 px-3">Logical NOT</td>
              <td className="py-2 px-3"><code>!a</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>implies</code></td>
              <td className="py-2 px-3">Logical implication</td>
              <td className="py-2 px-3"><code>a implies b</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Arithmetic Operators</h3>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Operator</th>
              <th className="text-left py-2 px-3">Description</th>
              <th className="text-left py-2 px-3">Example</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>+</code></td>
              <td className="py-2 px-3">Addition</td>
              <td className="py-2 px-3"><code>a + b</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>-</code></td>
              <td className="py-2 px-3">Subtraction</td>
              <td className="py-2 px-3"><code>a - b</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>*</code></td>
              <td className="py-2 px-3">Multiplication</td>
              <td className="py-2 px-3"><code>a * b</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>/</code></td>
              <td className="py-2 px-3">Division</td>
              <td className="py-2 px-3"><code>a / b</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>%</code></td>
              <td className="py-2 px-3">Modulo</td>
              <td className="py-2 px-3"><code>a % b</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="precedence">Operator Precedence</h2>
      <p>
        From highest to lowest precedence:
      </p>

      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Precedence</th>
              <th className="text-left py-2 px-3">Operators</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3">1 (highest)</td>
              <td className="py-2 px-3"><code>!</code>, unary <code>-</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3">2</td>
              <td className="py-2 px-3"><code>*</code>, <code>/</code>, <code>%</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3">3</td>
              <td className="py-2 px-3"><code>+</code>, <code>-</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3">4</td>
              <td className="py-2 px-3"><code>&lt;</code>, <code>&gt;</code>, <code>&lt;=</code>, <code>&gt;=</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3">5</td>
              <td className="py-2 px-3"><code>==</code>, <code>!=</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3">6</td>
              <td className="py-2 px-3"><code>&&</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3">7</td>
              <td className="py-2 px-3"><code>||</code></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3">8 (lowest)</td>
              <td className="py-2 px-3"><code>implies</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="member-access">Member Access</h2>
      <CodeBlock
        code={`// Dot notation for property access
user.email
order.items.length
account.balance

// Method calls
user.hasRole("admin")
items.filter(i => i.active)
string.toLowerCase()

// Chained access
order.customer.address.city`}
        language="isl"
      />

      <h2 id="collection-expressions">Collection Expressions</h2>
      <CodeBlock
        code={`// Array access
items[0]
items[items.length - 1]

// Collection methods
items.length
items.contains(element)
items.isEmpty()
items.filter(predicate)
items.map(transform)
items.reduce(initial, reducer)
items.sum(selector)
items.any(predicate)
items.all(predicate)`}
        language="isl"
      />

      <h2 id="string-expressions">String Expressions</h2>
      <CodeBlock
        code={`// String methods
name.length
name.isEmpty()
name.contains("substring")
name.startsWith("prefix")
name.endsWith("suffix")
name.toLowerCase()
name.toUpperCase()
name.trim()

// String interpolation
\`Hello, \${user.name}!\``}
        language="isl"
      />

      <h2 id="null-handling">Null Handling</h2>
      <CodeBlock
        code={`// Null checks
value != null
value == null

// Optional chaining
user?.address?.city

// Default values
value ?? defaultValue`}
        language="isl"
      />

      <h2 id="examples">Expression Examples</h2>
      <CodeBlock
        code={`intent ValidateOrder {
  pre {
    // Compound conditions
    items.length > 0 && items.length <= 100
    
    // Collection predicates
    items.all(i => i.quantity > 0)
    items.any(i => i.discounted)
    
    // Arithmetic in conditions
    total == items.sum(i => i.price * i.quantity)
    
    // String conditions
    customer.email.contains("@")
    
    // Implication
    isPremium implies discount >= 0.1
  }
}`}
        language="isl"
        showLineNumbers
      />
    </div>
  );
}
