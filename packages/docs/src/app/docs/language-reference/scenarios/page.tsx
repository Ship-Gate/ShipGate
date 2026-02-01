import { CodeBlock } from "@/components/CodeBlock";
import { Callout } from "@/components/docs/callout";

export const metadata = {
  title: "Scenarios",
  description: "Given/when/then scenario blocks for BDD-style specifications in ISL.",
};

export default function ScenariosPage() {
  return (
    <div>
      <h1>Scenarios</h1>
      <p className="lead text-xl text-muted-foreground mb-8">
        BDD-style given/when/then blocks for concrete test cases.
      </p>

      <h2 id="basic-syntax">Basic Syntax</h2>
      <p>
        Scenarios use a familiar given/when/then structure from behavior-driven
        development (BDD):
      </p>

      <CodeBlock
        code={`scenario "User logs in with valid credentials" {
  given {
    user = User(email: "alice@example.com")
    user.passwordHash = hash("correct-password")
  }
  
  when {
    Login(email: "alice@example.com", password: "correct-password")
  }
  
  then {
    result.success == true
    result.token != null
    session.created
  }
}`}
        language="isl"
        showLineNumbers
      />

      <h2 id="given-block">The <code>given</code> Block</h2>
      <p>
        Set up the initial state and preconditions for the scenario:
      </p>

      <CodeBlock
        code={`given {
  // Create test data
  user = User {
    id: "user-123"
    email: "test@example.com"
    role: "admin"
  }
  
  // Set up relationships
  account = Account(owner: user)
  account.balance = 1000.00
  
  // Define constraints
  no other user with email "test@example.com"
}`}
        language="isl"
      />

      <h2 id="when-block">The <code>when</code> Block</h2>
      <p>
        Execute the action being tested:
      </p>

      <CodeBlock
        code={`when {
  // Single action
  CreateOrder(items: [item1, item2])
  
  // Or with explicit input
  TransferMoney(
    from: account1,
    to: account2,
    amount: 100
  )
}`}
        language="isl"
      />

      <h2 id="then-block">The <code>then</code> Block</h2>
      <p>
        Assert the expected outcomes:
      </p>

      <CodeBlock
        code={`then {
  // Check result
  result.success == true
  result.order.id != null
  
  // Check state changes
  inventory.reduced(items)
  user.orders.contains(result.order)
  
  // Check side effects
  email.sent_to(user.email)
  analytics.event("order_created").recorded
}`}
        language="isl"
      />

      <h2 id="multiple-scenarios">Multiple Scenarios</h2>
      <p>
        Define multiple scenarios to cover different cases:
      </p>

      <CodeBlock
        code={`intent Register {
  pre { ... }
  post { ... }
  
  scenario "Registration with valid email" {
    given {
      email = "newuser@example.com"
      no user exists with email
    }
    when {
      Register(email, password: "SecurePass123")
    }
    then {
      user.created
      user.email == email
      verification_email.sent
    }
  }
  
  scenario "Registration with existing email" {
    given {
      existing_user.email == "taken@example.com"
    }
    when {
      Register("taken@example.com", "password")
    }
    then {
      error.code == "EMAIL_ALREADY_EXISTS"
      no new user created
    }
  }
  
  scenario "Registration with weak password" {
    given {
      email = "test@example.com"
    }
    when {
      Register(email, password: "weak")
    }
    then {
      error.code == "WEAK_PASSWORD"
      error.message.contains("8 characters")
    }
  }
}`}
        language="isl"
        showLineNumbers
      />

      <Callout type="tip" title="Coverage">
        Aim to write scenarios for happy paths, error cases, and edge cases.
        ISL uses these scenarios to generate comprehensive test suites.
      </Callout>

      <h2 id="data-variations">Data Variations</h2>
      <p>
        Use scenario outlines for testing with multiple data sets:
      </p>

      <CodeBlock
        code={`scenario outline "Age validation" {
  given {
    input.age = <age>
  }
  when {
    ValidateAge(age: input.age)
  }
  then {
    result.valid == <expected>
    result.category == <category>
  }
  
  examples {
    | age | expected | category |
    | 17  | false    | "minor"  |
    | 18  | true     | "adult"  |
    | 65  | true     | "senior" |
    | -1  | false    | null     |
  }
}`}
        language="isl"
        showLineNumbers
      />

      <h2 id="async-scenarios">Async Scenarios</h2>
      <p>
        Handle asynchronous operations with timing assertions:
      </p>

      <CodeBlock
        code={`scenario "Payment processing" {
  given {
    order.total = 100.00
    payment_provider.available
  }
  
  when {
    ProcessPayment(order)
  }
  
  then {
    // Immediate assertions
    result.status == "processing"
    
    // Eventual assertions
    eventually within 30s {
      order.status == "paid"
      payment.completed
    }
    
    // Event assertions
    event "payment.completed" emitted within 5s
  }
}`}
        language="isl"
      />

      <h2 id="scenario-tags">Scenario Tags</h2>
      <p>
        Tag scenarios for filtering and organization:
      </p>

      <CodeBlock
        code={`@slow
@integration
scenario "Full checkout flow" {
  // ...
}

@smoke
@critical
scenario "User login" {
  // ...
}

@skip(reason: "Feature not implemented yet")
scenario "Social login" {
  // ...
}`}
        language="isl"
      />

      <h2 id="shared-setup">Shared Setup</h2>
      <p>
        Define common setup that applies to multiple scenarios:
      </p>

      <CodeBlock
        code={`background {
  admin = User(role: "admin")
  api_key = valid_api_key()
}

scenario "Admin creates product" {
  given {
    // background variables available
    logged_in_as(admin)
  }
  // ...
}

scenario "Admin updates product" {
  given {
    logged_in_as(admin)
    product = existing_product()
  }
  // ...
}`}
        language="isl"
      />
    </div>
  );
}
