import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Invariants - ISL Documentation",
  description: "ISL invariants: rules that must always be true.",
};

export default function InvariantsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Invariants</h1>

        <p className="lead text-xl text-muted-foreground">
          Invariants are rules that must always be true. ISL supports entity 
          invariants, behavior invariants, and global domain invariants.
        </p>

        <h2>Entity Invariants</h2>

        <p>
          Rules that must hold for every instance of an entity:
        </p>

        <CodeBlock
          code={`entity BankAccount {
  id: UUID [immutable]
  balance: Decimal
  overdraft_limit: Decimal
  status: AccountStatus
  closed_at: Timestamp?

  invariants {
    # Numeric constraints
    balance >= -overdraft_limit
    overdraft_limit >= 0
    
    # State consistency
    status == CLOSED implies closed_at != null
    status == ACTIVE implies closed_at == null
    
    # Business rules
    status == CLOSED implies balance == 0
  }
}`}
          language="isl"
        />

        <h2>Behavior Invariants</h2>

        <p>
          Rules that must hold during the execution of a behavior:
        </p>

        <CodeBlock
          code={`behavior ProcessPayment {
  input {
    card_number: String [sensitive]
    cvv: String [sensitive]
    amount: Decimal
  }

  invariants {
    # Security invariants
    - card_number never stored in database
    - card_number never written to logs
    - cvv never stored
    - cvv never logged
    
    # Timing invariants
    - timing attack resistant
    
    # Data handling
    - PCI DSS compliant
  }
}`}
          language="isl"
        />

        <h2>Global Invariants</h2>

        <p>
          Domain-wide rules that must always hold:
        </p>

        <CodeBlock
          code={`domain Banking {
  # ... types, entities, behaviors ...

  invariants SecurityPolicy {
    description: "Security rules that must always hold"
    scope: global
    
    always {
      - passwords never stored in plaintext
      - passwords never appear in logs
      - PII encrypted at rest
      - all API calls authenticated
      - all mutations logged to audit trail
    }
  }

  invariants DataIntegrity {
    description: "Data consistency rules"
    scope: global
    
    always {
      # Money conservation
      - sum(Account.balance) == constant
      
      # Referential integrity
      - Transaction.account_id references valid Account
      - Order.user_id references valid User
    }
  }
}`}
          language="isl"
        />

        <h2>Invariant Expressions</h2>

        <h3>Comparisons</h3>

        <CodeBlock
          code={`invariants {
  # Equality
  status == ACTIVE
  balance != 0
  
  # Numeric comparisons
  amount > 0
  quantity >= 1
  price <= max_price
  age < 150
}`}
          language="isl"
        />

        <h3>Logical Operators</h3>

        <CodeBlock
          code={`invariants {
  # AND
  active and verified
  
  # OR
  admin or moderator
  
  # NOT
  not deleted
  not (suspended or banned)
}`}
          language="isl"
        />

        <h3>Implications</h3>

        <p>
          Use <code>implies</code> for if-then rules:
        </p>

        <CodeBlock
          code={`invariants {
  # If status is COMPLETED, completed_at must exist
  status == COMPLETED implies completed_at != null
  
  # If user is admin, must be verified
  role == ADMIN implies verified == true
  
  # If account is closed, balance must be zero
  closed_at != null implies balance == 0
  
  # Chained implications
  premium implies (verified and email_confirmed)
}`}
          language="isl"
        />

        <h3>Null Checks</h3>

        <CodeBlock
          code={`invariants {
  # Not null
  email != null
  
  # Null allowed
  bio == null or bio.length <= 500
  
  # Conditional null
  deleted implies deleted_at != null
  not deleted implies deleted_at == null
}`}
          language="isl"
        />

        <h3>Collection Invariants</h3>

        <CodeBlock
          code={`invariants {
  # Length constraints
  items.length > 0
  items.length <= 100
  
  # All items satisfy condition
  items.all(item => item.quantity > 0)
  items.all(item => item.price >= 0)
  
  # At least one item satisfies
  items.any(item => item.is_primary)
  
  # Sum/aggregation
  items.sum(item => item.amount) == total
  items.count(item => item.active) >= 1
}`}
          language="isl"
        />

        <h2>Cross-Entity Invariants</h2>

        <p>
          Define relationships between entities:
        </p>

        <CodeBlock
          code={`invariants OrderIntegrity {
  scope: global
  
  always {
    # Order total must equal sum of items
    - Order.all(o => 
        o.total == o.items.sum(i => i.quantity * i.unit_price)
      )
    
    # Every order item references a valid product
    - OrderItem.all(oi => Product.exists(oi.product_id))
    
    # User cannot have more than 3 pending orders
    - User.all(u => 
        Order.count(o => o.user_id == u.id and o.status == PENDING) <= 3
      )
  }
}`}
          language="isl"
        />

        <h2>Temporal Invariants</h2>

        <CodeBlock
          code={`invariants TimeConsistency {
  always {
    # Created before updated
    - Entity.all(e => e.created_at <= e.updated_at)
    
    # Completed after created
    - Order.all(o => 
        o.completed_at != null implies o.completed_at > o.created_at
      )
    
    # Session expires after creation
    - Session.all(s => s.expires_at > s.created_at)
    
    # Events in order
    - Order.all(o =>
        o.shipped_at != null implies o.shipped_at > o.confirmed_at
      )
  }
}`}
          language="isl"
        />

        <h2>Quantified Invariants</h2>

        <CodeBlock
          code={`invariants {
  # For all
  - User.all(u => u.email.is_valid_format)
  - Account.all(a => a.balance >= -a.overdraft_limit)
  
  # There exists
  - Account.any(a => a.type == PRIMARY)
  
  # Unique constraints
  - User.unique_by(email)
  - Account.unique_by(account_number)
  
  # Counting
  - User.count(u => u.role == ADMIN) >= 1
}`}
          language="isl"
        />

        <h2>Security Invariants</h2>

        <CodeBlock
          code={`invariants SecurityRules {
  description: "Security constraints"
  scope: global
  
  always {
    # Authentication
    - all mutations require authentication
    - admin operations require admin role
    
    # Data protection
    - passwords hashed with bcrypt or argon2
    - sensitive data encrypted at rest
    - PII not logged
    
    # Rate limiting
    - login attempts rate limited
    - API calls rate limited per user
    
    # Audit
    - all state changes logged
    - audit logs immutable
  }
}`}
          language="isl"
        />

        <h2>Verifying Invariants</h2>

        <p>
          ISL generates tests to verify invariants at runtime:
        </p>

        <CodeBlock
          code={`$ isl verify auth.isl --invariants

Verifying invariants for auth.isl...

Entity Invariants:
  ✓ User: email.is_valid_format
  ✓ User: status == DELETED implies deleted_at != null
  ✓ Session: expires_at > created_at

Behavior Invariants:
  ✓ Login: password never logged
  ✓ Register: password hashed

Global Invariants:
  ✓ SecurityPolicy: passwords never stored in plaintext
  ✓ DataIntegrity: referential integrity

All 7 invariants verified!`}
          language="bash"
        />

        <h2>Next Steps</h2>

        <div className="not-prose">
          <Link
            href="/docs/verification"
            className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div>
              <div className="font-semibold group-hover:text-primary transition-colors">
                Verification
              </div>
              <div className="text-sm text-muted-foreground">
                Learn about runtime verification and testing
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
