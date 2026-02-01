import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Entities - ISL Documentation",
  description: "ISL entities: domain objects with fields, invariants, and lifecycles.",
};

export default function EntitiesPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Entities</h1>

        <p className="lead text-xl text-muted-foreground">
          Entities are the core domain objects in ISL. They define data structure, 
          validation rules, and state transitions.
        </p>

        <h2>Basic Structure</h2>

        <p>
          An entity defines fields with types and optional modifiers:
        </p>

        <CodeBlock
          code={`entity User {
  id: UUID [immutable, unique]
  email: String [unique, indexed]
  name: String
  created_at: Timestamp [immutable]
  updated_at: Timestamp
}`}
          language="isl"
        />

        <h2>Field Modifiers</h2>

        <p>
          Modifiers add semantic meaning to fields:
        </p>

        <CodeBlock
          code={`entity Account {
  # Cannot be changed after creation
  id: UUID [immutable]
  
  # Must be unique across all accounts
  account_number: String [unique]
  
  # Should be indexed for fast lookups
  user_id: UUID [indexed]
  
  # Sensitive data, never log or expose
  api_key: String [secret]
  
  # Default value if not provided
  status: AccountStatus [default: ACTIVE]
  
  # Optional field (can be null)
  closed_at: Timestamp?
}`}
          language="isl"
        />

        <h2>Invariants</h2>

        <p>
          Invariants are rules that must always be true for the entity:
        </p>

        <CodeBlock
          code={`entity BankAccount {
  id: UUID [immutable]
  owner_id: UUID [immutable]
  balance: Decimal
  overdraft_limit: Decimal
  status: AccountStatus
  closed_at: Timestamp?

  invariants {
    # Balance cannot go below overdraft limit
    balance >= -overdraft_limit
    
    # Overdraft limit must be non-negative
    overdraft_limit >= 0
    
    # Closed accounts must have closed_at
    status == CLOSED implies closed_at != null
    
    # Active accounts cannot have closed_at
    status == ACTIVE implies closed_at == null
    
    # Balance must be zero when closed
    status == CLOSED implies balance == 0
  }
}`}
          language="isl"
        />

        <h3>Invariant Expressions</h3>

        <p>
          Invariants support various expressions:
        </p>

        <CodeBlock
          code={`invariants {
  # Comparisons
  amount > 0
  count >= 1
  status != DELETED
  
  # Logical operators
  active and verified
  premium or trial
  not suspended
  
  # Implications (if-then)
  verified implies email_confirmed
  
  # Null checks
  deleted_at != null implies status == DELETED
  
  # Collection checks
  items.length > 0
  items.length <= 100
  
  # String checks
  name.length >= 1
  email.contains("@")
}`}
          language="isl"
        />

        <h2>Lifecycles</h2>

        <p>
          Define valid state transitions for entities with a status field:
        </p>

        <CodeBlock
          code={`entity Order {
  id: UUID [immutable]
  status: OrderStatus
  
  lifecycle {
    # From PENDING
    PENDING -> CONFIRMED
    PENDING -> CANCELLED
    
    # From CONFIRMED
    CONFIRMED -> PROCESSING
    CONFIRMED -> CANCELLED
    
    # From PROCESSING
    PROCESSING -> SHIPPED
    PROCESSING -> CANCELLED
    
    # From SHIPPED
    SHIPPED -> DELIVERED
    SHIPPED -> RETURNED
    
    # Terminal states (no outgoing transitions)
    # DELIVERED, RETURNED, CANCELLED
  }
}`}
          language="isl"
        />

        <p>
          ISL will validate that behaviors respect these transitions. Any 
          attempt to make an invalid transition will be flagged.
        </p>

        <h2>Relationships</h2>

        <p>
          Reference other entities using their ID types:
        </p>

        <CodeBlock
          code={`type UserId = UUID { immutable: true }
type OrderId = UUID { immutable: true }

entity User {
  id: UserId [immutable, unique]
  email: String [unique]
}

entity Order {
  id: OrderId [immutable, unique]
  user_id: UserId [immutable, indexed]  # References User
  items: List<OrderItem>
}

entity OrderItem {
  id: UUID [immutable]
  order_id: OrderId [immutable, indexed]  # References Order
  product_id: UUID [immutable]
  quantity: Int
  price: Decimal
  
  invariants {
    quantity > 0
    price >= 0
  }
}`}
          language="isl"
        />

        <h2>Computed Properties</h2>

        <p>
          Define derived values in invariants:
        </p>

        <CodeBlock
          code={`entity Invoice {
  id: UUID [immutable]
  items: List<InvoiceItem>
  subtotal: Decimal
  tax_rate: Decimal
  tax_amount: Decimal
  total: Decimal
  
  invariants {
    # Tax calculation must be correct
    tax_amount == subtotal * tax_rate
    
    # Total must equal subtotal + tax
    total == subtotal + tax_amount
    
    # Subtotal must equal sum of items
    subtotal == items.sum(item => item.amount)
  }
}`}
          language="isl"
        />

        <h2>Complex Example</h2>

        <CodeBlock
          code={`entity Subscription {
  id: UUID [immutable, unique]
  user_id: UUID [immutable, indexed]
  plan_id: UUID [indexed]
  status: SubscriptionStatus
  
  # Billing
  price_per_month: Decimal
  billing_cycle_day: Int
  next_billing_date: Date
  
  # Trial
  trial_ends_at: Timestamp?
  
  # Cancellation
  cancelled_at: Timestamp?
  cancellation_reason: String?
  ends_at: Timestamp?
  
  # Timestamps
  created_at: Timestamp [immutable]
  updated_at: Timestamp

  invariants {
    # Price validation
    price_per_month >= 0
    
    # Billing day validation
    billing_cycle_day >= 1
    billing_cycle_day <= 28
    
    # Trial logic
    status == TRIALING implies trial_ends_at != null
    status != TRIALING implies trial_ends_at == null or trial_ends_at < now()
    
    # Cancellation logic
    status == CANCELLED implies cancelled_at != null
    cancelled_at != null implies cancellation_reason != null
    
    # End date logic
    status == CANCELLED implies ends_at != null
    ends_at != null implies ends_at > cancelled_at
  }

  lifecycle {
    TRIALING -> ACTIVE
    TRIALING -> CANCELLED
    ACTIVE -> PAST_DUE
    ACTIVE -> CANCELLED
    PAST_DUE -> ACTIVE
    PAST_DUE -> CANCELLED
  }
}`}
          language="isl"
          showLineNumbers
        />

        <h2>Next Steps</h2>

        <div className="not-prose">
          <Link
            href="/docs/language/behaviors"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                Behaviors
              </div>
              <div className="text-sm text-muted-foreground">
                Learn about operations and their contracts
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
