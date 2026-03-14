/**
 * ISL Fuzz Seed Corpus
 *
 * A curated collection of valid ISL strings covering all major language
 * constructs. Used as starting points for grammar-aware mutation fuzzing.
 */

export const SEED_CORPUS: string[] = [
  // ── Minimal valid domain ──
  `domain Minimal "1.0" {}`,

  // ── Domain with owner ──
  `domain Owned "1.0" owner "team-backend" {}`,

  // ── Types ──
  `domain Types "1.0" {
  type Email = String { format: "email" }
  type Age = Int { min: 0, max: 150 }
  type Money = Decimal { min: 0.0 }
  type Status = enum { Active, Inactive, Suspended }
  type UserId = UUID
  type CreatedAt = Timestamp
}`,

  // ── Entity with fields ──
  `domain Entities "1.0" {
  entity User {
    id: UUID
    name: String
    email: String { format: "email" }
    age: Int { min: 0 }
    active: Boolean
    created_at: Timestamp
  }
}`,

  // ── Entity with lifecycle ──
  `domain Lifecycle "1.0" {
  entity Order {
    id: UUID
    status: String
    total: Decimal

    lifecycle {
      Pending -> Confirmed
      Confirmed -> Shipped
      Shipped -> Delivered
      Pending -> Cancelled
      Confirmed -> Cancelled
    }
  }
}`,

  // ── Behavior with pre/postconditions ──
  `domain Behaviors "1.0" {
  entity Account {
    id: UUID
    balance: Decimal
    owner: String
  }

  behavior TransferMoney {
    input { from: UUID, to: UUID, amount: Decimal }
    output { success: Boolean, transaction_id: UUID }

    preconditions {
      input.amount > 0
      input.from != input.to
    }

    postconditions {
      on success {
        result.success == true
        result.transaction_id != null
      }
      on failure {
        result.success == false
      }
    }
  }
}`,

  // ── Behavior with actors ──
  `domain ActorBehavior "1.0" {
  behavior CreateUser {
    actors { Admin, System }
    input { name: String, email: String }
    output { id: UUID }

    preconditions {
      input.name != ""
      input.email != ""
    }

    postconditions {
      on success {
        result.id != null
      }
    }
  }
}`,

  // ── Invariant block ──
  `domain Invariants "1.0" {
  entity Account {
    id: UUID
    balance: Decimal
  }

  invariants {
    Account.balance >= 0
  }
}`,

  // ── Struct and union types ──
  `domain ComplexTypes "1.0" {
  type Address = struct {
    street: String
    city: String
    zip: String { pattern: "^[0-9]{5}$" }
    country: String
  }

  type PaymentMethod = union {
    CreditCard { number: String, expiry: String }
    BankTransfer { iban: String }
    Wallet { provider: String, token: String }
  }
}`,

  // ── List and map types ──
  `domain Collections "1.0" {
  type Tags = List<String>
  type Metadata = Map<String, String>
  type UserList = List<UUID>
}`,

  // ── Optional types ──
  `domain Optionals "1.0" {
  entity Profile {
    id: UUID
    bio: String?
    avatar_url: String?
    phone: String?
  }
}`,

  // ── Scenario blocks ──
  `domain Scenarios "1.0" {
  entity User {
    id: UUID
    email: String
  }

  behavior RegisterUser {
    input { email: String, password: String }
    output { id: UUID }
    preconditions { input.email != "" }
    postconditions { on success { result.id != null } }
  }

  scenarios {
    scenario "successful registration" {
      given { no User with email "test@example.com" }
      when { RegisterUser with { email: "test@example.com", password: "secure123" } }
      then { result.id != null }
    }
  }
}`,

  // ── Use/import statements ──
  `domain WithImports "1.0" {
  use stdlib-auth
  use stdlib-billing @ "2.0"
}`,

  // ── Annotations ──
  `domain Annotated "1.0" {
  @deprecated
  type OldStatus = enum { Active, Inactive }

  entity User {
    @pii
    id: UUID
    @pii
    email: String
    name: String
  }
}`,

  // ── Security specs ──
  `domain Secure "1.0" {
  behavior DeleteUser {
    actors { Admin }
    input { user_id: UUID }
    output { deleted: Boolean }

    preconditions {
      input.user_id != null
    }

    security {
      requires authentication
      requires role "admin"
      rate_limit 10 per minute
    }

    postconditions {
      on success { result.deleted == true }
    }
  }
}`,

  // ── Chaos blocks ──
  `domain Resilience "1.0" {
  chaos {
    inject network_failure {
      probability: 0.1
      duration: "5s"
    }
    inject latency {
      min: "100ms"
      max: "2s"
    }
  }
}`,

  // ── Quantifier expressions ──
  `domain Quantifiers "1.0" {
  entity Order {
    id: UUID
    items: List<String>
    total: Decimal
  }

  invariants {
    all items in Order.items: items != ""
    Order.total >= 0
  }
}`,

  // ── Complex postconditions ──
  `domain ComplexPost "1.0" {
  behavior ProcessPayment {
    input { amount: Decimal, currency: String }
    output { receipt_id: UUID, status: String }

    preconditions {
      input.amount > 0
      input.currency != ""
    }

    postconditions {
      on success {
        result.status == "completed"
        result.receipt_id != null
      }
      on failure {
        result.status == "failed" || result.status == "declined"
      }
    }
  }
}`,

  // ── Temporal specs ──
  `domain Temporal "1.0" {
  behavior SlowOperation {
    input { data: String }
    output { result: String }
    preconditions { input.data != "" }

    temporal {
      must_complete_within "30s"
    }

    postconditions {
      on success { result.result != "" }
    }
  }
}`,

  // ── Nested member access expressions ──
  `domain NestedAccess "1.0" {
  behavior GetProfile {
    input { user_id: UUID }
    output { user: struct { name: String, address: struct { city: String } } }

    postconditions {
      on success {
        result.user.name != ""
        result.user.address.city != ""
      }
    }
  }
}`,

  // ── Deeply nested domain ──
  `domain DeepNesting "1.0" {
  type A = struct {
    b: struct {
      c: struct {
        d: struct {
          value: Int
        }
      }
    }
  }
}`,

  // ── Multiple behaviors ──
  `domain MultiBehavior "1.0" {
  entity Item {
    id: UUID
    name: String
    price: Decimal
  }

  behavior CreateItem {
    input { name: String, price: Decimal }
    output { id: UUID }
    preconditions { input.price > 0 }
    postconditions { on success { result.id != null } }
  }

  behavior UpdateItem {
    input { id: UUID, name: String }
    output { updated: Boolean }
    preconditions { input.id != null }
    postconditions { on success { result.updated == true } }
  }

  behavior DeleteItem {
    input { id: UUID }
    output { deleted: Boolean }
    preconditions { input.id != null }
    postconditions { on success { result.deleted == true } }
  }
}`,

  // ── Boolean expression combinations ──
  `domain BoolOps "1.0" {
  behavior Check {
    input { a: Boolean, b: Boolean, c: Int }
    output { ok: Boolean }

    preconditions {
      (input.a == true && input.b == false) || input.c > 10
      !(input.a == false && input.c <= 0)
    }

    postconditions {
      on success { result.ok == true }
    }
  }
}`,

  // ── Compliance spec ──
  `domain Compliant "1.0" {
  behavior StoreData {
    input { data: String, user_id: UUID }
    output { stored: Boolean }
    preconditions { input.data != "" }

    compliance {
      gdpr { lawful_basis: "consent" }
    }

    postconditions { on success { result.stored == true } }
  }
}`,

  // ── Edge: empty entities/behaviors ──
  `domain EmptyParts "1.0" {
  entity Empty {
    id: UUID
  }
}`,

  // ── Policy blocks ──
  `domain WithPolicy "1.0" {
  policy RetentionPolicy {
    scope: "User"
    retention: "90d"
    action: "delete"
  }
}`,
];

/**
 * ISL keywords and tokens for grammar-aware generation.
 */
export const ISL_KEYWORDS = [
  'domain', 'entity', 'behavior', 'type', 'enum', 'struct', 'union',
  'invariants', 'preconditions', 'postconditions', 'scenarios', 'scenario',
  'chaos', 'policy', 'security', 'temporal', 'compliance', 'input',
  'output', 'on', 'success', 'failure', 'given', 'when', 'then',
  'use', 'import', 'from', 'as', 'lifecycle', 'actors', 'requires',
  'rate_limit', 'per', 'inject', 'all', 'any', 'none', 'in',
  'true', 'false', 'null', 'owner', 'with',
] as const;

export const ISL_TYPES = [
  'String', 'Int', 'Decimal', 'Boolean', 'UUID', 'Timestamp', 'Duration',
  'List', 'Map',
] as const;

export const ISL_OPERATORS = [
  '==', '!=', '>', '<', '>=', '<=', '&&', '||', '!',
  '+', '-', '*', '/', '%',
] as const;

export const ISL_DELIMITERS = [
  '{', '}', '(', ')', '[', ']', ':', ',', ';', '.', '?', '@', '"',
] as const;
