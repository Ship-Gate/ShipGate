# ISL Tutorial

A step-by-step guide to using the Intent Specification Language.

## Prerequisites

- Node.js 18+ installed
- npm or pnpm package manager
- VS Code (recommended) or any text editor

## Installation

Install the ISL CLI globally:

```bash
npm install -g @isl-lang/cli
```

Verify installation:

```bash
isl --version
```

## Your First ISL Specification

### Step 1: Create a New Project

```bash
mkdir my-isl-project
cd my-isl-project
isl init
```

This creates a basic project structure:

```
my-isl-project/
├── specs/
│   └── example.isl
├── src/
├── isl.config.json
└── package.json
```

### Step 2: Write Your First Spec

Create `specs/calculator.isl`:

```isl
domain Calculator {
  version: "1.0.0"
  
  behavior Add {
    description: "Add two numbers"
    
    input {
      a: Int
      b: Int
    }
    
    output {
      success: Int
      
      errors {
        OVERFLOW {
          when: "Result exceeds integer bounds"
          retriable: false
        }
      }
    }
    
    pre {
      // Input validation is implicit from types
    }
    
    post success {
      result == input.a + input.b
    }
  }
  
  behavior Divide {
    description: "Divide two numbers"
    
    input {
      dividend: Int
      divisor: Int
    }
    
    output {
      success: Int
      
      errors {
        DIVISION_BY_ZERO {
          when: "Divisor is zero"
          retriable: false
        }
      }
    }
    
    pre {
      input.divisor != 0
    }
    
    post success {
      result * input.divisor <= input.dividend
      result * input.divisor > input.dividend - input.divisor
    }
  }
}
```

### Step 3: Parse and Validate

```bash
isl parse specs/calculator.isl
```

Output:
```
✓ Parsed successfully
Domain: Calculator
  Behaviors: 2
    - Add
    - Divide
```

### Step 4: Generate Code

Generate TypeScript implementation stubs:

```bash
isl generate specs/calculator.isl --lang ts --out src/
```

This creates:
- `src/types.ts` - Type definitions
- `src/Add.ts` - Behavior stub
- `src/Divide.ts` - Behavior stub

### Step 5: Implement the Behaviors

Edit `src/Add.ts`:

```typescript
import type { AddInput, AddResult } from './types';

export async function add(input: AddInput): Promise<AddResult> {
  const result = input.a + input.b;
  
  // Check for overflow (simplified)
  if (result > Number.MAX_SAFE_INTEGER || result < Number.MIN_SAFE_INTEGER) {
    return { success: false, error: 'OVERFLOW' };
  }
  
  return { success: true, value: result };
}
```

Edit `src/Divide.ts`:

```typescript
import type { DivideInput, DivideResult } from './types';

export async function divide(input: DivideInput): Promise<DivideResult> {
  if (input.divisor === 0) {
    return { success: false, error: 'DIVISION_BY_ZERO' };
  }
  
  const result = Math.floor(input.dividend / input.divisor);
  return { success: true, value: result };
}
```

### Step 6: Verify Your Implementation

```bash
isl verify specs/calculator.isl --impl src/Add.ts
```

Output:
```
Trust Score: 100/100
Confidence: 90%

Recommendation: Production Ready

Breakdown:
  Postconditions   ████████████████████  3/3
  Invariants       ████████████████████  0/0
  Scenarios        ████████████████████  2/2
  Temporal         ████████████████████  0/0

✓ Verification passed
```

## Real-World Example: User Management

Let's build a more realistic specification.

### The Specification

Create `specs/users.isl`:

```isl
domain UserManagement {
  version: "1.0.0"
  owner: "platform-team"
  
  // Custom types
  type Email = String {
    format: email
    max_length: 254
  }
  
  type Password = String {
    min_length: 8
    max_length: 128
  }
  
  enum UserStatus {
    PENDING
    ACTIVE
    SUSPENDED
    DELETED
  }
  
  // Entity definition
  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    password_hash: String [secret]
    name: String
    status: UserStatus
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      email.length > 0
      name.length > 0
      status != DELETED implies email.is_valid
    }
    
    lifecycle {
      PENDING -> ACTIVE
      ACTIVE -> SUSPENDED
      SUSPENDED -> ACTIVE
      ACTIVE -> DELETED
      SUSPENDED -> DELETED
    }
  }
  
  // Behaviors
  behavior CreateUser {
    description: "Register a new user account"
    
    actors {
      Anonymous { }
      Admin { must: authenticated }
    }
    
    input {
      email: String
      password: String
      name: String
    }
    
    output {
      success: User
      
      errors {
        EMAIL_EXISTS {
          when: "Email is already registered"
          retriable: false
        }
        INVALID_PASSWORD {
          when: "Password does not meet requirements"
          retriable: true
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: true
        }
      }
    }
    
    pre {
      - input.email.is_valid
      - input.password.length >= 8
      - not User.exists(email: input.email)
    }
    
    post success {
      - User.exists(result.id)
      - result.email == input.email
      - result.name == input.name
      - result.status == PENDING
    }
    
    post EMAIL_EXISTS {
      - not User.created_in_this_call
    }
    
    temporal {
      response within 500ms
    }
    
    invariants {
      password never_logged
      password_hash not_in_response
    }
  }
  
  behavior GetUser {
    description: "Get user by ID"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      id: UUID
    }
    
    output {
      success: User
      
      errors {
        NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to view this user"
          retriable: false
        }
      }
    }
    
    pre {
      - User.exists(input.id)
    }
    
    post success {
      - result.id == input.id
    }
  }
  
  behavior UpdateUser {
    description: "Update user profile"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      id: UUID
      name: String?
      email: String?
    }
    
    output {
      success: User
      
      errors {
        NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to update this user"
          retriable: false
        }
        EMAIL_EXISTS {
          when: "Email already taken by another user"
          retriable: false
        }
      }
    }
    
    pre {
      - User.exists(input.id)
      - actor.id == input.id or actor.role == ADMIN
      - input.email == null or not User.exists(email: input.email, id != input.id)
    }
    
    post success {
      - result.id == input.id
      - result.updated_at > old(User.lookup(input.id).updated_at)
      - input.name != null implies result.name == input.name
      - input.email != null implies result.email == input.email
    }
  }
  
  behavior DeleteUser {
    description: "Soft delete a user account"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      id: UUID
    }
    
    output {
      success: Boolean
      
      errors {
        NOT_FOUND {
          when: "User does not exist"
        }
        UNAUTHORIZED {
          when: "Not authorized to delete this user"
        }
      }
    }
    
    pre {
      - User.exists(input.id)
      - actor.id == input.id or actor.role == ADMIN
    }
    
    post success {
      - User.lookup(input.id).status == DELETED
    }
  }
  
  // Test scenarios
  scenarios CreateUser {
    scenario "successful registration" {
      when {
        result = CreateUser(
          email: "new@example.com",
          password: "SecureP@ss123",
          name: "New User"
        )
      }
      
      then {
        result is success
        result.email == "new@example.com"
        result.status == PENDING
      }
    }
    
    scenario "duplicate email rejected" {
      given {
        existing = CreateUser(
          email: "existing@example.com",
          password: "SecureP@ss123",
          name: "Existing User"
        )
      }
      
      when {
        result = CreateUser(
          email: "existing@example.com",
          password: "AnotherP@ss456",
          name: "Another User"
        )
      }
      
      then {
        result is EMAIL_EXISTS
      }
    }
    
    scenario "weak password rejected" {
      when {
        result = CreateUser(
          email: "weak@example.com",
          password: "123",
          name: "Weak User"
        )
      }
      
      then {
        result is INVALID_PASSWORD
      }
    }
  }
}
```

### Generate Tests

```bash
isl generate specs/users.isl --lang ts --out src/ --tests
```

### Verify Implementation

```bash
isl verify specs/users.isl --impl src/users.ts --detailed
```

## Best Practices

### 1. Start with Entities

Define your domain model first:

```isl
entity Order {
  id: UUID [immutable, unique]
  customer_id: UUID [indexed]
  status: OrderStatus
  total: Decimal
  items: List<OrderItem>
  
  invariants {
    total >= 0
    items.length > 0 implies total > 0
  }
}
```

### 2. Define Clear Preconditions

Make invalid states impossible:

```isl
pre {
  - input.quantity > 0
  - input.quantity <= Product.lookup(input.product_id).stock
  - Cart.exists(input.cart_id)
}
```

### 3. Specify Complete Postconditions

Describe what must be true after success:

```isl
post success {
  - Order.exists(result.id)
  - result.status == PENDING
  - result.customer_id == actor.id
  - Product.lookup(input.product_id).stock == 
      old(Product.lookup(input.product_id).stock) - input.quantity
}
```

### 4. Handle All Error Cases

```isl
output {
  success: Order
  
  errors {
    OUT_OF_STOCK {
      when: "Requested quantity exceeds available stock"
      retriable: true
      retry_after: 30.seconds
    }
    CART_NOT_FOUND {
      when: "Cart does not exist or has expired"
      retriable: false
    }
    PAYMENT_FAILED {
      when: "Payment processing failed"
      retriable: true
    }
  }
}
```

### 5. Add Temporal Constraints

```isl
temporal {
  response within 500ms
  eventually within 30.seconds: payment_confirmed
  always: audit_logged
}
```

### 6. Write Scenario Tests

```isl
scenarios PlaceOrder {
  scenario "happy path" {
    given {
      product = CreateProduct(name: "Widget", price: 9.99, stock: 100)
      cart = CreateCart()
      AddToCart(cart_id: cart.id, product_id: product.id, quantity: 2)
    }
    
    when {
      result = PlaceOrder(cart_id: cart.id)
    }
    
    then {
      result is success
      result.total == 19.98
      Product.lookup(product.id).stock == 98
    }
  }
}
```

## Next Steps

- Read the [API Reference](./API.md) for detailed package documentation
- Read the [Syntax Reference](./SYNTAX.md) for complete grammar
- Explore the [Examples](../examples/) directory
- Join the community on [GitHub Discussions](https://github.com/isl-lang/isl/discussions)

## Troubleshooting

### Parser Errors

If you get parse errors, check:
1. Matching braces `{ }`
2. Required `version:` field in domain
3. Correct keyword spelling (`pre`, `post`, `behavior`)

### Verification Failures

Common issues:
1. Missing entity bindings in test runtime
2. Implementation doesn't match spec types exactly
3. Async operations need proper handling

### VS Code Extension Not Working

1. Reload VS Code window
2. Check ISL output channel for errors
3. Ensure `.isl` file extension
