# SaaS Application Example
# Demonstrates using stdlib modules together

domain SaaSApp version "1.0.0"

import { InitiateOAuth, ExchangeOAuthCode } from "@isl/stdlib/auth/oauth-login"
import { CreateSession, ValidateSession, RevokeAllUserSessions } from "@isl/stdlib/auth/session-create"
import { RequestPasswordReset, ResetPassword } from "@isl/stdlib/auth/password-reset"
import { CheckLoginRateLimit, RecordLoginAttempt } from "@isl/stdlib/auth/rate-limit-login"
import { CreateSubscription, CancelSubscription, ChangePlan } from "@isl/stdlib/payments/subscription-create"
import { CreatePayment, ProcessPaymentIntent } from "@isl/stdlib/payments/process-payment"
import { ReceiveWebhook, ProcessWebhook } from "@isl/stdlib/payments/webhook-handle"
import { InitiateImageUpload, CompleteImageUpload } from "@isl/stdlib/uploads/upload-image"
import { ValidateMimeType } from "@isl/stdlib/uploads/validate-mime"

# ============================================
# Domain Types
# ============================================

type UserId = UUID { immutable: true, unique: true }

entity User {
  id: UserId [immutable, unique]
  email: String { format: "email" } [unique, indexed]
  name: String { max_length: 100 }
  avatar_url: String?
  subscription_id: UUID?
  created_at: Timestamp [immutable]
  updated_at: Timestamp
}

# ============================================
# Authentication Flows
# ============================================

behavior OAuthSignIn {
  description: "Sign in with OAuth provider"

  input {
    provider: enum { GOOGLE, GITHUB }
    redirect_uri: String
  }

  output {
    success: { authorization_url: String, state: String }
    errors { PROVIDER_ERROR }
  }

  flow {
    step 1: InitiateOAuth(
      provider: input.provider,
      redirect_uri: input.redirect_uri,
      scopes: ["email", "profile"]
    )
  }
}

behavior OAuthCallback {
  description: "Handle OAuth callback and create session"

  input {
    provider: enum { GOOGLE, GITHUB }
    code: String
    state: String
    redirect_uri: String
    ip_address: String
    user_agent: String?
  }

  output {
    success: { user: User, session_token: String }
    errors { INVALID_CODE, USER_CREATION_FAILED }
  }

  flow {
    step 1: ExchangeOAuthCode(
      provider: input.provider,
      code: input.code,
      state: input.state,
      redirect_uri: input.redirect_uri
    )
    
    step 2: find_or_create_user(oauth_credential)
    
    step 3: CreateSession(
      user_id: user.id,
      ip_address: input.ip_address,
      user_agent: input.user_agent
    )
  }

  post success {
    User.exists(result.user.id)
    result.session_token.length >= 64
  }
}

behavior SecureLogin {
  description: "Email/password login with rate limiting"

  input {
    email: String { format: "email" }
    password: String { min_length: 8 }
    ip_address: String
    user_agent: String?
  }

  output {
    success: { user: User, session_token: String }
    errors { 
      RATE_LIMITED { retriable: true }
      INVALID_CREDENTIALS 
      USER_LOCKED
    }
  }

  flow {
    step 1: CheckLoginRateLimit(email: input.email, ip_address: input.ip_address)
    
    step 2: authenticate_user(input.email, input.password)
    
    step 3: RecordLoginAttempt(
      email: input.email,
      ip_address: input.ip_address,
      success: true
    )
    
    step 4: CreateSession(
      user_id: user.id,
      ip_address: input.ip_address,
      user_agent: input.user_agent
    )
  }

  post failure INVALID_CREDENTIALS {
    RecordLoginAttempt(email: input.email, ip_address: input.ip_address, success: false)
  }
}

behavior ForgotPassword {
  description: "Initiate password reset"

  input {
    email: String { format: "email" }
    ip_address: String
  }

  output {
    success: { message: String }
    errors { RATE_LIMITED }
  }

  flow {
    step 1: CheckLoginRateLimit(email: input.email, ip_address: input.ip_address)
    step 2: RequestPasswordReset(email: input.email, ip_address: input.ip_address)
  }

  # Always return success to prevent email enumeration
  post success {
    result.message == "If an account exists, a reset email has been sent"
  }
}

behavior ChangePassword {
  description: "Reset password with token"

  input {
    token: String
    new_password: String { min_length: 8 }
    confirm_password: String
  }

  output {
    success: Boolean
    errors { INVALID_TOKEN, PASSWORDS_DO_NOT_MATCH, PASSWORD_TOO_WEAK }
  }

  flow {
    step 1: ResetPassword(
      token: input.token,
      new_password: input.new_password,
      confirm_password: input.confirm_password
    )
    
    # Revoke all existing sessions after password change
    step 2: RevokeAllUserSessions(user_id: user.id, reason: "Password changed")
  }
}

# ============================================
# Subscription Flows
# ============================================

behavior Subscribe {
  description: "Subscribe to a plan"

  actors {
    user: User { authenticated: true }
  }

  input {
    plan_id: UUID
    payment_method_id: UUID
  }

  output {
    success: { subscription_id: UUID }
    errors { PLAN_NOT_FOUND, PAYMENT_FAILED, ALREADY_SUBSCRIBED }
  }

  pre {
    User.lookup(user.id).subscription_id == null
  }

  flow {
    step 1: CreateSubscription(
      customer_id: user.id,
      plan_id: input.plan_id,
      payment_method_id: input.payment_method_id
    )
    
    step 2: update_user_subscription(user.id, subscription.id)
  }

  post success {
    User.lookup(user.id).subscription_id == result.subscription_id
  }
}

behavior UpgradePlan {
  description: "Upgrade to a higher plan"

  actors {
    user: User { authenticated: true }
  }

  input {
    new_plan_id: UUID
  }

  output {
    success: { subscription_id: UUID, proration_amount: Decimal? }
    errors { NO_SUBSCRIPTION, PLAN_NOT_FOUND, SAME_PLAN }
  }

  pre {
    User.lookup(user.id).subscription_id != null
  }

  flow {
    step 1: ChangePlan(
      subscription_id: user.subscription_id,
      new_plan_id: input.new_plan_id,
      prorate: true
    )
  }
}

behavior CancelSubscriptionFlow {
  description: "Cancel subscription at period end"

  actors {
    user: User { authenticated: true }
  }

  input {
    reason: String?
    immediately: Boolean [default: false]
  }

  output {
    success: { cancelled_at: Timestamp? }
    errors { NO_SUBSCRIPTION, ALREADY_CANCELLED }
  }

  pre {
    User.lookup(user.id).subscription_id != null
  }

  flow {
    step 1: CancelSubscription(
      subscription_id: user.subscription_id,
      cancel_immediately: input.immediately,
      reason: input.reason
    )
  }
}

# ============================================
# File Upload Flows
# ============================================

behavior UploadAvatar {
  description: "Upload user avatar image"

  actors {
    user: User { authenticated: true }
  }

  input {
    filename: String
    content_type: String
  }

  output {
    success: { upload_url: String, session_id: UUID }
    errors { INVALID_CONTENT_TYPE, SIZE_EXCEEDED }
  }

  pre {
    input.content_type in ["image/jpeg", "image/png", "image/webp"]
  }

  flow {
    step 1: InitiateImageUpload(
      user_id: user.id,
      filename: input.filename,
      content_type: input.content_type,
      max_size_bytes: 5242880,  # 5MB
      allowed_formats: [JPEG, PNG, WEBP]
    )
  }
}

behavior CompleteAvatarUpload {
  description: "Complete avatar upload and update user"

  actors {
    user: User { authenticated: true }
  }

  input {
    session_id: UUID
  }

  output {
    success: { avatar_url: String }
    errors { SESSION_NOT_FOUND, INVALID_IMAGE, PROCESSING_FAILED }
  }

  flow {
    step 1: CompleteImageUpload(
      session_id: input.session_id,
      generate_thumbnails: true,
      thumbnail_sizes: [SMALL, MEDIUM]
    )
    
    step 2: update_user_avatar(user.id, image.public_url)
  }

  post success {
    User.lookup(user.id).avatar_url == result.avatar_url
  }
}

# ============================================
# Webhook Handlers
# ============================================

behavior HandleStripeWebhook {
  description: "Process Stripe webhooks"

  input {
    payload: String
    signature: String
    headers: Map<String, String>
  }

  output {
    success: { processed: Boolean }
    errors { INVALID_SIGNATURE, PROCESSING_FAILED }
  }

  flow {
    step 1: ReceiveWebhook(
      provider: STRIPE,
      payload: input.payload,
      signature: input.signature,
      headers: input.headers
    )
    
    step 2: ProcessWebhook(webhook_id: event.id)
  }
}

# ============================================
# Middleware / Guards
# ============================================

guard Authenticated {
  description: "Require valid session"
  
  check {
    ValidateSession(token: request.session_token).success
  }
  
  on_failure {
    error UNAUTHORIZED
  }
}

guard HasSubscription {
  description: "Require active subscription"
  
  check {
    User.lookup(user.id).subscription_id != null
    Subscription.lookup(user.subscription_id).status == ACTIVE
  }
  
  on_failure {
    error SUBSCRIPTION_REQUIRED
  }
}
