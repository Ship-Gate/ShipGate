import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";
import Link from "next/link";

export const metadata = {
  title: "Core Concepts",
  description: "Learn the fundamental concepts of ISL: intents, preconditions, postconditions, invariants, and scenarios.",
};

export default function ConceptsPage() {
  return (
    <div>
      <h1>Core Concepts</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        Understanding the fundamental building blocks of ISL specifications.
      </p>

      <h2 id="intents">Intents</h2>
      <p>
        An <strong>intent</strong> is the core unit of specification in ISL. It describes
        what a piece of code should do—not how it does it. Each intent has:
      </p>
      <ul>
        <li><strong>Name</strong> - A descriptive identifier for the behavior</li>
        <li><strong>Preconditions</strong> - What must be true before execution</li>
        <li><strong>Postconditions</strong> - What must be true after execution</li>
      </ul>

      <CodeBlock
        code={`intent TransferMoney {
  pre {
    fromAccount.balance >= amount
    amount > 0
    fromAccount.id != toAccount.id
  }
  
  post {
    fromAccount.balance == old(fromAccount.balance) - amount
    toAccount.balance == old(toAccount.balance) + amount
  }
}`}
        language="isl"
        showLineNumbers
      />

      <h2 id="preconditions">Preconditions</h2>
      <p>
        Preconditions define the <strong>contract requirements</strong> that must be
        satisfied before the code executes. If a precondition is not met, the
        operation should not proceed.
      </p>

      <CodeBlock
        code={`intent DeleteUser {
  pre {
    user.exists(id)           // User must exist
    !user.hasActiveOrders()   // No pending orders
    caller.isAdmin()          // Only admins can delete
  }
}`}
        language="isl"
      />

      <Callout type="info">
        Preconditions are checked at runtime. If any precondition fails,
        ISL-generated validators will reject the operation before it executes.
      </Callout>

      <h2 id="postconditions">Postconditions</h2>
      <p>
        Postconditions define what must be true <strong>after</strong> the code executes.
        They describe the expected outcome and side effects.
      </p>

      <CodeBlock
        code={`intent CreateOrder {
  post {
    result.id != null                     // Order was created
    result.status == "pending"            // Initial status
    result.items.length == input.items.length  // All items included
    inventory.reduced(input.items)        // Inventory updated
    notification.sent(user.email)         // Confirmation sent
  }
}`}
        language="isl"
      />

      <h3 id="old-keyword">The <code>old()</code> Keyword</h3>
      <p>
        Use <code>old()</code> to reference the value of something <em>before</em> the
        operation executed. This is essential for verifying state changes.
      </p>

      <CodeBlock
        code={`intent IncrementCounter {
  post {
    counter.value == old(counter.value) + 1
  }
}`}
        language="isl"
      />

      <h2 id="invariants">Invariants</h2>
      <p>
        Invariants are conditions that must <strong>always</strong> be true, regardless
        of what operations are performed. They define the fundamental rules of your
        domain.
      </p>

      <CodeBlock
        code={`invariant AccountBalanceNonNegative {
  forall account in Account:
    account.balance >= 0
}

invariant UniqueEmails {
  forall u1, u2 in User:
    u1.id != u2.id implies u1.email != u2.email
}`}
        language="isl"
      />

      <Callout type="warning">
        Invariants are checked after every operation. If any invariant is violated,
        the entire operation is considered invalid—even if all postconditions passed.
      </Callout>

      <h2 id="scenarios">Scenarios</h2>
      <p>
        Scenarios describe specific use cases with concrete examples. They use a
        <strong>given/when/then</strong> structure familiar from BDD testing.
      </p>

      <CodeBlock
        code={`scenario "User registration with valid email" {
  given {
    email = "alice@example.com"
    password = "SecurePass123!"
    no user exists with email
  }
  
  when {
    RegisterUser(email, password)
  }
  
  then {
    user exists with email
    user.verified == false
    verification_email.sent_to(email)
  }
}

scenario "User registration with duplicate email" {
  given {
    existing_user.email == "bob@example.com"
  }
  
  when {
    RegisterUser("bob@example.com", "password")
  }
  
  then {
    error == "EMAIL_ALREADY_EXISTS"
    no new user created
  }
}`}
        language="isl"
        showLineNumbers
      />

      <h2 id="chaos-testing">Chaos Testing</h2>
      <p>
        ISL supports built-in chaos testing to verify your system handles failures
        gracefully. Use the <code>chaos</code> block to inject failures.
      </p>

      <CodeBlock
        code={`intent ProcessPayment {
  pre { ... }
  post { ... }
  
  chaos {
    inject database.timeout(5s) {
      expect retry.attempted(3)
      expect error == "PAYMENT_TIMEOUT"
      expect no_charge_to_card
    }
    
    inject network.partition {
      expect circuit_breaker.opened
      expect fallback.activated
    }
  }
}`}
        language="isl"
      />

      <h2 id="quantifiers">Quantifiers</h2>
      <p>
        ISL supports logical quantifiers for expressing conditions over collections.
      </p>

      <ul>
        <li><code>forall</code> - Every element must satisfy the condition</li>
        <li><code>exists</code> - At least one element must satisfy the condition</li>
      </ul>

      <CodeBlock
        code={`intent ApproveAllOrders {
  pre {
    forall order in orders:
      order.status == "pending"
  }
  
  post {
    forall order in orders:
      order.status == "approved"
    
    exists notification in sent_notifications:
      notification.type == "BULK_APPROVAL"
  }
}`}
        language="isl"
      />

      <h2 id="next-steps">Next Steps</h2>
      <p>
        Now that you understand the core concepts, explore the complete language
        reference or start writing more complex specifications.
      </p>

      <div className="not-prose grid gap-3 mt-6">
        <Link
          href="/docs/language-reference/intents"
          className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
        >
          <div>
            <div className="font-semibold group-hover:text-primary transition-colors">
              Intent Syntax
            </div>
            <div className="text-sm text-muted-foreground">
              Full grammar and advanced intent features
            </div>
          </div>
        </Link>
        <Link
          href="/docs/language-reference/scenarios"
          className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
        >
          <div>
            <div className="font-semibold group-hover:text-primary transition-colors">
              Scenario Blocks
            </div>
            <div className="text-sm text-muted-foreground">
              Writing comprehensive test scenarios
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
