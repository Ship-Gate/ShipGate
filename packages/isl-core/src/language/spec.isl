# ============================================
# ISL Language Specification v2.0
# The Intent Specification Language
# ============================================
#
# ISL is a specification language for the AI era.
# Intent in, verified software out.

meta {
  version: "2.0.0"
  name: "Intent Specification Language"
  file_extension: ".isl"
}

# ============================================
# CHAPTER 1: LEXICAL STRUCTURE
# ============================================

lexical {
  # Comments
  comment.line: "#" | "//"
  comment.block: "/*" ... "*/"
  comment.doc: "/**" ... "*/"
  
  # Identifiers
  identifier: [a-zA-Z_][a-zA-Z0-9_]*
  type_identifier: [A-Z][a-zA-Z0-9_]*
  
  # Literals
  literal.string: '"' ... '"' | "'" ... "'"
  literal.multiline: '"""' ... '"""'
  literal.number: [0-9]+ ("." [0-9]+)?
  literal.boolean: "true" | "false"
  literal.null: "null"
  
  # Operators
  operator.comparison: "==" | "!=" | "<" | ">" | "<=" | ">="
  operator.logical: "and" | "or" | "not" | "implies"
  operator.arithmetic: "+" | "-" | "*" | "/" | "%"
  operator.range: ".." | "..."
  operator.null_coalesce: "??"
  operator.optional_chain: "?."
  operator.spread: "..."
  
  # Keywords - reserved words
  keywords: [
    # Declarations
    "domain", "entity", "type", "enum", "behavior", "trait", "effect",
    "abstract", "extends", "implements", "import", "export", "from",
    
    # Modifiers
    "immutable", "unique", "secret", "sensitive", "transient", "lazy",
    "computed", "derived", "virtual", "override", "final", "sealed",
    
    # Behavior sections
    "input", "output", "preconditions", "postconditions", "invariants",
    "effects", "temporal", "scenarios", "examples",
    
    # Control flow
    "if", "else", "when", "match", "for", "in", "while",
    
    # Types
    "Any", "Never", "Unknown", "Void",
    
    # Quantifiers
    "all", "any", "some", "none", "exists", "forall",
    
    # Temporal
    "always", "eventually", "until", "within", "before", "after",
    
    # Other
    "success", "errors", "implies", "old", "new", "this", "result"
  ]
}

# ============================================
# CHAPTER 2: TYPE SYSTEM
# ============================================

types {
  
  # Primitive Types
  primitives {
    Boolean     # true or false
    Int         # Arbitrary precision integer
    Float       # IEEE 754 double precision
    String      # UTF-8 string
    Bytes       # Raw byte sequence
  }
  
  # Built-in Types
  builtins {
    UUID        # RFC 4122 UUID
    Email       # RFC 5322 email address
    URL         # RFC 3986 URL
    Phone       # E.164 phone number
    
    Date        # ISO 8601 date (YYYY-MM-DD)
    Time        # ISO 8601 time (HH:MM:SS)
    DateTime    # ISO 8601 datetime
    Timestamp   # Unix timestamp with nanoseconds
    Duration    # Time duration
    
    Money       # Currency amount with precision
    Percentage  # 0-100 with precision
    
    Regex       # Regular expression
    JsonPath    # JSON path expression
  }
  
  # Collection Types
  collections {
    List<T>           # Ordered sequence
    Set<T>            # Unique unordered elements
    Map<K, V>         # Key-value mapping
    Tuple<...T>       # Fixed-size heterogeneous
    Array<T, N>       # Fixed-size array
    Queue<T>          # FIFO queue
    Stack<T>          # LIFO stack
  }
  
  # Special Types
  special {
    Optional<T>       # T or null (sugar: T?)
    Result<T, E>      # Success T or Error E
    Stream<T>         # Async sequence
    Future<T>         # Async computation
    Ref<T>            # Reference to T
  }
  
  # Type Constructors
  constructors {
    # Union types
    Union: T1 | T2 | ... Tn
    
    # Intersection types
    Intersection: T1 & T2 & ... Tn
    
    # Literal types
    Literal: "exact" | 42 | true
    
    # Template literal types
    Template: `prefix${T}suffix`
  }
  
  # Constraints (refinement types)
  constraints {
    # Numeric
    min: T [min: value]
    max: T [max: value]
    range: T [min: a, max: b]
    positive: T [positive]
    negative: T [negative]
    
    # String
    min_length: String [min_length: n]
    max_length: String [max_length: n]
    pattern: String [pattern: regex]
    format: String [format: name]
    
    # Collections
    non_empty: List<T> [non_empty]
    size: List<T> [size: n]
    unique: List<T> [unique]
    
    # Custom
    custom: T [validate: expression]
  }
}

# ============================================
# CHAPTER 3: GENERICS & POLYMORPHISM
# ============================================

generics {
  
  # Type Parameters
  syntax {
    # Simple generic
    type Container<T>
    
    # Multiple parameters
    type Pair<A, B>
    
    # Bounded generics
    type Numeric<T extends Number>
    
    # Default type parameter
    type Collection<T = Any>
    
    # Variance annotations
    type Producer<out T>   # Covariant
    type Consumer<in T>    # Contravariant
    type Mutable<T>        # Invariant (default)
  }
  
  # Constraints on Type Parameters
  constraints {
    # Upper bound
    <T extends Entity>
    
    # Multiple bounds
    <T extends Serializable & Comparable>
    
    # Constructor constraint
    <T: new()>
    
    # Has property constraint
    <T: { id: UUID }>
  }
  
  # Higher-Kinded Types
  higher_kinded {
    # Type that takes a type constructor
    type Functor<F<_>>
    type Monad<M<_>>
    
    # Usage
    type ListFunctor = Functor<List>
  }
  
  # Associated Types
  associated_types {
    trait Iterator {
      type Item
      behavior next(): Option<Self.Item>
    }
  }
}

# ============================================
# CHAPTER 4: TRAITS & INTERFACES
# ============================================

traits {
  
  # Trait Definition
  syntax {
    trait Identifiable {
      id: UUID [unique]
    }
    
    trait Timestamped {
      created_at: Timestamp
      updated_at: Timestamp
    }
    
    trait SoftDeletable {
      deleted_at: Timestamp?
      
      derived {
        is_deleted: Boolean = deleted_at != null
      }
    }
  }
  
  # Trait Composition
  composition {
    # Combine multiple traits
    trait Auditable = Identifiable & Timestamped & SoftDeletable
    
    # Entity implementing traits
    entity User implements Identifiable, Timestamped {
      name: String
    }
  }
  
  # Trait with Behaviors
  behavior_traits {
    trait Comparable<T> {
      behavior compare(other: T): Ordering
      
      derived {
        behavior equals(other: T): Boolean = compare(other) == EQUAL
        behavior less_than(other: T): Boolean = compare(other) == LESS
        behavior greater_than(other: T): Boolean = compare(other) == GREATER
      }
    }
    
    trait Hashable {
      behavior hash(): Int
    }
    
    trait Serializable {
      behavior serialize(): Bytes
      behavior deserialize(bytes: Bytes): Self
    }
  }
  
  # Default Implementations
  defaults {
    trait Printable {
      behavior to_string(): String = default {
        # Default implementation
        JSON.stringify(self)
      }
    }
  }
}

# ============================================
# CHAPTER 5: EFFECT SYSTEM
# ============================================

effects {
  
  # Effect Declaration
  declaration {
    effect IO           # Input/Output
    effect State<S>     # Mutable state
    effect Error<E>     # Can fail with E
    effect Async        # Asynchronous
    effect Random       # Non-deterministic
    effect Time         # Accesses current time
    effect Network      # Network operations
    effect Database     # Database operations
    effect FileSystem   # File operations
  }
  
  # Effect Annotation
  annotation {
    # Behavior with effects
    behavior ReadFile {
      effects { IO, FileSystem, Error<IOError> }
      # ...
    }
    
    # Pure behavior (no effects)
    behavior Calculate {
      effects { pure }
      # ...
    }
  }
  
  # Effect Inference
  inference {
    # Effects are inferred from:
    # - Called behaviors
    # - Field access patterns
    # - External calls
  }
  
  # Effect Handlers
  handlers {
    # Run IO effect
    with IO.handler {
      # Code that uses IO
    }
    
    # Transform effect
    with Error<E>.recover(default) {
      # Code that might fail
    }
  }
}

# ============================================
# CHAPTER 6: TEMPORAL LOGIC
# ============================================

temporal {
  
  # Temporal Operators
  operators {
    # Always (globally)
    always P               # P holds in all states
    
    # Eventually (future)
    eventually P           # P holds at some point
    
    # Until
    P until Q              # P holds until Q becomes true
    
    # Within duration
    within D: P            # P occurs within duration D
    
    # Before/After
    P before Q             # P occurs before Q
    P after Q              # P occurs after Q
    
    # Next state
    next P                 # P holds in next state
  }
  
  # Temporal Constraints
  constraints {
    temporal {
      # Response time
      within 100ms: response_sent
      within 500ms (p95): response_sent
      within 1s (p99): response_sent
      
      # Ordering
      authentication before authorization
      validation before persistence
      
      # Eventual consistency
      eventually within 5s: replicas_synchronized
      
      # Liveness
      eventually: request_processed
      
      # Safety
      always: data_integrity_maintained
    }
  }
  
  # Temporal Properties
  properties {
    # Request-response pattern
    property RequestResponse {
      always (request_received implies eventually response_sent)
    }
    
    # Bounded liveness
    property BoundedResponse {
      always (request_received implies within 30s: response_sent)
    }
    
    # No starvation
    property NoStarvation {
      always (waiting implies eventually served)
    }
  }
}

# ============================================
# CHAPTER 7: COMPOSITION PATTERNS
# ============================================

composition {
  
  # Domain Composition
  domain_composition {
    # Import and extend
    domain ECommerce {
      imports {
        User from "@intentos/stdlib-auth"
        Payment from "@intentos/stdlib-payments"
        Notification from "@intentos/stdlib-notifications"
      }
      
      # Extend imported types
      extend User {
        shipping_addresses: List<Address>
        payment_methods: List<PaymentMethod>
      }
    }
  }
  
  # Behavior Composition
  behavior_composition {
    # Sequential composition
    behavior PlaceOrder = 
      ValidateCart >> 
      ReserveInventory >> 
      ProcessPayment >> 
      CreateShipment
    
    # Parallel composition
    behavior FetchDashboard =
      GetUserStats |&| GetRecentOrders |&| GetNotifications
    
    # Alternative composition
    behavior Authenticate =
      PasswordAuth ||| OAuthAuth ||| SAMLAuth
  }
  
  # Mixins
  mixins {
    mixin Cacheable<T> {
      derived {
        cache_key: String = compute_cache_key(self)
      }
      
      behavior cache(): Void
      behavior invalidate(): Void
    }
    
    entity Product with Cacheable<Product> {
      # Product fields
    }
  }
  
  # Decorators
  decorators {
    @logged
    @cached(ttl: 5.minutes)
    @rate_limited(100.per_minute)
    @retryable(max: 3, backoff: exponential)
    behavior FetchExternalData {
      # ...
    }
  }
}

# ============================================
# CHAPTER 8: PATTERN MATCHING
# ============================================

patterns {
  
  # Basic Patterns
  basic {
    match value {
      # Literal
      42 => "forty-two"
      
      # Variable binding
      x => "got {x}"
      
      # Wildcard
      _ => "anything"
    }
  }
  
  # Destructuring
  destructuring {
    match user {
      # Object destructuring
      { name, age } => "User {name} is {age}"
      
      # Nested destructuring
      { address: { city } } => "Lives in {city}"
      
      # With guard
      { age } if age >= 18 => "Adult"
      { age } => "Minor"
    }
  }
  
  # Type Patterns
  type_patterns {
    match event {
      e: UserCreated => handle_created(e)
      e: UserUpdated => handle_updated(e)
      e: UserDeleted => handle_deleted(e)
      _ => log_unknown_event()
    }
  }
  
  # Collection Patterns
  collection_patterns {
    match items {
      [] => "empty"
      [single] => "one item: {single}"
      [first, ...rest] => "first: {first}, {rest.length} more"
      [first, second, ...] => "at least two"
    }
  }
  
  # Result Patterns
  result_patterns {
    match result {
      success(value) => process(value)
      error(NOT_FOUND) => return_404()
      error(e) => log_error(e)
    }
  }
}

# ============================================
# CHAPTER 9: VERIFICATION SEMANTICS
# ============================================

verification {
  
  # Preconditions
  preconditions {
    # Must be true before behavior executes
    preconditions {
      user.is_active
      amount > 0
      account.balance >= amount
    }
  }
  
  # Postconditions
  postconditions {
    # Must be true after behavior executes
    postconditions {
      # old() refers to pre-state
      account.balance == old(account.balance) - amount
      
      # result is the return value
      result.status == SUCCESS
      
      # Conditional postconditions
      success implies Transaction.exists(result.id)
      error NOT_FOUND implies not User.exists(input.id)
    }
  }
  
  # Invariants
  invariants {
    # Must always be true
    invariants {
      # Entity invariants
      balance >= 0
      email.is_valid
      
      # System invariants
      total_credits == total_debits
      
      # Security invariants
      password never_logged
      secret_key never_exposed
    }
  }
  
  # Frame Conditions
  frame {
    # Specify what CAN change (everything else is unchanged)
    modifies {
      account.balance
      account.updated_at
    }
    
    # Specify what CANNOT change
    preserves {
      account.id
      account.owner_id
    }
  }
  
  # Verification Scenarios
  scenarios {
    scenarios MyBehavior {
      scenario "happy path" {
        given { /* setup */ }
        when { /* action */ }
        then { /* assertions */ }
      }
      
      scenario "error case" {
        given { invalid_input }
        when { action }
        then { result is error }
      }
    }
  }
}

# ============================================
# CHAPTER 10: INTEROPERABILITY
# ============================================

interop {
  
  # Foreign Function Interface
  ffi {
    # Declare external implementation
    external behavior HashPassword {
      target: "rust"
      function: "argon2::hash"
    }
    
    # Bind to existing library
    bind bcrypt from "bcrypt" {
      hash: (password: String) -> String
      compare: (password: String, hash: String) -> Boolean
    }
  }
  
  # Code Generation Targets
  targets {
    # TypeScript
    codegen typescript {
      output_dir: "./generated/ts"
      runtime: "node"
      options: {
        strict: true
        use_branded_types: true
      }
    }
    
    # Python
    codegen python {
      output_dir: "./generated/py"
      version: "3.11+"
      options: {
        use_pydantic: true
        async_mode: true
      }
    }
    
    # Go
    codegen go {
      output_dir: "./generated/go"
      module: "github.com/org/project"
    }
    
    # Rust
    codegen rust {
      output_dir: "./generated/rs"
      edition: "2021"
    }
  }
  
  # API Generation
  api {
    # REST/OpenAPI
    generate openapi {
      version: "3.1.0"
      output: "./api/openapi.yaml"
    }
    
    # GraphQL
    generate graphql {
      output: "./api/schema.graphql"
    }
    
    # gRPC/Protobuf
    generate protobuf {
      output: "./api/service.proto"
    }
  }
}

# ============================================
# CHAPTER 11: MODULE SYSTEM
# ============================================

modules {
  
  # Module Declaration
  declaration {
    module MyDomain {
      # Public exports
      export {
        User
        CreateUser
        UpdateUser
      }
      
      # Internal (not exported)
      internal {
        UserValidator
        PasswordHasher
      }
    }
  }
  
  # Imports
  imports {
    # Named imports
    import { User, Session } from "@intentos/stdlib-auth"
    
    # Aliased imports
    import { User as AuthUser } from "@intentos/stdlib-auth"
    
    # Namespace import
    import * as Auth from "@intentos/stdlib-auth"
    
    # Selective re-export
    export { User } from "@intentos/stdlib-auth"
  }
  
  # Visibility
  visibility {
    # Public (default for exports)
    public entity User { }
    
    # Private (module internal)
    private type InternalConfig { }
    
    # Protected (available to extending domains)
    protected behavior ValidateInput { }
  }
}
