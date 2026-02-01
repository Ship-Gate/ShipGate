import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "Built-in Functions",
  description: "Reference for ISL built-in functions and utilities.",
};

export default function BuiltinsPage() {
  return (
    <div>
      <h1>Built-in Functions</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Reference for ISL&apos;s built-in functions and utilities.
      </p>

      <h2 id="temporal">Temporal Functions</h2>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Function</th>
              <th className="text-left py-2 px-3">Returns</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>now()</code></td>
              <td className="py-2 px-3">Timestamp</td>
              <td className="py-2 px-3">Current timestamp</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>today()</code></td>
              <td className="py-2 px-3">Date</td>
              <td className="py-2 px-3">Current date</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>duration(start, end)</code></td>
              <td className="py-2 px-3">Duration</td>
              <td className="py-2 px-3">Time between two timestamps</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>addDays(date, n)</code></td>
              <td className="py-2 px-3">Date</td>
              <td className="py-2 px-3">Add n days to date</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>addHours(ts, n)</code></td>
              <td className="py-2 px-3">Timestamp</td>
              <td className="py-2 px-3">Add n hours to timestamp</td>
            </tr>
          </tbody>
        </table>
      </div>

      <CodeBlock
        code={`post {
  result.createdAt <= now()
  result.expiresAt == addDays(now(), 30)
  duration(start, end) < 5s
}`}
        language="isl"
      />

      <h2 id="string">String Functions</h2>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Function</th>
              <th className="text-left py-2 px-3">Returns</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>s.length</code></td>
              <td className="py-2 px-3">Int</td>
              <td className="py-2 px-3">String length</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>s.isEmpty()</code></td>
              <td className="py-2 px-3">Boolean</td>
              <td className="py-2 px-3">True if empty string</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>s.contains(sub)</code></td>
              <td className="py-2 px-3">Boolean</td>
              <td className="py-2 px-3">Check substring exists</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>s.startsWith(prefix)</code></td>
              <td className="py-2 px-3">Boolean</td>
              <td className="py-2 px-3">Check prefix</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>s.endsWith(suffix)</code></td>
              <td className="py-2 px-3">Boolean</td>
              <td className="py-2 px-3">Check suffix</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>s.matches(regex)</code></td>
              <td className="py-2 px-3">Boolean</td>
              <td className="py-2 px-3">Regex match</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>s.toLowerCase()</code></td>
              <td className="py-2 px-3">String</td>
              <td className="py-2 px-3">Convert to lowercase</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>s.toUpperCase()</code></td>
              <td className="py-2 px-3">String</td>
              <td className="py-2 px-3">Convert to uppercase</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>s.trim()</code></td>
              <td className="py-2 px-3">String</td>
              <td className="py-2 px-3">Remove whitespace</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="collection">Collection Functions</h2>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Function</th>
              <th className="text-left py-2 px-3">Returns</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>arr.length</code></td>
              <td className="py-2 px-3">Int</td>
              <td className="py-2 px-3">Number of elements</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>arr.isEmpty()</code></td>
              <td className="py-2 px-3">Boolean</td>
              <td className="py-2 px-3">True if empty</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>arr.contains(x)</code></td>
              <td className="py-2 px-3">Boolean</td>
              <td className="py-2 px-3">Check element exists</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>arr.first()</code></td>
              <td className="py-2 px-3">T?</td>
              <td className="py-2 px-3">First element</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>arr.last()</code></td>
              <td className="py-2 px-3">T?</td>
              <td className="py-2 px-3">Last element</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>arr.filter(pred)</code></td>
              <td className="py-2 px-3">Array&lt;T&gt;</td>
              <td className="py-2 px-3">Filter by predicate</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>arr.map(fn)</code></td>
              <td className="py-2 px-3">Array&lt;U&gt;</td>
              <td className="py-2 px-3">Transform elements</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>arr.any(pred)</code></td>
              <td className="py-2 px-3">Boolean</td>
              <td className="py-2 px-3">Any element matches</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>arr.all(pred)</code></td>
              <td className="py-2 px-3">Boolean</td>
              <td className="py-2 px-3">All elements match</td>
            </tr>
          </tbody>
        </table>
      </div>

      <CodeBlock
        code={`post {
  items.length > 0
  items.filter(i => i.active).length == activeCount
  items.all(i => i.valid)
  items.any(i => i.featured)
}`}
        language="isl"
      />

      <h2 id="numeric">Numeric Functions</h2>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Function</th>
              <th className="text-left py-2 px-3">Returns</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>abs(n)</code></td>
              <td className="py-2 px-3">Number</td>
              <td className="py-2 px-3">Absolute value</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>min(a, b)</code></td>
              <td className="py-2 px-3">Number</td>
              <td className="py-2 px-3">Minimum of two values</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>max(a, b)</code></td>
              <td className="py-2 px-3">Number</td>
              <td className="py-2 px-3">Maximum of two values</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>round(n, places)</code></td>
              <td className="py-2 px-3">Number</td>
              <td className="py-2 px-3">Round to decimal places</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>floor(n)</code></td>
              <td className="py-2 px-3">Int</td>
              <td className="py-2 px-3">Round down</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>ceil(n)</code></td>
              <td className="py-2 px-3">Int</td>
              <td className="py-2 px-3">Round up</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="aggregation">Aggregation Functions</h2>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Function</th>
              <th className="text-left py-2 px-3">Returns</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>sum(arr)</code></td>
              <td className="py-2 px-3">Number</td>
              <td className="py-2 px-3">Sum of numeric array</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>sum(arr, selector)</code></td>
              <td className="py-2 px-3">Number</td>
              <td className="py-2 px-3">Sum with selector</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>avg(arr)</code></td>
              <td className="py-2 px-3">Number</td>
              <td className="py-2 px-3">Average of array</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>count(arr)</code></td>
              <td className="py-2 px-3">Int</td>
              <td className="py-2 px-3">Count elements</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>count(arr, pred)</code></td>
              <td className="py-2 px-3">Int</td>
              <td className="py-2 px-3">Count matching</td>
            </tr>
          </tbody>
        </table>
      </div>

      <CodeBlock
        code={`post {
  result.total == sum(items, i => i.price * i.quantity)
  result.averagePrice == avg(items.map(i => i.price))
  result.itemCount == count(items)
  result.activeCount == count(items, i => i.active)
}`}
        language="isl"
      />

      <h2 id="validation">Validation Functions</h2>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Function</th>
              <th className="text-left py-2 px-3">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>isValidEmail(s)</code></td>
              <td className="py-2 px-3">Check email format</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>isValidUrl(s)</code></td>
              <td className="py-2 px-3">Check URL format</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>isValidUuid(s)</code></td>
              <td className="py-2 px-3">Check UUID format</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2 px-3"><code>isValidJson(s)</code></td>
              <td className="py-2 px-3">Check valid JSON</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="type-checking">Type Checking Functions</h2>
      <CodeBlock
        code={`pre {
  typeof(value) == "string"
  isNumber(amount)
  isArray(items)
  isObject(config)
}`}
        language="isl"
      />
    </div>
  );
}
