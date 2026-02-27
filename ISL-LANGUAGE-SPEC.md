# ISL - Intent Specification Language

## The Universal Language for Intent-Driven Development

ISL (Intent Specification Language) is a next-generation programming language designed to express **what** systems should do, not **how** they should do it. By focusing on intents, contracts, and behaviors, ISL enables AI-assisted code generation, formal verification, and automatic optimization.

---

## Table of Contents

1. [Vision](#vision)
2. [Core Concepts](#core-concepts)
3. [Type System](#type-system)
4. [Behaviors & Contracts](#behaviors--contracts)
5. [Effect System](#effect-system)
6. [Temporal Logic](#temporal-logic)
7. [Session Types](#session-types)
8. [Standard Library](#standard-library)
9. [Verification](#verification)
10. [Code Generation](#code-generation)

---

## Vision

ISL represents a paradigm shift in software development:

```
Traditional: Code → Test → Hope it works
ISL:         Intent → Verify → Generate correct code
```

### Key Principles

1. **Intent over Implementation**: Specify what, not how
2. **Correctness by Construction**: Types and contracts prevent bugs
3. **AI-Native**: Designed for AI code generation
4. **Formally Verifiable**: Mathematical proofs of correctness
5. **Universal**: Generates code for any platform/language

---

## Core Concepts

### Domains

Domains are the top-level organizational unit, similar to modules or packages:

```isl
domain Payments {
  version: "1.0.0"
  owner: "Acme Corp"
  
  // Types, entities, behaviors...
}
```

### Entities

Entities represent persistent data with identity:

```isl
entity User {
  id: UUID [immutable, unique]
  email: Email [unique, indexed]
  name: String { max_length: 255 }
  status: UserStatus
  created_at: Timestamp [immutable]
  
  // Entity invariants - always true
  invariants {
    email.is_valid
    name.length > 0
  }
  
  // Lifecycle state machine
  lifecycle {
    PENDING -> ACTIVE -> SUSPENDED -> DELETED
    PENDING -> DELETED
    ACTIVE -> DELETED
  }
}
```

### Behaviors

Behaviors define operations with pre/post conditions:

```isl
behavior CreateUser {
  description: "Create a new user account"
  
  actors {
    admin: Admin
    system: Internal
  }
  
  input {
    email: Email
    name: String { max_length: 255 }
    role: Role?
  }
  
  output {
    success: User
    errors {
      EMAIL_EXISTS { when: "Email already registered" }
      INVALID_EMAIL { when: "Email format invalid" }
      RATE_LIMITED { retriable: true, retry_after: 1.minute }
    }
  }
  
  preconditions {
    not User.exists(email: input.email)
    input.email.is_deliverable
  }
  
  postconditions {
    success implies {
      User.exists(result.id)
      result.email == input.email
      result.status == PENDING
    }
  }
  
  temporal {
    response within 200.ms (p99)
    eventually within 5.minutes: verification_email_sent
  }
  
  security {
    requires authentication
    rate_limit 100/hour per ip
  }
}
```

---

## Type System

ISL features one of the most advanced type systems ever designed:

### Primitive Types

```isl
// Basic types
String, Int, Decimal, Boolean, Timestamp, Duration, UUID

// Constrained types
type Email = String { format: email, max_length: 255 }
type Money = Decimal { min: 0, precision: 2 }
type Age = Int { min: 0, max: 150 }
```

### Refinement Types

Types with predicates for compile-time checking:

```isl
type PositiveInt = Int { value > 0 }
type NonEmptyString = String { length > 0 }
type Percentage = Decimal { value >= 0 and value <= 100 }

// Dependent refinements
type DateRange = {
  start: Timestamp
  end: Timestamp { value > start }
}
```

### Dependent Types

Types that depend on values:

```isl
// Fixed-length vector
type Vector<T, N: Nat> where N >= 0

// Safe head - only works on non-empty vectors
function head<T, N: Nat { N > 0 }>(vec: Vector<T, N>): T

// Matrix multiplication with dimension checking
function multiply<M, N, P>(
  a: Matrix<M, N>,
  b: Matrix<N, P>
): Matrix<M, P>
```

### Linear Types

Resource management with usage guarantees:

```isl
// File handle must be used exactly once
type FileHandle [linear]

behavior CloseFile {
  input {
    handle: FileHandle [consume]  // Consumed, cannot be used again
  }
}
```

### Union & Intersection Types

```isl
// Union types
type Result<T, E> = Success<T> | Failure<E>

// Intersection types
type AdminUser = User & { permissions: AdminPermissions }
```

---

## Behaviors & Contracts

### Design by Contract

Every behavior specifies its contract:

```isl
behavior Transfer {
  input {
    from: AccountId
    to: AccountId
    amount: Money { value > 0 }
  }
  
  preconditions {
    Account.lookup(from).balance >= input.amount
    from != to
  }
  
  postconditions {
    success implies {
      Account.lookup(from).balance == old(Account.lookup(from).balance) - input.amount
      Account.lookup(to).balance == old(Account.lookup(to).balance) + input.amount
    }
  }
  
  invariants {
    // Total money in system unchanged
    sum(Account.balance) == old(sum(Account.balance))
  }
}
```

### Scenario Testing

Executable specifications:

```isl
scenarios Transfer {
  scenario "successful transfer" {
    given {
      alice = Account.create(balance: 100)
      bob = Account.create(balance: 50)
    }
    
    when {
      result = Transfer(from: alice.id, to: bob.id, amount: 30)
    }
    
    then {
      result is success
      alice.balance == 70
      bob.balance == 80
    }
  }
  
  scenario "insufficient funds" {
    given {
      alice = Account.create(balance: 10)
      bob = Account.create(balance: 50)
    }
    
    when {
      result = Transfer(from: alice.id, to: bob.id, amount: 100)
    }
    
    then {
      result is INSUFFICIENT_FUNDS
      alice.balance == 10  // Unchanged
    }
  }
}
```

### Chaos Testing

Verify behavior under failures:

```isl
chaos Transfer {
  chaos "database failure during transfer" {
    inject { database_failure(target: accounts_db, probability: 100%) }
    
    when {
      Transfer(from: alice.id, to: bob.id, amount: 30)
    }
    
    then {
      // Either succeeds completely or rolls back
      (alice.balance == 70 and bob.balance == 80) or
      (alice.balance == 100 and bob.balance == 50)
    }
  }
}
```

---

## Effect System

Track and control side effects:

```isl
behavior ProcessOrder {
  // Declare effects
  effects {
    Database { read, write, transaction }
    Email { send }
    Logging { info, error }
    Metrics { counter, histogram }
  }
  
  // Implementation verified against declared effects
}
```

### Effect Handlers

Control how effects are interpreted:

```isl
// Production handler
handler ProductionEffects {
  Database => PostgreSQLAdapter
  Email => SendGridAdapter
  Logging => DatadogAdapter
}

// Test handler
handler TestEffects {
  Database => InMemoryDatabase
  Email => MockEmailService
  Logging => ConsoleLogger
}
```

---

## Temporal Logic

Specify time-based properties:

```isl
behavior CreateUser {
  temporal {
    // Response time SLA
    response within 200.ms (p99)
    
    // Eventually consistent
    eventually within 5.minutes: email_verified or user_deleted
    
    // Always true during execution
    always { system.load < 90% }
    
    // Never happens
    never { password stored in plaintext }
  }
}
```

---

## Session Types

Protocol-level type safety:

```isl
session PaymentProtocol {
  // Protocol specification
  client -> server: PaymentRequest
  
  choice {
    approved {
      server -> client: PaymentApproved
      server -> client: Receipt
      end
    }
    declined {
      server -> client: PaymentDeclined
      end
    }
    requires_auth {
      server -> client: AuthChallenge
      client -> server: AuthResponse
      
      choice {
        success {
          server -> client: PaymentApproved
          end
        }
        failure {
          server -> client: AuthFailed
          end
        }
      }
    }
  }
}
```

---

## Standard Library

ISL comes with comprehensive standard libraries:

| Library | Purpose |
|---------|---------|
| `stdlib-auth` | Authentication & Authorization |
| `stdlib-billing` | Subscriptions & Payments |
| `stdlib-files` | File Storage |
| `stdlib-queue` | Job Processing |
| `stdlib-realtime` | WebSockets & Pub/Sub |
| `stdlib-notifications` | Email, SMS, Push |
| `stdlib-analytics` | Event Tracking |
| `stdlib-search` | Full-text Search |
| `stdlib-cache` | Caching Layer |

### Using Standard Libraries

```isl
domain MyApp {
  import { User, Session, Login } from "@isl/stdlib-auth"
  import { Subscription, CreateSubscription } from "@isl/stdlib-billing"
  import { File, Upload } from "@isl/stdlib-files"
  
  // Extend or customize
  entity AppUser extends User {
    subscription: Subscription?
    avatar: File?
  }
}
```

---

## Verification

### Trust Score

Every implementation gets a trust score (0-100):

```
Trust Score: 94/100 ✓ VERIFIED

✓ Preconditions: 12/12 passed
✓ Postconditions: 18/18 passed
✓ Invariants: 5/5 maintained
✓ Temporal: 3/3 satisfied
⚠ Chaos: 8/10 passed (2 edge cases)
✓ Coverage: 97%
```

### Formal Verification

ISL supports SMT solver integration:

```isl
// Automatically verified using Z3
function divide(
  numerator: Int,
  denominator: Int { value != 0 }
): Decimal {
  // Compiler proves this is safe
  return numerator / denominator
}
```

### Property-Based Testing

```isl
property "transfer preserves total balance" {
  forall(accounts: List<Account>, amount: Money) {
    let total_before = sum(accounts.balance)
    Transfer(from: accounts[0], to: accounts[1], amount)
    let total_after = sum(accounts.balance)
    
    total_before == total_after
  }
}
```

---

## Code Generation

ISL generates production-ready code:

### Targets

- TypeScript/JavaScript
- Python
- Go
- Rust
- Java/Kotlin

### Example

```isl
behavior GetUser {
  input { id: UserId }
  output { success: User, errors { NOT_FOUND } }
  
  temporal { response within 50.ms (p99) }
}
```

Generates (TypeScript):

```typescript
export async function getUser(input: { id: string }): Promise<User> {
  const startTime = performance.now();
  
  const user = await db.users.findUnique({ where: { id: input.id } });
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  const duration = performance.now() - startTime;
  metrics.histogram('getUser.duration', duration);
  
  return user;
}
```

---

## Roadmap

### Phase 1: Core Language ✅
- Parser & Type Checker
- Behavior Contracts
- Test Generation

### Phase 2: Advanced Types ✅
- Refinement Types
- Effect System
- Session Types

### Phase 3: Verification 🚧
- SMT Solver Integration
- Property-Based Testing
- Chaos Engineering

### Phase 4: AI Integration 🔮
- Intent-to-ISL Generation
- Auto-fix from Failures
- Optimization Suggestions

---

## Getting Started

```bash
# Install ISL CLI
npm install -g @intentos/isl-cli

# Create new project
isl init my-app

# Check specifications
isl check

# Generate code
isl generate --target typescript

# Verify implementation
isl verify ./src

# Run with AI assistance
isl ai "Add user authentication"
```

---

## Philosophy

> "The best code is code that doesn't exist yet but is provably correct."

ISL represents a future where:
- **Bugs are caught before code is written**
- **AI generates correct implementations from intents**
- **Systems are verified, not just tested**
- **Documentation is the specification**

Welcome to intent-driven development.

---

*ISL - Because the future of programming is declarative.*
