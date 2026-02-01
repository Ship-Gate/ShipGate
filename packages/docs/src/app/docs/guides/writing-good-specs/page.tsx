import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";

export const metadata = {
  title: "Writing Good Specs",
  description: "Best practices for writing clear, maintainable ISL specifications.",
};

export default function WritingGoodSpecsPage() {
  return (
    <div>
      <h1>Writing Good Specs</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Best practices for writing clear, maintainable ISL specifications.
      </p>

      <h2 id="start-with-intent">Start with Intent</h2>
      <p>
        Focus on <strong>what</strong> should happen, not <strong>how</strong> it happens.
        Good specs describe outcomes, not implementations.
      </p>

      <CodeBlock
        code={`// Bad: Describes implementation
intent ProcessOrder {
  post {
    database.insert("orders", order)
    kafka.publish("order-created", order)
    redis.set(\`order:\${order.id}\`, order)
  }
}

// Good: Describes intent
intent ProcessOrder {
  post {
    order.persisted
    order.id != null
    event("order-created").published
  }
}`}
        language="isl"
      />

      <h2 id="be-specific">Be Specific About Postconditions</h2>
      <p>
        Vague postconditions let bugs slip through. Be precise about expected outcomes.
      </p>

      <CodeBlock
        code={`// Bad: Vague
intent CreateInvoice {
  post {
    result != null
  }
}

// Good: Specific
intent CreateInvoice {
  post {
    result.id != null
    result.lineItems.length == input.items.length
    result.subtotal == sum(input.items, i => i.price * i.quantity)
    result.tax == result.subtotal * taxRate
    result.total == result.subtotal + result.tax
    result.status == "draft"
    result.createdAt <= now()
  }
}`}
        language="isl"
      />

      <h2 id="include-error-cases">Include Error Cases</h2>
      <p>
        Specs should cover both success and failure paths.
      </p>

      <CodeBlock
        code={`intent TransferMoney {
  pre {
    fromAccount.exists
    toAccount.exists
    amount > 0
  }
  
  post {
    success implies {
      fromAccount.balance == old(fromAccount.balance) - amount
      toAccount.balance == old(toAccount.balance) + amount
      transfer.recorded
    }
    
    // Also specify what happens on failure
    failure implies {
      fromAccount.balance == old(fromAccount.balance)
      toAccount.balance == old(toAccount.balance)
      error.logged
    }
  }
}`}
        language="isl"
        showLineNumbers
      />

      <h2 id="use-invariants">Use Invariants for Domain Rules</h2>
      <p>
        Invariants capture rules that must <em>always</em> be true, regardless of
        which operation ran.
      </p>

      <CodeBlock
        code={`// Domain invariants
invariant AccountBalanceNonNegative {
  forall account in Account:
    account.balance >= 0
}

invariant NoOrphanedItems {
  forall item in OrderItem:
    exists order in Order:
      order.id == item.orderId
}

invariant ConsistentTotals {
  forall order in Order:
    order.total == sum(order.items, i => i.price * i.quantity)
}`}
        language="isl"
      />

      <Callout type="tip" title="When to Use Invariants">
        Invariants are for rules that span the entire domain. Use postconditions
        for operation-specific outcomes.
      </Callout>

      <h2 id="write-scenarios">Write Realistic Scenarios</h2>
      <p>
        Scenarios should reflect real user journeys, not just technical test cases.
      </p>

      <CodeBlock
        code={`scenario "New customer places first order" {
  given {
    customer.new == true
    customer.orders.count == 0
    cart.items = [product1, product2]
    promoCode = "WELCOME10"
  }
  
  when {
    PlaceOrder(customer, cart, promoCode)
  }
  
  then {
    order.created
    order.discount == 0.10 * order.subtotal
    customer.orders.count == 1
    welcomeEmail.sent
    loyaltyPoints.awarded(100)
  }
}

scenario "Order fails due to inventory shortage" {
  given {
    product.inventory == 1
    cart.items = [{ product, quantity: 5 }]
  }
  
  when {
    PlaceOrder(customer, cart)
  }
  
  then {
    error == "INSUFFICIENT_INVENTORY"
    no order created
    cart.preserved
    customer.notified("Some items unavailable")
  }
}`}
        language="isl"
        showLineNumbers
      />

      <h2 id="naming-conventions">Naming Conventions</h2>
      <ul>
        <li><strong>Intents</strong> - Use verbs: <code>CreateUser</code>, <code>ProcessPayment</code>, <code>CancelOrder</code></li>
        <li><strong>Types</strong> - Use nouns: <code>User</code>, <code>Order</code>, <code>PaymentMethod</code></li>
        <li><strong>Scenarios</strong> - Use full sentences describing the situation</li>
        <li><strong>Invariants</strong> - Name the rule: <code>UniqueEmails</code>, <code>NonNegativeBalance</code></li>
      </ul>

      <h2 id="organization">File Organization</h2>
      <CodeBlock
        code={`specs/
├── domain/
│   ├── user.isl          # User-related intents
│   ├── order.isl         # Order-related intents
│   └── payment.isl       # Payment-related intents
├── invariants/
│   └── domain.isl        # Cross-cutting invariants
└── scenarios/
    ├── checkout.isl      # Checkout flow scenarios
    └── registration.isl  # Registration scenarios`}
        language="text"
      />

      <h2 id="documentation">Document Your Specs</h2>
      <p>Use comments to explain the &quot;why&quot; behind specifications:</p>

      <CodeBlock
        code={`// Users must verify their email within 24 hours or their
// account becomes inactive. This is a legal requirement
// for our industry.
intent VerifyEmail {
  pre {
    user.emailVerified == false
    user.createdAt > addHours(now(), -24)  // Within 24 hours
  }
  
  post {
    user.emailVerified == true
    user.status == "active"
    // Trigger onboarding flow after verification
    onboardingEmail.scheduled
  }
}`}
        language="isl"
      />
    </div>
  );
}
