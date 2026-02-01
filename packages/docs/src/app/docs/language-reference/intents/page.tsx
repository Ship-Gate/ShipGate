import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";

export const metadata = {
  title: "Intents",
  description: "Complete guide to intent syntax and usage in ISL.",
};

export default function IntentsPage() {
  return (
    <div>
      <h1>Intents</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        The core building block of ISL specifications.
      </p>

      <h2 id="basic-syntax">Basic Syntax</h2>
      <p>
        An intent defines what a piece of code should do using preconditions and
        postconditions.
      </p>

      <CodeBlock
        code={`intent IntentName {
  pre {
    // Preconditions
  }
  
  post {
    // Postconditions
  }
}`}
        language="isl"
      />

      <h2 id="preconditions">Preconditions</h2>
      <p>
        Preconditions specify what must be true <strong>before</strong> the operation
        executes. They act as guards that prevent invalid operations.
      </p>

      <CodeBlock
        code={`intent WithdrawMoney {
  pre {
    account.exists(accountId)
    account.balance >= amount
    amount > 0
    amount <= account.dailyLimit
  }
}`}
        language="isl"
        showLineNumbers
      />

      <h3>Common Precondition Patterns</h3>
      <CodeBlock
        code={`// Existence checks
pre { user.exists(id) }
pre { !email.taken(newEmail) }

// Null checks
pre { input != null }
pre { items.length > 0 }

// Range validation
pre { age >= 18 && age <= 120 }
pre { price > 0 }

// State checks
pre { order.status == "pending" }
pre { !account.locked }

// Permission checks
pre { caller.hasRole("admin") }
pre { resource.ownedBy(caller) }`}
        language="isl"
      />

      <h2 id="postconditions">Postconditions</h2>
      <p>
        Postconditions specify what must be true <strong>after</strong> the operation
        completes successfully.
      </p>

      <CodeBlock
        code={`intent CreateUser {
  post {
    result.id != null
    result.email == input.email
    result.createdAt <= now()
    user.count == old(user.count) + 1
  }
}`}
        language="isl"
        showLineNumbers
      />

      <h3 id="old-keyword">The <code>old()</code> Keyword</h3>
      <p>
        Use <code>old(expression)</code> to reference the value of an expression
        <em>before</em> the operation executed. This is essential for verifying
        state changes.
      </p>

      <CodeBlock
        code={`intent TransferFunds {
  post {
    // Source account decreased by amount
    source.balance == old(source.balance) - amount
    
    // Target account increased by amount
    target.balance == old(target.balance) + amount
    
    // Total funds in system unchanged
    totalFunds() == old(totalFunds())
  }
}`}
        language="isl"
      />

      <Callout type="info">
        The <code>old()</code> keyword captures state at the start of the operation.
        It&apos;s evaluated lazily, so complex expressions work correctly.
      </Callout>

      <h2 id="result-keyword">The <code>result</code> Keyword</h2>
      <p>
        Use <code>result</code> to refer to the return value of the operation in
        postconditions.
      </p>

      <CodeBlock
        code={`intent CalculateTotal {
  post {
    result >= 0
    result == items.sum(item => item.price * item.quantity)
  }
}

intent FindUser {
  post {
    result != null implies result.id == searchId
  }
}`}
        language="isl"
      />

      <h2 id="input-parameters">Input Parameters</h2>
      <p>
        Reference input parameters directly by name in both pre and post conditions.
      </p>

      <CodeBlock
        code={`intent UpdateProfile {
  // input: { userId, name, email }
  
  pre {
    userId != null
    name.length > 0
    email.isValidFormat()
  }
  
  post {
    user.name == name
    user.email == email
  }
}`}
        language="isl"
      />

      <h2 id="implies-operator">The <code>implies</code> Operator</h2>
      <p>
        Use <code>implies</code> for conditional postconditions. If the left side
        is true, the right side must also be true.
      </p>

      <CodeBlock
        code={`intent ProcessPayment {
  post {
    // If successful, these must be true
    success implies {
      payment.status == "completed"
      payment.processedAt != null
      receipt.generated
    }
    
    // If failed, these must be true
    !success implies {
      payment.status == "failed"
      account.balance == old(account.balance)
      error != null
    }
  }
}`}
        language="isl"
      />

      <h2 id="multi-block-postconditions">Multi-block Postconditions</h2>
      <p>
        For complex operations, you can group related postconditions.
      </p>

      <CodeBlock
        code={`intent CompleteOrder {
  post {
    // Order state
    order.status == "completed"
    order.completedAt != null
  }
  
  post effects {
    // Side effects
    inventory.updated
    notification.sent(customer.email)
    analytics.tracked("order_completed")
  }
  
  post consistency {
    // Data consistency
    order.total == order.items.sum(i => i.price)
    customer.orders.contains(order)
  }
}`}
        language="isl"
      />

      <h2 id="intent-composition">Intent Composition</h2>
      <p>
        Intents can reference other intents to build complex specifications.
      </p>

      <CodeBlock
        code={`intent PlaceOrder {
  // Composes multiple intents
  includes ValidateCart
  includes ReserveInventory
  includes ProcessPayment
  includes SendConfirmation
  
  post {
    all_included_intents.succeeded
  }
}`}
        language="isl"
      />

      <Callout type="tip" title="Best Practice">
        Keep intents focused on a single responsibility. Compose multiple intents
        for complex workflows rather than creating one large intent.
      </Callout>
    </div>
  );
}
