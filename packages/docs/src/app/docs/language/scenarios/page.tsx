import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Scenarios - ISL Documentation",
  description: "ISL scenarios: test cases with given/when/then structure.",
};

export default function ScenariosPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Scenarios</h1>

        <p className="lead text-xl text-muted-foreground">
          Scenarios define concrete test cases using a given/when/then structure, 
          making your specifications executable and testable.
        </p>

        <h2>Basic Structure</h2>

        <CodeBlock
          code={`scenario "User can register with valid email" {
  given {
    no User exists with email "test@example.com"
  }
  
  when {
    Register(
      email: "test@example.com",
      password: "SecurePass123"
    )
  }
  
  then {
    result is success
    result.user.email == "test@example.com"
    result.user.status == PENDING_VERIFICATION
  }
}`}
          language="isl"
        />

        <h2>Given Block</h2>

        <p>
          The <code>given</code> block sets up the initial state:
        </p>

        <CodeBlock
          code={`given {
  # Entity existence
  User exists with {
    id: "user-123"
    email: "existing@example.com"
    status: ACTIVE
  }
  
  # Negative conditions
  no User exists with email "new@example.com"
  no Order exists for user "user-123"
  
  # State conditions
  Account "acc-123" has balance 1000.00
  Product "prod-456" has stock 50
  
  # Time conditions
  current_time is "2024-01-15T10:00:00Z"
}`}
          language="isl"
        />

        <h2>When Block</h2>

        <p>
          The <code>when</code> block executes the behavior:
        </p>

        <CodeBlock
          code={`when {
  # Simple call
  CreateUser(
    email: "test@example.com",
    password: "password123"
  )
  
  # With actor context
  as User("user-123") {
    PlaceOrder(
      items: [
        { product_id: "prod-1", quantity: 2 },
        { product_id: "prod-2", quantity: 1 }
      ],
      shipping_address_id: "addr-123"
    )
  }
  
  # Multiple sequential operations
  result1 = CreateOrder(...)
  result2 = AddOrderItem(order_id: result1.id, ...)
}`}
          language="isl"
        />

        <h2>Then Block</h2>

        <p>
          The <code>then</code> block asserts the expected outcome:
        </p>

        <CodeBlock
          code={`then {
  # Check success
  result is success
  
  # Check specific error
  result is error EMAIL_EXISTS
  
  # Value assertions
  result.user.email == "test@example.com"
  result.order.total == 99.99
  
  # State changes
  User.count == old(User.count) + 1
  Account("acc-123").balance == 500.00
  
  # Entity state
  Order(result.order.id).status == PENDING
  User(result.user.id).status == ACTIVE
  
  # Negative assertions
  no email sent to "test@example.com"
  no charge made to payment method
}`}
          language="isl"
        />

        <h2>Error Scenarios</h2>

        <p>
          Test error cases explicitly:
        </p>

        <CodeBlock
          code={`scenario "Registration fails with existing email" {
  given {
    User exists with email "taken@example.com"
  }
  
  when {
    Register(
      email: "taken@example.com",
      password: "password123"
    )
  }
  
  then {
    result is error EMAIL_EXISTS
    User.count == old(User.count)
    no email sent
  }
}

scenario "Transfer fails with insufficient funds" {
  given {
    Account "from-acc" has balance 100.00
    Account "to-acc" has balance 500.00
  }
  
  when {
    TransferMoney(
      from_account: "from-acc",
      to_account: "to-acc",
      amount: 200.00
    )
  }
  
  then {
    result is error INSUFFICIENT_FUNDS
    Account("from-acc").balance == 100.00  # Unchanged
    Account("to-acc").balance == 500.00    # Unchanged
  }
}`}
          language="isl"
        />

        <h2>Parameterized Scenarios</h2>

        <p>
          Run the same scenario with different inputs:
        </p>

        <CodeBlock
          code={`scenario "Password validation" {
  parameters {
    password | expected_error
    --------|----------------
    "short" | PASSWORD_TOO_SHORT
    "nouppercase123" | PASSWORD_NEEDS_UPPERCASE
    "NOLOWERCASE123" | PASSWORD_NEEDS_LOWERCASE
    "NoNumbers" | PASSWORD_NEEDS_NUMBER
    "ValidPass123" | none
  }
  
  when {
    Register(
      email: "test@example.com",
      password: {password}
    )
  }
  
  then {
    if {expected_error} == none {
      result is success
    } else {
      result is error {expected_error}
    }
  }
}`}
          language="isl"
        />

        <h2>Scenario Groups</h2>

        <p>
          Organize related scenarios:
        </p>

        <CodeBlock
          code={`scenarios "User Authentication" {
  # Shared setup for all scenarios in group
  setup {
    User exists with {
      id: "user-123"
      email: "user@example.com"
      password_hash: hash("correctpassword")
      status: ACTIVE
    }
  }
  
  scenario "Successful login" {
    when {
      Login(email: "user@example.com", password: "correctpassword")
    }
    then {
      result is success
      result.session.user_id == "user-123"
    }
  }
  
  scenario "Login with wrong password" {
    when {
      Login(email: "user@example.com", password: "wrongpassword")
    }
    then {
      result is error INVALID_CREDENTIALS
    }
  }
  
  scenario "Login with non-existent email" {
    when {
      Login(email: "nobody@example.com", password: "anypassword")
    }
    then {
      result is error USER_NOT_FOUND
    }
  }
}`}
          language="isl"
        />

        <h2>Temporal Scenarios</h2>

        <p>
          Test time-dependent behavior:
        </p>

        <CodeBlock
          code={`scenario "Session expires after timeout" {
  given {
    Session exists with {
      id: "session-123"
      user_id: "user-456"
      created_at: "2024-01-15T10:00:00Z"
      expires_at: "2024-01-15T11:00:00Z"
    }
    current_time is "2024-01-15T11:30:00Z"
  }
  
  when {
    ValidateSession(session_id: "session-123")
  }
  
  then {
    result is error SESSION_EXPIRED
  }
}

scenario "Password reset token expires" {
  given {
    ResetToken exists with {
      token: "reset-token-abc"
      user_id: "user-123"
      created_at: "2024-01-15T10:00:00Z"
      expires_at: "2024-01-15T11:00:00Z"
    }
    current_time is "2024-01-15T12:00:00Z"
  }
  
  when {
    ResetPassword(
      token: "reset-token-abc",
      new_password: "NewSecurePass123"
    )
  }
  
  then {
    result is error TOKEN_EXPIRED
    User("user-123").password_hash == old(User("user-123").password_hash)
  }
}`}
          language="isl"
        />

        <h2>Edge Case Scenarios</h2>

        <CodeBlock
          code={`scenarios "Order Edge Cases" {
  scenario "Empty cart" {
    when {
      PlaceOrder(items: [])
    }
    then {
      result is error CART_EMPTY
    }
  }
  
  scenario "Single item at max quantity" {
    given {
      Product "prod-1" has stock 100
    }
    when {
      PlaceOrder(items: [{ product_id: "prod-1", quantity: 100 }])
    }
    then {
      result is success
      Product("prod-1").stock == 0
    }
  }
  
  scenario "Item quantity exceeds stock" {
    given {
      Product "prod-1" has stock 5
    }
    when {
      PlaceOrder(items: [{ product_id: "prod-1", quantity: 10 }])
    }
    then {
      result is error INSUFFICIENT_STOCK
      Product("prod-1").stock == 5  # Unchanged
    }
  }
}`}
          language="isl"
        />

        <h2>Next Steps</h2>

        <div className="not-prose">
          <Link
            href="/docs/language/invariants"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                Invariants
              </div>
              <div className="text-sm text-muted-foreground">
                Learn about global and entity invariants
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
