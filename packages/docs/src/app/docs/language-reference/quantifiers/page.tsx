import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";

export const metadata = {
  title: "Quantifiers",
  description: "Using forall and exists quantifiers in ISL specifications.",
};

export default function QuantifiersPage() {
  return (
    <div>
      <h1>Quantifiers</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Express conditions over collections with <code>forall</code> and <code>exists</code>.
      </p>

      <h2 id="forall">The <code>forall</code> Quantifier</h2>
      <p>
        Use <code>forall</code> to assert that every element in a collection
        satisfies a condition.
      </p>

      <CodeBlock
        code={`intent ValidateOrder {
  pre {
    // Every item must be in stock
    forall item in order.items:
      item.inStock == true
      
    // Every item quantity must be positive
    forall item in order.items:
      item.quantity > 0
  }
  
  post {
    // All items have been processed
    forall item in order.items:
      item.status == "processed"
  }
}`}
        language="isl"
        showLineNumbers
      />

      <h3>Multiple Variables</h3>
      <CodeBlock
        code={`// Check all pairs satisfy a condition
invariant UniqueEmails {
  forall u1, u2 in User where u1.id != u2.id:
    u1.email != u2.email
}

// Check relationships between collections
invariant OrderItemsMatchInventory {
  forall item in Order.items:
    exists product in Inventory:
      product.sku == item.sku &&
      product.quantity >= item.quantity
}`}
        language="isl"
      />

      <h2 id="exists">The <code>exists</code> Quantifier</h2>
      <p>
        Use <code>exists</code> to assert that at least one element satisfies
        a condition.
      </p>

      <CodeBlock
        code={`intent ApproveExpense {
  pre {
    // At least one approver must have authority
    exists approver in expense.approvers:
      approver.limit >= expense.amount
  }
  
  post {
    // At least one approval was recorded
    exists approval in expense.approvals:
      approval.timestamp != null &&
      approval.approvedBy != null
  }
}`}
        language="isl"
        showLineNumbers
      />

      <h2 id="negation">Negated Quantifiers</h2>
      <p>
        Negate quantifiers to express &quot;none&quot; or &quot;not all&quot; conditions:
      </p>

      <CodeBlock
        code={`pre {
  // No items are out of stock (same as: all items in stock)
  !exists item in order.items:
    item.outOfStock
    
  // Not all items are premium (at least one non-premium)
  !forall item in order.items:
    item.isPremium
}`}
        language="isl"
      />

      <Callout type="info" title="Logical Equivalence">
        <code>!exists x: P(x)</code> is equivalent to <code>forall x: !P(x)</code>
        <br />
        <code>!forall x: P(x)</code> is equivalent to <code>exists x: !P(x)</code>
      </Callout>

      <h2 id="with-filters">Quantifiers with Filters</h2>
      <p>
        Add <code>where</code> clauses to filter which elements are considered:
      </p>

      <CodeBlock
        code={`intent ProcessOrders {
  post {
    // All pending orders are now processed
    forall order in orders where order.status == "pending":
      order.processed == true
      
    // At least one high-priority item was expedited
    exists item in items where item.priority == "high":
      item.expedited == true
  }
}`}
        language="isl"
      />

      <h2 id="nested-quantifiers">Nested Quantifiers</h2>
      <CodeBlock
        code={`invariant ConsistentPricing {
  // Every product in every category has valid pricing
  forall category in categories:
    forall product in category.products:
      product.price > 0 &&
      product.price <= product.msrp
}

invariant NoOrphanedItems {
  // Every order item references an existing product
  forall order in Order:
    forall item in order.items:
      exists product in Product:
        product.id == item.productId
}`}
        language="isl"
        showLineNumbers
      />

      <h2 id="aggregation">Quantifiers with Aggregation</h2>
      <CodeBlock
        code={`post {
  // At least 80% of items succeeded
  (count(item in items where item.success) / items.length) >= 0.8
  
  // Total of all positive adjustments
  sum(adj in adjustments where adj.amount > 0: adj.amount) == expectedPositive
  
  // All unique categories are represented
  count(unique category in items: category) == expectedCategories
}`}
        language="isl"
      />

      <h2 id="common-patterns">Common Patterns</h2>

      <h3>Uniqueness</h3>
      <CodeBlock
        code={`invariant UniqueUsernames {
  forall u1, u2 in User:
    u1.id != u2.id implies u1.username != u2.username
}`}
        language="isl"
      />

      <h3>Referential Integrity</h3>
      <CodeBlock
        code={`invariant ValidForeignKeys {
  forall order in Order:
    exists customer in Customer:
      customer.id == order.customerId
}`}
        language="isl"
      />

      <h3>Completeness</h3>
      <CodeBlock
        code={`post {
  // All input items appear in output
  forall input_item in input.items:
    exists output_item in result.items:
      output_item.sourceId == input_item.id
}`}
        language="isl"
      />

      <h3>Ordering</h3>
      <CodeBlock
        code={`invariant SortedByDate {
  forall i in 0..(events.length - 2):
    events[i].timestamp <= events[i + 1].timestamp
}`}
        language="isl"
      />
    </div>
  );
}
