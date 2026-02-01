import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Behaviors - ISL Documentation",
  description: "ISL behaviors: operations with preconditions, postconditions, and errors.",
};

export default function BehaviorsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Behaviors</h1>

        <p className="lead text-xl text-muted-foreground">
          Behaviors define operations in your domain with explicit contracts 
          including inputs, outputs, preconditions, and postconditions.
        </p>

        <h2>Basic Structure</h2>

        <CodeBlock
          code={`behavior CreateUser {
  description: "Create a new user account"

  input {
    email: String
    password: String [sensitive]
    name: String
  }

  output {
    success: User
    errors {
      EMAIL_EXISTS { when: "Email already registered" }
      INVALID_EMAIL { when: "Email format is invalid" }
    }
  }

  preconditions {
    input.email.is_valid_format
    input.password.length >= 8
  }

  postconditions {
    success implies {
      - User.exists(result.id)
      - result.email == input.email
    }
  }
}`}
          language="isl"
        />

        <h2>Input Definition</h2>

        <p>
          Define what data the behavior accepts:
        </p>

        <CodeBlock
          code={`input {
  # Required fields
  email: String
  amount: Decimal
  
  # Optional fields
  notes: String?
  metadata: Map<String, String>?
  
  # With modifiers
  password: String [sensitive]    # Won't appear in logs
  card_number: String [sensitive] # PCI compliance
  
  # With inline constraints
  quantity: Int { min: 1, max: 100 }
}`}
          language="isl"
        />

        <h2>Output Definition</h2>

        <p>
          Define success and error cases:
        </p>

        <CodeBlock
          code={`output {
  # Success case - what's returned on success
  success: User
  
  # Or a complex success type
  success: {
    user: User
    token: String
    expires_at: Timestamp
  }
  
  # Error cases with descriptions
  errors {
    NOT_FOUND {
      when: "Resource does not exist"
      retriable: false
    }
    RATE_LIMITED {
      when: "Too many requests"
      retriable: true
      retry_after: 60s
    }
    VALIDATION_ERROR {
      when: "Input validation failed"
      retriable: false
      fields: List<String>  # Which fields failed
    }
  }
}`}
          language="isl"
        />

        <h2>Preconditions</h2>

        <p>
          Define what must be true before the behavior executes:
        </p>

        <CodeBlock
          code={`preconditions {
  # Input validation
  input.email.is_valid_format
  input.password.length >= 8
  input.amount > 0
  
  # Entity existence
  User.exists(input.user_id)
  Order.exists(input.order_id)
  
  # State checks
  User.lookup(input.user_id).status == ACTIVE
  Order.lookup(input.order_id).status != CANCELLED
  
  # Business rules
  not User.exists_by_email(input.email)
  Account.lookup(input.account_id).balance >= input.amount
}`}
          language="isl"
        />

        <h2>Postconditions</h2>

        <p>
          Define what must be true after the behavior executes:
        </p>

        <CodeBlock
          code={`postconditions {
  # On success
  success implies {
    - User.exists(result.id)
    - result.email == input.email
    - result.status == ACTIVE
    - result.created_at == now()
  }
  
  # On specific errors
  EMAIL_EXISTS implies {
    - User.count == old(User.count)  # No new user created
  }
  
  # On any failure
  failure implies {
    - no User created
    - database unchanged
  }
}`}
          language="isl"
        />

        <h3>The <code>old()</code> Function</h3>

        <p>
          Use <code>old()</code> to reference values before the operation:
        </p>

        <CodeBlock
          code={`behavior TransferMoney {
  input {
    from_account: UUID
    to_account: UUID
    amount: Decimal
  }

  postconditions {
    success implies {
      # Balance changes
      - Account.lookup(from_account).balance == 
          old(Account.lookup(from_account).balance) - input.amount
      - Account.lookup(to_account).balance == 
          old(Account.lookup(to_account).balance) + input.amount
      
      # Total money unchanged
      - Account.sum(balance) == old(Account.sum(balance))
    }
  }
}`}
          language="isl"
        />

        <h2>Actors</h2>

        <p>
          Define who can perform the behavior:
        </p>

        <CodeBlock
          code={`behavior DeleteUser {
  actors {
    Admin {
      must: authenticated
      has_role: admin
    }
    User {
      must: authenticated
      owns: user_id  # Can only delete themselves
    }
  }

  input {
    user_id: UUID
  }
  
  # ...
}

behavior PublicSearch {
  actors {
    Anonymous {
      for: public_access
    }
  }
  
  # No authentication required
}`}
          language="isl"
        />

        <h2>Invariants</h2>

        <p>
          Define rules that must hold during and after execution:
        </p>

        <CodeBlock
          code={`behavior ProcessPayment {
  invariants {
    - card_number never stored
    - card_number never logged
    - CVV never stored
    - timing attack resistant
  }
}`}
          language="isl"
        />

        <h2>Temporal Constraints</h2>

        <p>
          Define timing requirements:
        </p>

        <CodeBlock
          code={`temporal {
  # Response time SLAs
  - within 100ms (p50): response returned
  - within 500ms (p95): response returned
  - within 2s (p99): response returned
  
  # Eventual consistency
  - eventually within 5s: cache invalidated
  - eventually within 30s: search index updated
  
  # Ordering
  - immediately: user notified
}`}
          language="isl"
        />

        <h2>Security Constraints</h2>

        <p>
          Define security requirements:
        </p>

        <CodeBlock
          code={`security {
  # Rate limiting
  - rate_limit 100 per hour per ip_address
  - rate_limit 10 per minute per user_id
  
  # Protection
  - brute_force_protection enabled
  - csrf_protection required
  
  # Token expiry
  - token expires after 1 hour
}`}
          language="isl"
        />

        <h2>Complete Example</h2>

        <CodeBlock
          code={`behavior PlaceOrder {
  description: "Place a new order for the authenticated user"

  actors {
    User {
      must: authenticated
      must: email_verified
    }
  }

  input {
    items: List<{
      product_id: UUID
      quantity: Int { min: 1 }
    }>
    shipping_address_id: UUID
    payment_method_id: UUID
    notes: String?
  }

  output {
    success: {
      order: Order
      estimated_delivery: Date
    }

    errors {
      CART_EMPTY {
        when: "No items in order"
        retriable: false
      }
      PRODUCT_UNAVAILABLE {
        when: "One or more products out of stock"
        retriable: true
        products: List<UUID>
      }
      PAYMENT_FAILED {
        when: "Payment processing failed"
        retriable: true
        retry_after: 30s
      }
      ADDRESS_INVALID {
        when: "Shipping address is invalid"
        retriable: false
      }
    }
  }

  preconditions {
    input.items.length > 0
    ShippingAddress.exists(input.shipping_address_id)
    PaymentMethod.exists(input.payment_method_id)
    input.items.all(item => Product.exists(item.product_id))
    input.items.all(item => Product.lookup(item.product_id).stock >= item.quantity)
  }

  postconditions {
    success implies {
      - Order.exists(result.order.id)
      - result.order.user_id == current_user.id
      - result.order.status == PENDING
      - result.order.items.length == input.items.length
      - Payment.exists_for_order(result.order.id)
    }

    PRODUCT_UNAVAILABLE implies {
      - no Order created
      - no Payment charged
    }
  }

  invariants {
    - payment_method_id never logged
    - idempotency key respected
  }

  temporal {
    - within 3s (p99): response returned
    - eventually within 5m: confirmation email sent
    - eventually within 1h: inventory updated
  }

  security {
    - rate_limit 10 per minute per user_id
    - csrf_protection required
  }
}`}
          language="isl"
          showLineNumbers
        />

        <h2>Next Steps</h2>

        <div className="not-prose">
          <Link
            href="/docs/language/scenarios"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                Scenarios
              </div>
              <div className="text-sm text-muted-foreground">
                Learn about test scenarios with given/when/then
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
