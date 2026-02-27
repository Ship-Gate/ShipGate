// ============================================================================
// ISL Standard Library Integration Example
// Demonstrates how stdlib imports resolve and verify
// ============================================================================

domain StdlibIntegrationExample version "1.0.0" {
  description: "Complete example showing stdlib-auth, stdlib-rate-limit, stdlib-payments, and stdlib-audit integration"
  owner: "examples@intentos.dev"
}

// ============================================================================
// IMPORTS - These resolve to stdlib packages
// ============================================================================

// Auth module - resolves to @isl-lang/stdlib-auth
import { User, Session } from "@isl/stdlib-auth"
import { CreateSession, ValidateSession, RevokeSession } from "@isl/stdlib-auth/session"
import { CheckLoginRateLimit, RecordLoginAttempt } from "@isl/stdlib-auth/rate-limit"

// Payments module - resolves to @isl-lang/stdlib-payments  
import { Payment, PaymentStatus } from "@isl/stdlib-payments"
import { CreatePayment, ProcessPaymentIntent } from "@isl/stdlib-payments/payments"
import { CreateSubscription, CancelSubscription } from "@isl/stdlib-payments/subscriptions"

// Rate limit module - resolves to @isl-lang/stdlib-rate-limit
import { RateLimitAction, IdentifierType } from "@isl/stdlib-rate-limit"
import { CheckRateLimit, CheckAndIncrement, GetBucketStatus } from "@isl/stdlib-rate-limit/check"
import { BlockIdentifier, UnblockIdentifier } from "@isl/stdlib-rate-limit/block"

// Audit module - resolves to @isl-lang/stdlib-audit
import { AuditEvent, EventCategory, EventOutcome } from "@isl/stdlib-audit"
import { Record as AuditRecord, RecordBatch } from "@isl/stdlib-audit/record"
import { Query as AuditQuery } from "@isl/stdlib-audit/query"

// ============================================================================
// DOMAIN-SPECIFIC TYPES
// ============================================================================

type CustomerId = UUID { format: "customer_*" }

type SubscriptionTier = enum {
  FREE
  PRO
  ENTERPRISE
}

// ============================================================================
// ENTITIES (Extending stdlib entities)
// ============================================================================

/**
 * Customer extends stdlib User with subscription info
 */
entity Customer extends User {
  tier: SubscriptionTier [default: FREE]
  stripe_customer_id: String?
  subscription_id: UUID?
  created_at: Timestamp [immutable]
  
  invariants {
    tier == ENTERPRISE implies stripe_customer_id != null
  }
}

// ============================================================================
// BEHAVIORS
// ============================================================================

/**
 * Secure Login - Demonstrates stdlib-auth + stdlib-rate-limit + stdlib-audit
 * 
 * This behavior shows how multiple stdlib modules compose together:
 * 1. Rate limiting protects against brute-force attacks
 * 2. Authentication validates credentials
 * 3. Session management creates secure tokens
 * 4. Audit logging tracks security events
 */
behavior SecureLogin {
  description: "Authenticate user with rate limiting and audit logging"
  
  input {
    email: String { format: "email" }
    password: String { min_length: 8, sensitive: true }
    ip_address: String
    user_agent: String?
  }
  
  output {
    success: {
      session: Session
      token: String [sensitive]
      user: Customer
    }
    
    errors {
      INVALID_CREDENTIALS {
        when: "Email or password is incorrect"
        retriable: false
      }
      RATE_LIMITED {
        when: "Too many login attempts"
        retriable: true
        retry_after: varies
      }
      ACCOUNT_LOCKED {
        when: "Account has been locked due to violations"
        retriable: false
      }
    }
  }
  
  // Use stdlib rate limiting
  flow {
    // Step 1: Check rate limit (stdlib-rate-limit)
    step rate_check: CheckLoginRateLimit(
      email: input.email,
      ip_address: input.ip_address
    )
    
    when rate_check.action == DENY or rate_check.action == BLOCK {
      // Log rate limit violation (stdlib-audit)
      AuditRecord(
        action: "login.rate_limited",
        category: SECURITY_EVENT,
        outcome: FAILURE,
        actor: { id: input.email, type: ANONYMOUS, ip_address: input.ip_address }
      )
      return error RATE_LIMITED { retry_after: rate_check.retry_after }
    }
    
    // Step 2: Authenticate user
    step auth: authenticate(input.email, input.password)
    
    when not auth.success {
      // Record failed attempt (stdlib-auth)
      RecordLoginAttempt(
        email: input.email,
        ip_address: input.ip_address,
        success: false,
        failure_reason: "invalid_credentials"
      )
      
      // Log failed login (stdlib-audit)
      AuditRecord(
        action: "login.failed",
        category: AUTHENTICATION,
        outcome: FAILURE,
        actor: { id: input.email, type: ANONYMOUS, ip_address: input.ip_address }
      )
      
      return error INVALID_CREDENTIALS
    }
    
    // Step 3: Create session (stdlib-auth)
    step session: CreateSession(
      user_id: auth.user.id,
      ip_address: input.ip_address,
      user_agent: input.user_agent
    )
    
    // Step 4: Record successful login
    RecordLoginAttempt(
      email: input.email,
      ip_address: input.ip_address,
      success: true
    )
    
    // Step 5: Audit successful login (stdlib-audit)
    AuditRecord(
      action: "login.success",
      category: AUTHENTICATION,
      outcome: SUCCESS,
      actor: { 
        id: auth.user.id, 
        type: USER,
        email: input.email,
        ip_address: input.ip_address
      }
    )
    
    return success {
      session: session.session,
      token: session.token,
      user: auth.user
    }
  }
  
  temporal {
    within 500ms (p50): response returned
    within 2s (p99): response returned
    eventually within 5s: audit_event_persisted
  }
  
  security {
    rate_limit 5 per 15 minutes per email
    rate_limit 20 per 15 minutes per ip
    audit_log required
  }
}

/**
 * Process Subscription Payment - Demonstrates stdlib-payments + stdlib-audit
 */
behavior ProcessSubscriptionPayment {
  description: "Create and process a subscription payment"
  
  input {
    customer_id: CustomerId
    plan: SubscriptionTier
    payment_method_id: String
  }
  
  output {
    success: {
      payment: Payment
      subscription_id: UUID
    }
    
    errors {
      CUSTOMER_NOT_FOUND {
        when: "Customer does not exist"
        retriable: false
      }
      PAYMENT_FAILED {
        when: "Payment could not be processed"
        retriable: true
      }
      ALREADY_SUBSCRIBED {
        when: "Customer already has active subscription"
        retriable: false
      }
    }
  }
  
  flow {
    // Step 1: Verify customer exists
    step customer: Customer.lookup(input.customer_id)
    
    when customer == null {
      return error CUSTOMER_NOT_FOUND
    }
    
    // Step 2: Check for existing subscription
    when customer.subscription_id != null {
      return error ALREADY_SUBSCRIBED
    }
    
    // Step 3: Calculate amount based on plan
    step amount: calculate_plan_price(input.plan)
    
    // Step 4: Create payment (stdlib-payments)
    step payment: CreatePayment(
      customer_id: input.customer_id,
      amount: amount,
      currency: USD,
      method: CARD,
      description: "Subscription: " + input.plan,
      idempotency_key: customer_id + "-" + now().format("YYYY-MM-DD")
    )
    
    // Step 5: Process payment (stdlib-payments)
    step processed: ProcessPaymentIntent(
      payment_id: payment.id,
      save_card: true
    )
    
    when processed.status == FAILED {
      AuditRecord(
        action: "subscription.payment_failed",
        category: DATA_MODIFICATION,
        outcome: FAILURE,
        actor: { id: customer.id, type: USER },
        resource: { type: "Payment", id: payment.id }
      )
      return error PAYMENT_FAILED
    }
    
    // Step 6: Create subscription (stdlib-payments)
    step subscription: CreateSubscription(
      customer_id: input.customer_id,
      plan_id: plan_to_stripe_id(input.plan),
      default_payment_method: input.payment_method_id
    )
    
    // Step 7: Update customer
    step update: Customer.update(input.customer_id, {
      tier: input.plan,
      subscription_id: subscription.id
    })
    
    // Step 8: Audit the subscription creation
    AuditRecord(
      action: "subscription.created",
      category: DATA_MODIFICATION,
      outcome: SUCCESS,
      actor: { id: customer.id, type: USER },
      resource: { type: "Subscription", id: subscription.id },
      changes: [
        { field: "tier", old_value: customer.tier, new_value: input.plan }
      ]
    )
    
    return success {
      payment: processed,
      subscription_id: subscription.id
    }
  }
  
  temporal {
    within 5s (p99): response returned
    eventually within 1m: subscription_confirmation_email_sent
  }
}

/**
 * API Rate Limiter - Demonstrates stdlib-rate-limit for API protection
 */
behavior RateLimitedAPICall {
  description: "Generic rate-limited API call wrapper"
  
  input {
    api_key: String
    endpoint: String
    method: String
    body: Map<String, Any>?
  }
  
  output {
    success: {
      response: Any
      rate_limit_info: {
        remaining: Int
        limit: Int
        reset_at: Timestamp
      }
    }
    
    errors {
      RATE_LIMITED {
        when: "API rate limit exceeded"
        retriable: true
        retry_after: varies
      }
      UNAUTHORIZED {
        when: "Invalid API key"
        retriable: false
      }
    }
  }
  
  flow {
    // Step 1: Check rate limit (stdlib-rate-limit)
    step rate_check: CheckAndIncrement(
      key: input.api_key,
      identifier_type: API_KEY,
      config_name: "api-tier-" + get_api_tier(input.api_key),
      weight: get_endpoint_weight(input.endpoint)
    )
    
    when not rate_check.allowed {
      AuditRecord(
        action: "api.rate_limited",
        category: SECURITY_EVENT,
        outcome: FAILURE,
        actor: { id: input.api_key, type: SERVICE },
        metadata: { endpoint: input.endpoint }
      )
      
      return error RATE_LIMITED {
        retry_after: rate_check.retry_after,
        headers: rate_check.headers
      }
    }
    
    // Step 2: Process the API call
    step response: process_api_call(input.endpoint, input.method, input.body)
    
    // Step 3: Log API access
    AuditRecord(
      action: "api.request",
      category: DATA_ACCESS,
      outcome: SUCCESS,
      actor: { id: input.api_key, type: SERVICE },
      metadata: { endpoint: input.endpoint, method: input.method }
    )
    
    return success {
      response: response,
      rate_limit_info: {
        remaining: rate_check.remaining,
        limit: rate_check.limit,
        reset_at: rate_check.reset_at
      }
    }
  }
  
  temporal {
    within 100ms (p50): response returned
    within 500ms (p99): response returned
  }
}

// ============================================================================
// SCENARIOS - Test cases that verify stdlib integration
// ============================================================================

scenarios SecureLogin {
  scenario "successful login within rate limit" {
    given {
      user = Customer.create(email: "test@example.com", password_hash: hash("Password123"))
      // No previous login attempts
    }
    
    when {
      result = SecureLogin(
        email: "test@example.com",
        password: "Password123",
        ip_address: "192.168.1.1"
      )
    }
    
    then {
      result is success
      result.session != null
      result.token.length >= 64
      result.user.id == user.id
      
      // Verify audit event was created
      audit = AuditQuery.latest(actor_id: user.id, action: "login.success")
      audit != null
      audit.outcome == SUCCESS
    }
  }
  
  scenario "blocked after too many failed attempts" {
    given {
      user = Customer.create(email: "test@example.com")
      // Simulate 5 failed attempts
      for i in 1..5 {
        RecordLoginAttempt(email: "test@example.com", ip_address: "192.168.1.1", success: false)
      }
    }
    
    when {
      result = SecureLogin(
        email: "test@example.com",
        password: "wrong_password",
        ip_address: "192.168.1.1"
      )
    }
    
    then {
      result is RATE_LIMITED
      result.retry_after > 0
    }
  }
}

scenarios ProcessSubscriptionPayment {
  scenario "successful subscription upgrade" {
    given {
      customer = Customer.create(tier: FREE, stripe_customer_id: "cus_123")
    }
    
    when {
      result = ProcessSubscriptionPayment(
        customer_id: customer.id,
        plan: PRO,
        payment_method_id: "pm_123"
      )
    }
    
    then {
      result is success
      result.payment.status == COMPLETED
      result.subscription_id != null
      
      // Verify customer was updated
      updated = Customer.lookup(customer.id)
      updated.tier == PRO
      updated.subscription_id == result.subscription_id
      
      // Verify audit trail
      audit = AuditQuery.latest(resource_type: "Subscription", action: "subscription.created")
      audit != null
      audit.changes[0].field == "tier"
      audit.changes[0].old_value == "FREE"
      audit.changes[0].new_value == "PRO"
    }
  }
}
