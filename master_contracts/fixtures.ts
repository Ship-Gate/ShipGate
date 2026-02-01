// ============================================================================
// ISL Test Fixtures
// All agents must pass tests using these fixtures
// ============================================================================

// ============================================================================
// FIXTURE 1: Minimal Domain
// ============================================================================

export const MINIMAL_DOMAIN = `
domain Minimal {
  version: "1.0.0"
  
  entity User {
    id: UUID [immutable, unique]
    name: String
  }
}
`;

// ============================================================================
// FIXTURE 2: Types and Constraints
// ============================================================================

export const TYPES_DOMAIN = `
domain Types {
  version: "1.0.0"
  
  type Email = String {
    format: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
    max_length: 254
  }
  
  type Money = Decimal {
    precision: 2
    min: 0
  }
  
  type Percentage = Decimal {
    min: 0
    max: 100
  }
  
  type UserId = UUID {
    immutable: true
  }
  
  enum Status {
    ACTIVE
    INACTIVE
    SUSPENDED
  }
  
  enum Currency {
    USD
    EUR
    GBP
  }
  
  type Address = {
    line1: String { max_length: 100 }
    line2: String?
    city: String
    country: String { length: 2 }
  }
  
  type PaymentMethod =
    | Card { last_four: String, brand: String, exp_month: Int, exp_year: Int }
    | BankAccount { routing: String, account_last_four: String }
    | Wallet { provider: String, id: String }
}
`;

// ============================================================================
// FIXTURE 3: Full Behavior
// ============================================================================

export const BEHAVIOR_DOMAIN = `
domain Auth {
  version: "1.0.0"
  
  type Email = String {
    format: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
  }
  
  type Password = String {
    min_length: 8
    max_length: 128
  }
  
  entity User {
    id: UUID [immutable, unique]
    email: Email [unique, indexed]
    password_hash: String [secret]
    status: UserStatus
    failed_attempts: Int
    locked_until: Timestamp?
    created_at: Timestamp [immutable]
    last_login: Timestamp?
    
    invariants {
      failed_attempts >= 0
      failed_attempts <= 10
    }
    
    lifecycle {
      PENDING -> ACTIVE
      ACTIVE -> SUSPENDED
      SUSPENDED -> ACTIVE
      ACTIVE -> DELETED
    }
  }
  
  enum UserStatus {
    PENDING
    ACTIVE
    SUSPENDED
    DELETED
  }
  
  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID [immutable, references: User.id]
    created_at: Timestamp [immutable]
    expires_at: Timestamp
    revoked: Boolean
    ip_address: String [pii]
    user_agent: String
  }
  
  behavior Login {
    description: "Authenticate user and create session"
    
    actors {
      Anonymous { }
    }
    
    input {
      email: Email
      password: Password [sensitive]
    }
    
    output {
      success: Session
      
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password incorrect"
          retriable: true
        }
        ACCOUNT_LOCKED {
          when: "Too many failed attempts"
          retriable: true
          retry_after: 15.minutes
        }
        ACCOUNT_SUSPENDED {
          when: "Account has been suspended"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.email.is_valid
      input.password.length >= 8
    }
    
    postconditions {
      success implies {
        Session.exists(result.id)
        Session.lookup(result.id).user_id == User.lookup(email: input.email).id
        Session.lookup(result.id).expires_at > now()
        User.lookup(email: input.email).failed_attempts == 0
        User.lookup(email: input.email).last_login == now()
      }
      
      INVALID_CREDENTIALS implies {
        User.lookup(email: input.email).failed_attempts == old(User.lookup(email: input.email).failed_attempts) + 1
      }
      
      any_error implies {
        Session.count == old(Session.count)
      }
    }
    
    invariants {
      input.password never_appears_in logs
      timing_safe_comparison(password)
    }
    
    temporal {
      response within 200.ms (p50)
      response within 1.seconds (p99)
      eventually within 5.seconds: audit_log_created
    }
    
    security {
      rate_limit 10/minute per input.email
      rate_limit 100/minute per ip_address
    }
  }
  
  behavior Logout {
    description: "Revoke user session"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      session_id: UUID
    }
    
    output {
      success: Boolean
      
      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
      }
    }
    
    preconditions {
      Session.exists(input.session_id)
      Session.lookup(input.session_id).revoked == false
    }
    
    postconditions {
      success implies {
        Session.lookup(input.session_id).revoked == true
      }
    }
    
    temporal {
      immediately: session_invalid_for_new_requests
      eventually within 1.minute: session_removed_from_cache
    }
  }
}
`;

// ============================================================================
// FIXTURE 4: Scenarios and Chaos
// ============================================================================

export const SCENARIOS_DOMAIN = `
domain Payment {
  version: "1.0.0"
  
  type Money = Decimal { min: 0 }
  
  entity Payment {
    id: UUID [immutable, unique]
    amount: Money
    status: PaymentStatus
    created_at: Timestamp [immutable]
  }
  
  enum PaymentStatus {
    PENDING
    COMPLETED
    FAILED
  }
  
  behavior CreatePayment {
    input {
      amount: Money { min: 1, max: 10000 }
      idempotency_key: String
    }
    
    output {
      success: Payment
      errors {
        DUPLICATE { when: "Idempotency key reused" }
      }
    }
    
    postconditions {
      success implies {
        Payment.exists(result.id)
        Payment.lookup(result.id).amount == input.amount
      }
    }
  }
  
  scenarios CreatePayment {
    scenario "successful payment" {
      given {
        initial_count = Payment.count
      }
      
      when {
        result = CreatePayment(amount: 100.00, idempotency_key: "test-1")
      }
      
      then {
        result is success
        result.payment.amount == 100.00
        Payment.count == initial_count + 1
      }
    }
    
    scenario "duplicate idempotency key" {
      given {
        existing = CreatePayment(amount: 50.00, idempotency_key: "dupe-key")
      }
      
      when {
        result = CreatePayment(amount: 100.00, idempotency_key: "dupe-key")
      }
      
      then {
        result is DUPLICATE
        Payment.count == old(Payment.count)
      }
    }
  }
  
  chaos CreatePayment {
    chaos "database failure" {
      inject {
        database_failure(target: PaymentRepository, mode: UNAVAILABLE)
      }
      
      when {
        result = CreatePayment(amount: 100.00, idempotency_key: "chaos-1")
      }
      
      then {
        result is error
        Payment.count == old(Payment.count)
      }
    }
    
    chaos "concurrent duplicates" {
      inject {
        concurrent_requests(
          count: 10,
          request: CreatePayment(amount: 100.00, idempotency_key: "same-key")
        )
      }
      
      then {
        Payment.count(idempotency_key: "same-key") == 1
      }
    }
  }
}
`;

// ============================================================================
// FIXTURE 5: Full Enterprise Domain
// ============================================================================

export const ENTERPRISE_DOMAIN = `
domain ECommerce {
  version: "2.0.0"
  owner: "platform-team@company.com"
  
  imports {
    Auth from "./auth.isl"
    Money from "@stdlib/finance"
  }
  
  type SKU = String { pattern: /^[A-Z]{2}-[0-9]{6}$/ }
  type Quantity = Int { min: 1, max: 1000 }
  
  entity Product {
    id: UUID [immutable, unique]
    sku: SKU [unique, indexed]
    name: String { max_length: 200 }
    price: Money
    inventory: Int
    status: ProductStatus
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      inventory >= 0
      price.amount > 0
    }
  }
  
  enum ProductStatus {
    DRAFT
    ACTIVE
    DISCONTINUED
  }
  
  entity Order {
    id: UUID [immutable, unique]
    user_id: UUID [references: Auth.User.id]
    items: List<OrderItem>
    total: Money [computed]
    status: OrderStatus
    created_at: Timestamp [immutable]
    
    invariants {
      items.length > 0
      total == sum(items.map(i => i.subtotal))
    }
    
    lifecycle {
      PENDING -> CONFIRMED -> SHIPPED -> DELIVERED
      PENDING -> CANCELLED
      CONFIRMED -> CANCELLED
    }
  }
  
  entity OrderItem {
    product_id: UUID [references: Product.id]
    quantity: Quantity
    unit_price: Money
    subtotal: Money [computed]
    
    invariants {
      subtotal == unit_price * quantity
    }
  }
  
  enum OrderStatus {
    PENDING
    CONFIRMED
    SHIPPED
    DELIVERED
    CANCELLED
  }
  
  behavior PlaceOrder {
    description: "Create a new order from cart items"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      user_id: UUID
      items: List<OrderItemInput> { min_length: 1, max_length: 50 }
      idempotency_key: String
    }
    
    output {
      success: Order
      
      errors {
        INSUFFICIENT_INVENTORY {
          when: "Product inventory too low"
          retriable: true
          returns: { product_id: UUID, available: Int, requested: Int }
        }
        PRODUCT_UNAVAILABLE {
          when: "Product is discontinued"
          retriable: false
        }
        DUPLICATE_ORDER {
          when: "Idempotency key already used"
          retriable: false
          returns: existing_order
        }
      }
    }
    
    preconditions {
      Auth.User.exists(input.user_id)
      Auth.User.lookup(input.user_id).status == ACTIVE
      all(input.items, item => Product.exists(item.product_id))
      all(input.items, item => Product.lookup(item.product_id).status == ACTIVE)
      all(input.items, item => Product.lookup(item.product_id).inventory >= item.quantity)
    }
    
    postconditions {
      success implies {
        Order.exists(result.id)
        Order.lookup(result.id).user_id == input.user_id
        Order.lookup(result.id).status == PENDING
        all(input.items, item => 
          Product.lookup(item.product_id).inventory == 
            old(Product.lookup(item.product_id).inventory) - item.quantity
        )
      }
      
      any_error implies {
        all(Product, p => p.inventory == old(p.inventory))
        Order.count == old(Order.count)
      }
    }
    
    invariants {
      sum(Order.total for all Order where status in [PENDING, CONFIRMED]) <= 1000000
    }
    
    temporal {
      response within 500.ms (p50)
      response within 2.seconds (p99)
      eventually within 5.seconds: confirmation_email_sent
      eventually within 1.hour: inventory_sync_completed
    }
    
    security {
      requires authentication
      rate_limit 10/minute per user_id
    }
    
    compliance {
      pci_dss {
        no_card_data_in_order
      }
      gdpr {
        user_consent_for_email
      }
    }
    
    observability {
      metrics {
        orders_placed_total (counter) by [status]
        order_value (histogram) by [currency]
        order_items_count (histogram)
      }
      
      traces {
        span "validate_inventory"
        span "reserve_inventory"
        span "create_order"
        span "send_confirmation"
      }
      
      logs {
        on success: level INFO, include [order_id, user_id, total]
        on error: level ERROR, include [error_code, user_id]
      }
    }
  }
  
  view OrderDashboard {
    for: Auth.User
    
    fields {
      total_orders: Int = count(Order where user_id == this.id)
      total_spent: Money = sum(Order.total where user_id == this.id and status == DELIVERED)
      recent_orders: List<Order> = Order.where(user_id == this.id).order_by(created_at.desc).limit(10)
      pending_orders: List<Order> = Order.where(user_id == this.id and status in [PENDING, CONFIRMED, SHIPPED])
    }
    
    consistency {
      eventual within 5.seconds
      strongly_consistent: [pending_orders]
    }
    
    cache {
      ttl: 1.minute
      invalidate_on: [Order.created, Order.status_changed]
    }
  }
  
  invariants InventoryConservation {
    description: "Inventory is never negative"
    scope: global
    
    always {
      all(Product, p => p.inventory >= 0)
    }
  }
  
  policy RateLimiting {
    applies_to: all behaviors
    
    rules {
      default: 1000/minute per api_key
      PlaceOrder: 10/minute per user_id
    }
  }
}
`;

// ============================================================================
// EXPECTED PARSE RESULTS (for parser validation)
// ============================================================================

export const MINIMAL_DOMAIN_EXPECTED = {
  kind: 'Domain',
  name: { kind: 'Identifier', name: 'Minimal' },
  version: { kind: 'StringLiteral', value: '1.0.0' },
  entities: [
    {
      kind: 'Entity',
      name: { kind: 'Identifier', name: 'User' },
      fields: [
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'id' },
          type: { kind: 'PrimitiveType', name: 'UUID' },
          annotations: [
            { kind: 'Annotation', name: { kind: 'Identifier', name: 'immutable' } },
            { kind: 'Annotation', name: { kind: 'Identifier', name: 'unique' } },
          ],
        },
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'name' },
          type: { kind: 'PrimitiveType', name: 'String' },
          annotations: [],
        },
      ],
    },
  ],
};

// ============================================================================
// ERROR CASES (for error handling validation)
// ============================================================================

export const SYNTAX_ERROR_CASES = [
  {
    name: 'missing_brace',
    input: `domain Test { version: "1.0.0"`,
    expectedError: 'Expected closing brace',
  },
  {
    name: 'invalid_type',
    input: `domain Test { version: "1.0.0" type Foo = Unknown }`,
    expectedError: 'Unknown type',
  },
  {
    name: 'duplicate_entity',
    input: `domain Test { version: "1.0.0" entity User { id: UUID } entity User { id: UUID } }`,
    expectedError: 'Duplicate entity',
  },
  {
    name: 'invalid_constraint',
    input: `domain Test { version: "1.0.0" type Age = Int { min: "not a number" } }`,
    expectedError: 'Expected number',
  },
  {
    name: 'missing_version',
    input: `domain Test { entity User { id: UUID } }`,
    expectedError: 'Missing required field: version',
  },
];

export const TYPE_ERROR_CASES = [
  {
    name: 'undefined_reference',
    input: `domain Test { version: "1.0.0" entity User { role: Role } }`,
    expectedError: 'Undefined type: Role',
  },
  {
    name: 'invalid_field_reference',
    input: `domain Test { 
      version: "1.0.0" 
      entity User { id: UUID }
      behavior GetUser {
        postconditions { User.lookup(result.id).nonexistent == true }
      }
    }`,
    expectedError: 'Unknown field: nonexistent',
  },
  {
    name: 'type_mismatch',
    input: `domain Test {
      version: "1.0.0"
      type Age = Int { min: 0 }
      entity User { age: Age }
      behavior SetAge {
        input { age: String }
        postconditions { User.lookup(result.id).age == input.age }
      }
    }`,
    expectedError: 'Type mismatch',
  },
];