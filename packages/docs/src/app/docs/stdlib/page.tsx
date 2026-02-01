import { CodeBlock } from "@/components/CodeBlock";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Standard Library - ISL Documentation",
  description: "Pre-built ISL specifications for common domains.",
};

export default function StdlibPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Standard Library</h1>

        <p className="lead text-xl text-muted-foreground">
          The ISL Standard Library provides pre-built specifications for common 
          domains that you can import and extend.
        </p>

        <h2>Installation</h2>

        <CodeBlock
          code={`npm install @intentos/stdlib`}
          language="bash"
        />

        <h2>Available Modules</h2>

        <div className="not-prose grid gap-4 my-8">
          <Link
            href="/docs/stdlib/core"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  Core Types
                </h3>
                <p className="text-sm text-muted-foreground">
                  Essential types like Email, Phone, URL, Money, and more
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
          <Link
            href="/docs/stdlib/auth"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  Authentication
                </h3>
                <p className="text-sm text-muted-foreground">
                  User, Session, Login, Register, Password Reset behaviors
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
          <Link
            href="/docs/stdlib/payments"
            className="p-4 rounded-lg border border-border hover:bg-muted transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold group-hover:text-primary transition-colors">
                  Payments
                </h3>
                <p className="text-sm text-muted-foreground">
                  Payment processing, refunds, subscriptions
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        </div>

        <h2>Using the Standard Library</h2>

        <p>
          Import modules from the standard library using the <code>import</code> statement:
        </p>

        <CodeBlock
          code={`import { Email, Phone, Money } from "@stdlib/core"
import { User, Session, Login } from "@stdlib/auth"

domain MyApp {
  # Use imported types
  entity Customer {
    id: UUID [immutable]
    email: Email [unique]
    phone: Phone?
    balance: Money
  }
  
  # Extend imported behaviors
  behavior Login extends @stdlib/auth.Login {
    # Add custom postconditions
    postconditions {
      success implies {
        - AuditLog.record("login", result.user.id)
      }
    }
  }
}`}
          language="isl"
        />

        <h2>Extending Library Specs</h2>

        <p>
          You can extend or customize library specifications:
        </p>

        <CodeBlock
          code={`import { User as BaseUser } from "@stdlib/auth"

# Extend the base User entity
entity User extends BaseUser {
  # Add custom fields
  company_id: UUID?
  department: String?
  
  # Add custom invariants
  invariants {
    role == ADMIN implies company_id == null
    role == EMPLOYEE implies company_id != null
  }
}`}
          language="isl"
        />

        <h2>Overriding Defaults</h2>

        <p>
          Override default configurations:
        </p>

        <CodeBlock
          code={`import { Login } from "@stdlib/auth"

behavior Login extends @stdlib/auth.Login {
  # Override temporal requirements
  temporal {
    - within 200ms (p50): response returned  # Stricter than default
    - within 1s (p99): response returned
  }
  
  # Override security settings
  security {
    - rate_limit 50 per hour per ip_address  # More restrictive
    - rate_limit 5 per hour per email
  }
}`}
          language="isl"
        />

        <h2>Composition</h2>

        <p>
          Compose multiple library modules:
        </p>

        <CodeBlock
          code={`import { User, Session } from "@stdlib/auth"
import { Payment, Subscription } from "@stdlib/payments"
import { Email, Money } from "@stdlib/core"

domain SaaSApp {
  # Compose entities with relationships
  entity Customer extends User {
    subscription: Subscription?
    payments: List<Payment>
    
    invariants {
      status == ACTIVE implies subscription != null
    }
  }
  
  behavior Subscribe {
    input {
      user_id: UUID
      plan_id: UUID
      payment_method_id: UUID
    }
    
    postconditions {
      success implies {
        - Subscription.exists(result.id)
        - User.lookup(user_id).subscription == result
        - Payment.exists_for_subscription(result.id)
      }
    }
  }
}`}
          language="isl"
        />
      </div>
    </div>
  );
}
