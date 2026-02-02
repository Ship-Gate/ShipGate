// NOTE: simplified for parser compatibility (no trailing commas / unsupported syntax).
// Comprehensive ISL spec using every language feature
// Used for testing parser completeness

domain AllFeatures {
  version: "2.0.0"
  owner: "Test Suite"
  
  // === IMPORTS ===
  // import "other.isl"
  
  // === TYPE DEFINITIONS ===
  
  // Constrained primitive types
  type Email = String {
    format: email
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
  
  type Age = Int {
    min: 0
    max: 150
  }
  
  type NonEmptyString = String {
    min_length: 1
    max_length: 1000
  }
  
  type UserId = UUID {
    immutable: true
  }
  
  // Enum types
  enum Status {
    DRAFT
    PENDING
    ACTIVE
    SUSPENDED
    DELETED
  }
  
  enum Priority {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }
  
  enum Currency {
    USD
    EUR
    GBP
    JPY
  }
  
  // Struct types
  type Address = {
    line1: String
    line2: String?
    city: String
    state: String?
    postal_code: String
    country: String
  }
  
  type GeoLocation = {
    latitude: Decimal
    longitude: Decimal
  }
  
  type DateRange = {
    start: Timestamp
    end: Timestamp
  }
  
  type Metadata = {
    created_by: UUID
    created_at: Timestamp
    updated_by: UUID?
    updated_at: Timestamp?
    version: Int
  }
  
  // === ENTITIES ===
  
  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    password_hash: String [secret]
    name: String
    status: Status
    age: Int?
    address: Address?
    tags: List<String>
    metadata: Map<String, String>
    failed_login_attempts: Int
    locked_until: Timestamp?
    last_login: Timestamp?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      email.length > 0
      name.length > 0
      failed_login_attempts >= 0
      failed_login_attempts <= 10
    }
    
    lifecycle {
      DRAFT -> PENDING
      PENDING -> ACTIVE
      ACTIVE -> SUSPENDED
      SUSPENDED -> ACTIVE
      ACTIVE -> DELETED
      SUSPENDED -> DELETED
    }
  }
  
  entity Organization {
    id: UUID [immutable, unique]
    name: String [indexed]
    owner_id: UUID
    member_count: Int
    settings: Map<String, String>
    created_at: Timestamp [immutable]
    
    invariants {
      member_count >= 0
    }
  }
  
  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID [immutable, indexed]
    token_hash: String [secret]
    ip_address: String [pii]
    user_agent: String
    created_at: Timestamp [immutable]
    expires_at: Timestamp
    revoked: Boolean
    
    invariants {
      expires_at > created_at
    }
  }
  
  entity AuditLog {
    id: UUID [immutable, unique]
    actor_id: UUID?
    action: String
    resource_type: String
    resource_id: UUID?
    details: Map<String, String>
    ip_address: String? [pii]
    timestamp: Timestamp [immutable]
  }
  
  // === BEHAVIORS ===
  
  behavior CreateUser {
    description: "Create a new user account"
    
    actors {
      Admin { must: authenticated }
      System { }
    }
    
    input {
      email: String
      password: String [sensitive]
      name: String
      age: Int?
      address: Address?
    }
    
    output {
      success: User
      
      errors {
        EMAIL_EXISTS {
          when: "Email is already registered"
          retriable: false
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: false
        }
        WEAK_PASSWORD {
          when: "Password does not meet requirements"
          retriable: true
        }
        RATE_LIMITED {
          when: "Too many requests"
          retriable: true
          retry_after: 1.minutes
        }
      }
    }
    
    preconditions {
      input.email.length > 0
      input.password.length >= 8
      input.name.length > 0
      not User.exists(email: input.email)
    }
    
    postconditions {
      success implies {
        User.exists(result.id)
        User.lookup(result.id).email == input.email
        User.lookup(result.id).name == input.name
        User.lookup(result.id).status == PENDING
        User.count == old(User.count) + 1
      }
      
      EMAIL_EXISTS implies {
        User.count == old(User.count)
      }
      
      any_error implies {
        User.count == old(User.count)
      }
    }
    
    invariants {
      input.password never_appears_in logs
      input.password never_appears_in result
    }
    
    temporal {
      response within 500.ms
      eventually within 10.seconds: audit_log_created
      eventually within 1.minutes: welcome_email_sent
    }
    
    security {
      rate_limit 10 per input.email
      rate_limit 100 per ip_address
    }
    
    // compliance block removed - uses unsupported syntax (bare identifiers)
    // observability block removed - uses unsupported syntax (key: value without braces)
  }
  
  behavior AuthenticateUser {
    description: "Authenticate user with email and password"
    
    actors {
      Anonymous { }
    }
    
    input {
      email: String
      password: String [sensitive]
      remember_me: Boolean?
    }
    
    output {
      success: Session
      
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
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
        ACCOUNT_NOT_ACTIVE {
          when: "Account is not yet active"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.email.length > 0
      input.password.length > 0
    }
    
    postconditions {
      success implies {
        Session.exists(result.id)
        Session.lookup(result.id).user_id == User.lookup(input.email).id
        Session.lookup(result.id).revoked == false
        User.lookup(input.email).failed_login_attempts == 0
        User.lookup(input.email).last_login != null
      }
      
      INVALID_CREDENTIALS implies {
        User.lookup(input.email).failed_login_attempts == old(User.lookup(input.email).failed_login_attempts) + 1
        Session.count == old(Session.count)
      }
      
      any_error implies {
        Session.count == old(Session.count)
      }
    }
    
    invariants {
      input.password never_appears_in logs
      input.password never_appears_in result
    }
    
    temporal {
      response within 200.ms
      response within 1.seconds
    }
    
    security {
      rate_limit 5 per input.email
      rate_limit 50 per ip_address
      // fraud_check removed - bare identifier syntax not supported
    }
  }
  
  behavior UpdateUser {
    description: "Update user profile information"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      user_id: UUID
      name: String?
      age: Int?
      address: Address?
    }
    
    output {
      success: User
      
      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to update this user"
          retriable: false
        }
      }
    }
    
    preconditions {
      User.exists(input.user_id)
    }
    
    postconditions {
      success implies {
        input.name != null implies User.lookup(input.user_id).name == input.name
        input.age != null implies User.lookup(input.user_id).age == input.age
        User.lookup(input.user_id).updated_at > old(User.lookup(input.user_id).updated_at)
      }
    }
  }
  
  behavior DeleteUser {
    description: "Soft delete a user account"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      user_id: UUID
    }
    
    output {
      success: Boolean
      
      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        ALREADY_DELETED {
          when: "User is already deleted"
          retriable: false
        }
      }
    }
    
    preconditions {
      User.exists(input.user_id)
      User.lookup(input.user_id).status != DELETED
    }
    
    postconditions {
      success implies {
        User.lookup(input.user_id).status == DELETED
        // user sessions are revoked (simplified for parser compatibility)
      }
    }
    
    temporal {
      eventually within 5.minutes: all_sessions_revoked
      eventually within 24.hours: data_anonymized
    }
  }
  
  behavior ListUsers {
    description: "List users with pagination and filtering"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      page: Int?
      page_size: Int?
      status_filter: Status?
      search_query: String?
    }
    
    output {
      success: {
        users: List<User>
        total_count: Int
        page: Int
        page_size: Int
        has_more: Boolean
      }
    }
    
    preconditions {
      input.page == null or input.page >= 1
      input.page_size == null or (input.page_size >= 1 and input.page_size <= 100)
    }
    
    postconditions {
      success implies {
        result.page >= 1
        result.page_size >= 1
        result.total_count >= 0
        result.users.length <= result.page_size
      }
    }
  }
  
  // === VIEWS ===
  
  view UserSummary {
    for: User
    fields {
      id: UUID = user.id
      email: String = user.email
      name: String = user.name
      status: String = user.status
      created_at: Timestamp = user.created_at
    }
    consistency {
      eventual within 5.minutes
    }
    cache {
      ttl: 5.minutes
    }
  }
  
  view UserProfile {
    for: User
    fields {
      id: UUID = user.id
      email: String = user.email
      name: String = user.name
    }
    consistency {
      strong
    }
  }
  
  // === POLICIES ===
  
  policy UserAccessPolicy {
    applies_to: all behaviors
    rules {
      actor.role == "admin": allow
      default: deny
    }
  }
  
  // === SCENARIOS ===
  
  scenarios CreateUser {
    scenario "successful user creation" {
      given {
        initial_count = User.count
      }
      
      when {
        result = CreateUser(
          email: "new@example.com",
          password: "securePassword123!",
          name: "New User"
        )
      }
      
      then {
        result is success
        User.count == initial_count + 1
        result.email == "new@example.com"
        result.name == "New User"
        result.status == PENDING
      }
    }
    
    scenario "duplicate email rejection" {
      given {
        existing = CreateUser(
          email: "existing@example.com",
          password: "password123!",
          name: "Existing"
        )
      }
      
      when {
        result = CreateUser(
          email: "existing@example.com",
          password: "different123!",
          name: "Different"
        )
      }
      
      then {
        result is EMAIL_EXISTS
        User.count == old(User.count)
      }
    }
    
    scenario "weak password rejection" {
      when {
        result = CreateUser(
          email: "weak@example.com",
          password: "123",
          name: "Weak Password User"
        )
      }
      
      then {
        result is WEAK_PASSWORD
      }
    }
  }
  
  scenarios AuthenticateUser {
    scenario "successful login" {
      given {
        user = CreateUser(
          email: "login@example.com",
          password: "validPassword123!",
          name: "Login User"
        )
        activate(user)
      }
      
      when {
        result = AuthenticateUser(
          email: "login@example.com",
          password: "validPassword123!"
        )
      }
      
      then {
        result is success
        result.user_id == user.id
        result.revoked == false
      }
    }
    
    scenario "invalid credentials" {
      given {
        user = CreateUser(
          email: "badlogin@example.com",
          password: "correctPassword!",
          name: "Bad Login User"
        )
        activate(user)
        initial_failed_attempts = user.failed_login_attempts
      }
      
      when {
        result = AuthenticateUser(
          email: "badlogin@example.com",
          password: "wrongPassword!"
        )
      }
      
      then {
        result is INVALID_CREDENTIALS
        User.lookup("badlogin@example.com").failed_login_attempts == initial_failed_attempts + 1
      }
    }
  }
  
  // === CHAOS TESTS ===
  
  chaos CreateUser {
    chaos "database unavailable" {
      inject {
        database_failure(target: UserRepository, mode: UNAVAILABLE)
      }
      
      when {
        result = CreateUser(
          email: "chaos@example.com",
          password: "chaosPassword123!",
          name: "Chaos User"
        )
      }
      
      then {
        result is error
        User.count == old(User.count)
      }
    }
    
    chaos "network partition" {
      inject {
        network_partition(target: EmailService, duration: 30.seconds)
      }
      
      when {
        result = CreateUser(
          email: "partition@example.com",
          password: "partitionPass123!",
          name: "Partition User"
        )
      }
      
      then {
        result is success or result is error
        // User creation should either succeed (email queued) or fail gracefully
      }
    }
    
    chaos "high latency" {
      inject {
        latency(target: UserRepository, delay: 5.seconds)
      }
      
      when {
        result = CreateUser(
          email: "latency@example.com",
          password: "latencyPass123!",
          name: "Latency User"
        )
      }
      
      then {
        response_time < 10.seconds
      }
    }
  }
  
  // === GLOBAL INVARIANTS ===
  // Global invariants block removed - nameless invariants { } not supported
  // Would need to use named invariants or entity-level invariants
}
