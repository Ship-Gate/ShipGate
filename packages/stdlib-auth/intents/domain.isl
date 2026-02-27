// ============================================================================
// Authentication & Authorization Domain
// Version: 1.0.0
// ============================================================================

domain Auth {
  version: "1.0.0"
  owner: "IntentOS Standard Library"
  
  // ============================================================================
  // CORE TYPES
  // ============================================================================
  
  type UserId = UUID
  type SessionId = UUID
  type TokenId = UUID
  type RoleId = String { pattern: /^[a-z][a-z0-9_-]*$/ }
  type PermissionId = String { pattern: /^[a-z][a-z0-9_:.-]*$/ }
  
  type Email = String { 
    format: email
    max_length: 255 
  }
  
  type Password = String { 
    min_length: 8
    max_length: 128
  } [sensitive, never_log]
  
  type HashedPassword = String [sensitive, never_log, immutable]
  
  type IPAddress = String {
    pattern: /^(\d{1,3}\.){3}\d{1,3}$|^([a-fA-F0-9:]+)$/
  }
  
  type UserAgent = String { max_length: 512 }
  
  // ============================================================================
  // ENUMS
  // ============================================================================
  
  enum AuthProvider {
    LOCAL          // Email/password
    GOOGLE
    GITHUB
    MICROSOFT
    APPLE
    SAML
    OIDC
    LDAP
  }
  
  enum SessionStatus {
    ACTIVE
    EXPIRED
    REVOKED
    LOCKED
  }
  
  enum TokenType {
    ACCESS
    REFRESH
    API_KEY
    VERIFICATION
    PASSWORD_RESET
    MAGIC_LINK
    INVITE
  }
  
  enum MFAType {
    TOTP           // Time-based OTP (Google Authenticator)
    SMS
    EMAIL
    WEBAUTHN       // Hardware keys, biometrics
    RECOVERY_CODE
  }
  
  enum AuthEvent {
    LOGIN_SUCCESS
    LOGIN_FAILURE
    LOGOUT
    PASSWORD_CHANGE
    MFA_ENABLED
    MFA_DISABLED
    SESSION_CREATED
    SESSION_REVOKED
    TOKEN_ISSUED
    TOKEN_REVOKED
    ACCOUNT_LOCKED
    ACCOUNT_UNLOCKED
  }
  
  // ============================================================================
  // USER ENTITY
  // ============================================================================
  
  entity User {
    id: UserId [immutable, unique, indexed]
    
    // Identity
    email: Email [unique, indexed]
    email_verified: Boolean
    phone: String?
    phone_verified: Boolean
    
    // Credentials
    password_hash: HashedPassword?
    password_changed_at: Timestamp?
    
    // Profile
    name: String { max_length: 255 }?
    avatar_url: String?
    locale: String { pattern: /^[a-z]{2}(-[A-Z]{2})?$/ }?
    timezone: String?
    
    // Auth providers
    providers: List<LinkedProvider>
    
    // MFA
    mfa_enabled: Boolean
    mfa_methods: List<MFAMethod>
    
    // Status
    status: UserStatus
    locked_at: Timestamp?
    locked_reason: String?
    
    // Roles & Permissions
    roles: List<RoleId>
    custom_permissions: List<PermissionId>
    
    // Metadata
    metadata: Map<String, String>?
    
    // Timestamps
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    last_login_at: Timestamp?
    
    // ============================================================================
    // INVARIANTS
    // ============================================================================
    
    invariants {
      // Must have either password or external provider
      password_hash != null or providers.length > 0
      
      // Locked users have locked_at timestamp
      status == LOCKED implies locked_at != null
      
      // Email must be verified for certain operations
      mfa_enabled implies email_verified
      
      // MFA methods required if MFA enabled
      mfa_enabled implies mfa_methods.length > 0
    }
    
    // ============================================================================
    // COMPUTED
    // ============================================================================
    
    computed {
      is_active: Boolean = status == ACTIVE
      has_password: Boolean = password_hash != null
      has_mfa: Boolean = mfa_enabled and mfa_methods.length > 0
      primary_role: RoleId? = roles.first()
      
      all_permissions: Set<PermissionId> = 
        roles.flatMap(r => Role.lookup(r).permissions).toSet() 
        + custom_permissions.toSet()
    }
    
    // ============================================================================
    // METHODS
    // ============================================================================
    
    methods {
      has_permission(permission: PermissionId): Boolean {
        return permission in all_permissions or 
               all_permissions.any(p => permission.starts_with(p + ":"))
      }
      
      has_role(role: RoleId): Boolean {
        return role in roles
      }
      
      has_any_role(required_roles: List<RoleId>): Boolean {
        return roles.any(r => r in required_roles)
      }
      
      can_login(): Boolean {
        return status == ACTIVE and email_verified
      }
    }
  }
  
  enum UserStatus {
    PENDING        // Email not verified
    ACTIVE
    SUSPENDED      // Temporarily disabled
    LOCKED         // Too many failed attempts
    DELETED        // Soft deleted
  }
  
  type LinkedProvider = {
    provider: AuthProvider
    provider_user_id: String
    email: Email?
    name: String?
    avatar_url: String?
    access_token: String? [sensitive]
    refresh_token: String? [sensitive]
    linked_at: Timestamp
  }
  
  type MFAMethod = {
    type: MFAType
    verified: Boolean
    created_at: Timestamp
    last_used_at: Timestamp?
    // Type-specific data
    phone_number: String?      // For SMS
    email: Email?              // For EMAIL
    totp_secret: String? [sensitive]  // For TOTP
    webauthn_credential_id: String?   // For WEBAUTHN
    recovery_codes: List<String>? [sensitive]  // For RECOVERY_CODE
  }
  
  // ============================================================================
  // SESSION ENTITY
  // ============================================================================
  
  entity Session {
    id: SessionId [immutable, unique, indexed]
    user_id: UserId [indexed]
    
    status: SessionStatus
    
    // Device info
    ip_address: IPAddress
    user_agent: UserAgent
    device_fingerprint: String?
    
    // Location (optional, from IP)
    country: String?
    city: String?
    
    // Tokens
    access_token_id: TokenId
    refresh_token_id: TokenId?
    
    // Timestamps
    created_at: Timestamp [immutable]
    expires_at: Timestamp
    last_activity_at: Timestamp
    revoked_at: Timestamp?
    
    invariants {
      expires_at > created_at
      status == REVOKED implies revoked_at != null
    }
    
    computed {
      is_valid: Boolean = status == ACTIVE and expires_at > now()
      is_expired: Boolean = expires_at <= now()
      time_until_expiry: Duration = expires_at - now()
    }
  }
  
  // ============================================================================
  // TOKEN ENTITY
  // ============================================================================
  
  entity Token {
    id: TokenId [immutable, unique, indexed]
    type: TokenType
    
    user_id: UserId? [indexed]
    session_id: SessionId?
    
    // Token value (hashed for storage)
    token_hash: String [indexed, sensitive]
    
    // Scopes/permissions for this token
    scopes: List<String>
    
    // Timestamps
    created_at: Timestamp [immutable]
    expires_at: Timestamp
    used_at: Timestamp?
    revoked_at: Timestamp?
    
    // Usage limits
    max_uses: Int?
    use_count: Int
    
    // Metadata
    metadata: Map<String, String>?
    
    invariants {
      expires_at > created_at
      max_uses == null or use_count <= max_uses
    }
    
    computed {
      is_valid: Boolean = revoked_at == null and expires_at > now() and 
                          (max_uses == null or use_count < max_uses)
      is_expired: Boolean = expires_at <= now()
      is_exhausted: Boolean = max_uses != null and use_count >= max_uses
    }
  }
  
  // ============================================================================
  // ROLE & PERMISSION
  // ============================================================================
  
  entity Role {
    id: RoleId [unique]
    name: String
    description: String?
    
    permissions: List<PermissionId>
    
    // Hierarchy
    parent_role: RoleId?
    
    // System role (cannot be deleted)
    is_system: Boolean
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    computed {
      all_permissions: Set<PermissionId> = 
        permissions.toSet() + (parent_role != null 
          ? Role.lookup(parent_role).all_permissions 
          : {})
    }
  }
  
  entity Permission {
    id: PermissionId [unique]
    name: String
    description: String?
    resource: String      // e.g., "users", "posts"
    action: String        // e.g., "read", "write", "delete"
    
    is_system: Boolean
    
    created_at: Timestamp [immutable]
  }
  
  // ============================================================================
  // AUDIT LOG
  // ============================================================================
  
  entity AuthAuditLog {
    id: UUID [immutable, unique]
    
    event: AuthEvent
    user_id: UserId?
    session_id: SessionId?
    
    ip_address: IPAddress
    user_agent: UserAgent
    
    success: Boolean
    failure_reason: String?
    
    metadata: Map<String, String>?
    
    created_at: Timestamp [immutable]
  }
  
  // ============================================================================
  // BEHAVIORS
  // ============================================================================
  
  behavior Register {
    description: "Register a new user account"
    
    input {
      email: Email
      password: Password
      name: String?
      invite_code: String?
    }
    
    output {
      success: { user: User, verification_token: String }
      errors {
        EMAIL_ALREADY_EXISTS { when: "Email is already registered" }
        WEAK_PASSWORD { when: "Password doesn't meet requirements" }
        INVALID_INVITE { when: "Invite code is invalid or expired" }
        REGISTRATION_DISABLED { when: "Registration is disabled" }
      }
    }
    
    preconditions {
      not User.exists(email: input.email)
      input.password.length >= 8
      input.password.has_uppercase and input.password.has_lowercase and input.password.has_digit
    }
    
    postconditions {
      success implies {
        User.exists(result.user.id)
        result.user.email == input.email
        result.user.status == PENDING
        result.user.email_verified == false
      }
    }
    
    temporal {
      response within 500.ms (p99)
    }
    
    security {
      rate_limit 10/hour per ip
    }
  }
  
  behavior Login {
    description: "Authenticate user with email and password"
    
    input {
      email: Email
      password: Password
      mfa_code: String?
      device_info: DeviceInfo?
      remember_me: Boolean?
    }
    
    output {
      success: LoginResult
      errors {
        INVALID_CREDENTIALS { when: "Email or password is incorrect" }
        ACCOUNT_LOCKED { when: "Account is locked due to too many failed attempts" }
        ACCOUNT_SUSPENDED { when: "Account has been suspended" }
        EMAIL_NOT_VERIFIED { when: "Email address not verified" }
        MFA_REQUIRED { 
          when: "Multi-factor authentication required"
          returns: { mfa_token: String, available_methods: List<MFAType> }
        }
        MFA_INVALID { when: "MFA code is incorrect" }
      }
    }
    
    preconditions {
      User.exists(email: input.email)
    }
    
    postconditions {
      success implies {
        Session.exists(result.session.id)
        result.session.user_id == result.user.id
        result.session.status == ACTIVE
        result.access_token != null
      }
      
      INVALID_CREDENTIALS implies {
        // Increment failed attempt counter
        User.lookup(email: input.email).failed_attempts += 1
      }
    }
    
    temporal {
      response within 300.ms (p99)
    }
    
    security {
      rate_limit 5/minute per ip
      rate_limit 10/hour per email
    }
    
    observability {
      metrics {
        login_attempts: counter { labels: [success, provider, mfa_used] }
        login_latency: histogram { }
      }
      logs {
        success: info { include: [user_id, ip, user_agent] }
        error: warn { include: [email, ip, error_code] }
      }
    }
  }
  
  behavior Logout {
    description: "Invalidate current session"
    
    input {
      session_id: SessionId?      // Current session if not specified
      all_sessions: Boolean?      // Logout from all devices
    }
    
    output {
      success: { revoked_sessions: Int }
      errors {
        SESSION_NOT_FOUND { }
      }
    }
    
    postconditions {
      success implies {
        input.all_sessions implies {
          all(Session where user_id == actor.id, s => s.status == REVOKED)
        }
        not input.all_sessions implies {
          Session.lookup(input.session_id ?? current_session.id).status == REVOKED
        }
      }
    }
    
    security {
      requires authentication
    }
  }
  
  behavior RefreshToken {
    description: "Get new access token using refresh token"
    
    input {
      refresh_token: String
    }
    
    output {
      success: { access_token: String, refresh_token: String?, expires_in: Int }
      errors {
        TOKEN_INVALID { }
        TOKEN_EXPIRED { }
        TOKEN_REVOKED { }
        SESSION_INVALID { }
      }
    }
    
    temporal {
      response within 100.ms (p99)
    }
  }
  
  behavior VerifyEmail {
    description: "Verify email address with token"
    
    input {
      token: String
    }
    
    output {
      success: User
      errors {
        TOKEN_INVALID { }
        TOKEN_EXPIRED { }
        ALREADY_VERIFIED { }
      }
    }
    
    postconditions {
      success implies {
        result.email_verified == true
        result.status == ACTIVE
      }
    }
  }
  
  behavior RequestPasswordReset {
    description: "Request password reset email"
    
    input {
      email: Email
    }
    
    output {
      success: { message: String }  // Always success to prevent email enumeration
      errors { }
    }
    
    temporal {
      // Constant time to prevent timing attacks
      response within 500.ms exactly
    }
    
    security {
      rate_limit 3/hour per email
      rate_limit 10/hour per ip
    }
  }
  
  behavior ResetPassword {
    description: "Reset password with token"
    
    input {
      token: String
      new_password: Password
    }
    
    output {
      success: User
      errors {
        TOKEN_INVALID { }
        TOKEN_EXPIRED { }
        WEAK_PASSWORD { }
        PASSWORD_REUSED { when: "Cannot reuse recent passwords" }
      }
    }
    
    postconditions {
      success implies {
        result.password_changed_at == now()
        // All existing sessions should be revoked
        all(Session where user_id == result.id and created_at < now(), s => s.status == REVOKED)
      }
    }
  }
  
  behavior EnableMFA {
    description: "Enable multi-factor authentication"
    
    input {
      method: MFAType
      // Method-specific
      phone_number: String?
      totp_secret: String?
      webauthn_credential: WebAuthnCredential?
    }
    
    output {
      success: EnableMFAResult
      errors {
        INVALID_METHOD { }
        PHONE_INVALID { }
        ALREADY_ENABLED { when: "This MFA method is already enabled" }
      }
    }
    
    postconditions {
      success implies {
        User.lookup(actor.id).mfa_enabled == true
        User.lookup(actor.id).mfa_methods.any(m => m.type == input.method)
      }
    }
    
    security {
      requires authentication
      requires recent_authentication within 5.minutes
    }
  }
  
  behavior VerifyMFA {
    description: "Verify MFA code during login"
    
    input {
      mfa_token: String    // From MFA_REQUIRED error
      code: String
      method: MFAType?
    }
    
    output {
      success: LoginResult
      errors {
        TOKEN_INVALID { }
        CODE_INVALID { }
        METHOD_NOT_AVAILABLE { }
      }
    }
    
    temporal {
      // Constant time to prevent timing attacks
      response within 200.ms exactly
    }
  }
  
  behavior Authorize {
    description: "Check if user has permission to perform action"
    
    input {
      user_id: UserId
      permission: PermissionId
      resource_id: String?
      context: Map<String, Any>?
    }
    
    output {
      success: AuthorizationResult
      errors {
        USER_NOT_FOUND { }
      }
    }
    
    postconditions {
      success implies {
        result.allowed == User.lookup(input.user_id).has_permission(input.permission)
      }
    }
    
    temporal {
      response within 10.ms (p99)  // Must be fast for inline checks
    }
  }
  
  // ============================================================================
  // RESULT TYPES
  // ============================================================================
  
  type DeviceInfo = {
    ip_address: IPAddress
    user_agent: UserAgent
    fingerprint: String?
  }
  
  type LoginResult = {
    user: User
    session: Session
    access_token: String
    refresh_token: String?
    expires_in: Int
    token_type: String
  }
  
  type EnableMFAResult = {
    method: MFAType
    // For TOTP
    secret: String?
    qr_code_url: String?
    // For WEBAUTHN
    challenge: String?
    // Recovery codes (generated once)
    recovery_codes: List<String>?
  }
  
  type AuthorizationResult = {
    allowed: Boolean
    reason: String?
    matched_permission: PermissionId?
    matched_role: RoleId?
  }
  
  type WebAuthnCredential = {
    id: String
    public_key: String
    attestation: String
  }
  
  // ============================================================================
  // POLICIES
  // ============================================================================
  
  policy PasswordPolicy {
    applies_to: [Register, ResetPassword, ChangePassword]
    
    rules {
      input.password.length >= 8
      input.password.has_uppercase
      input.password.has_lowercase
      input.password.has_digit
      not input.password in common_passwords
      not input.password.contains(input.email.local_part)
    }
  }
  
  policy SessionPolicy {
    rules {
      // Sessions expire after inactivity
      Session.last_activity_at + config.session_idle_timeout < now() implies {
        Session.status = EXPIRED
      }
      
      // Maximum session lifetime
      Session.created_at + config.session_max_lifetime < now() implies {
        Session.status = EXPIRED
      }
      
      // Concurrent session limit
      count(Session where user_id == actor.id and status == ACTIVE) > config.max_concurrent_sessions implies {
        revoke_oldest_session
      }
    }
  }
  
  policy LockoutPolicy {
    applies_to: [Login]
    
    rules {
      // Lock account after failed attempts
      User.failed_attempts >= config.max_failed_attempts implies {
        User.status = LOCKED
        User.locked_at = now()
        User.locked_reason = "Too many failed login attempts"
      }
      
      // Auto-unlock after cooldown
      User.status == LOCKED and User.locked_at + config.lockout_duration < now() implies {
        User.status = ACTIVE
        User.failed_attempts = 0
      }
    }
  }
  
  // ============================================================================
  // INVARIANTS
  // ============================================================================
  
  invariants SecurityInvariants {
    scope: global
    
    always {
      // Passwords are never stored in plain text
      all(User, u => u.password_hash == null or u.password_hash.starts_with("$"))
      
      // Sensitive tokens are hashed
      all(Token, t => t.token_hash.length == 64)  // SHA-256
      
      // Expired sessions cannot be active
      all(Session, s => s.expires_at < now() implies s.status != ACTIVE)
      
      // Revoked tokens cannot be valid
      all(Token, t => t.revoked_at != null implies not t.is_valid)
    }
  }
}
