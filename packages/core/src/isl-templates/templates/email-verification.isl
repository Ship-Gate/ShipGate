# Email Verification Domain
# Complete email verification flow with token management

domain EmailVerification {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type VerificationToken = String { min_length: 32, max_length: 64 }
  type VerificationCode = String { length: 6 }  # 6-digit code
  
  enum VerificationStatus {
    PENDING
    VERIFIED
    EXPIRED
    BOUNCED
  }
  
  enum VerificationType {
    REGISTRATION
    EMAIL_CHANGE
    RECONFIRMATION
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity EmailVerificationRequest {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    email: String { format: "email" } [indexed]
    token_hash: String [indexed]
    code: VerificationCode?
    verification_type: VerificationType
    status: VerificationStatus [default: PENDING]
    attempts: Int [default: 0]
    max_attempts: Int [default: 5]
    ip_address: String?
    expires_at: Timestamp
    verified_at: Timestamp?
    created_at: Timestamp [immutable]
    
    invariants {
      expires_at > created_at
      attempts <= max_attempts
      verified_at != null implies status == VERIFIED
    }
    
    lifecycle {
      PENDING -> VERIFIED
      PENDING -> EXPIRED
      PENDING -> BOUNCED
    }
  }
  
  entity VerifiedEmail {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    email: String { format: "email" } [unique, indexed]
    is_primary: Boolean [default: false]
    verified_at: Timestamp [immutable]
    
    invariants {
      // User can have at most one primary email
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior SendVerificationEmail {
    description: "Send a verification email with token/code"
    
    actors {
      User { must: authenticated }
      System { }
    }
    
    input {
      user_id: UUID
      email: String { format: "email" }
      verification_type: VerificationType
      use_code: Boolean [default: false]  # Use 6-digit code instead of link
    }
    
    output {
      success: {
        request_id: UUID
        expires_at: Timestamp
      }
      
      errors {
        EMAIL_ALREADY_VERIFIED {
          when: "Email is already verified for this user"
          retriable: false
        }
        EMAIL_IN_USE {
          when: "Email is already used by another account"
          retriable: false
        }
        TOO_MANY_REQUESTS {
          when: "Too many verification requests"
          retriable: true
          retry_after: 5m
        }
        INVALID_EMAIL {
          when: "Email address is invalid"
          retriable: false
        }
      }
    }
    
    preconditions {
      User.exists(input.user_id)
      not VerifiedEmail.exists(email: input.email)
    }
    
    postconditions {
      success implies {
        EmailVerificationRequest.exists(result.request_id)
        EmailVerificationRequest.lookup(result.request_id).status == PENDING
      }
    }
    
    temporal {
      response within 500ms
      eventually within 1m: email_delivered
    }
    
    security {
      rate_limit 5 per hour per user
      rate_limit 3 per hour per email
    }
    
    effects {
      Email { send_verification }
    }
  }
  
  behavior VerifyEmailByToken {
    description: "Verify email using token link"
    
    actors {
      Anonymous { }
    }
    
    input {
      token: VerificationToken
    }
    
    output {
      success: {
        email: String
        verified: Boolean
      }
      
      errors {
        INVALID_TOKEN {
          when: "Token is invalid or expired"
          retriable: false
        }
        ALREADY_VERIFIED {
          when: "Email is already verified"
          retriable: false
        }
        TOKEN_EXPIRED {
          when: "Verification token has expired"
          retriable: false
        }
      }
    }
    
    preconditions {
      EmailVerificationRequest.exists_by_hash(hash(input.token))
      EmailVerificationRequest.lookup_by_hash(hash(input.token)).status == PENDING
      EmailVerificationRequest.lookup_by_hash(hash(input.token)).expires_at > now()
    }
    
    postconditions {
      success implies {
        EmailVerificationRequest.lookup_by_hash(hash(input.token)).status == VERIFIED
        VerifiedEmail.exists(email: result.email)
        User.lookup(request.user_id).email_verified == true
      }
    }
    
    temporal {
      response within 200ms
    }
  }
  
  behavior VerifyEmailByCode {
    description: "Verify email using 6-digit code"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      code: VerificationCode
      email: String { format: "email" }
    }
    
    output {
      success: {
        email: String
        verified: Boolean
      }
      
      errors {
        INVALID_CODE {
          when: "Verification code is incorrect"
          retriable: true
        }
        CODE_EXPIRED {
          when: "Verification code has expired"
          retriable: false
        }
        MAX_ATTEMPTS_EXCEEDED {
          when: "Too many incorrect attempts"
          retriable: false
        }
        NO_PENDING_VERIFICATION {
          when: "No pending verification for this email"
          retriable: false
        }
      }
    }
    
    preconditions {
      EmailVerificationRequest.exists(
        user_id: actor.id,
        email: input.email,
        status: PENDING
      )
    }
    
    postconditions {
      success implies {
        EmailVerificationRequest.lookup(request_id).status == VERIFIED
        VerifiedEmail.exists(email: input.email)
      }
      
      INVALID_CODE implies {
        EmailVerificationRequest.lookup(request_id).attempts == 
          old(EmailVerificationRequest.lookup(request_id).attempts) + 1
      }
    }
    
    security {
      rate_limit 10 per hour per user
      brute_force_protection enabled
    }
  }
  
  behavior ResendVerification {
    description: "Resend verification email"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      email: String { format: "email" }
    }
    
    output {
      success: {
        request_id: UUID
        expires_at: Timestamp
      }
      
      errors {
        EMAIL_ALREADY_VERIFIED {
          when: "Email is already verified"
          retriable: false
        }
        TOO_MANY_REQUESTS {
          when: "Please wait before requesting another email"
          retriable: true
          retry_after: 1m
        }
      }
    }
    
    security {
      rate_limit 3 per hour per email
    }
  }
  
  behavior ChangeEmail {
    description: "Change user's email address with verification"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      new_email: String { format: "email" }
      password: String [sensitive]  # Require password for security
    }
    
    output {
      success: {
        request_id: UUID
        message: String
      }
      
      errors {
        INVALID_PASSWORD {
          when: "Password is incorrect"
          retriable: true
        }
        EMAIL_IN_USE {
          when: "Email is already used by another account"
          retriable: false
        }
        SAME_EMAIL {
          when: "New email is same as current email"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        EmailVerificationRequest.exists(
          user_id: actor.id,
          email: input.new_email,
          verification_type: EMAIL_CHANGE
        )
        // Old email still active until new one is verified
        User.lookup(actor.id).email == old(User.lookup(actor.id).email)
      }
    }
    
    temporal {
      eventually within 5m: verification_email_sent
    }
  }
  
  behavior RemoveEmail {
    description: "Remove a verified email from account"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      email: String { format: "email" }
    }
    
    output {
      success: Boolean
      
      errors {
        EMAIL_NOT_FOUND {
          when: "Email is not associated with this account"
          retriable: false
        }
        CANNOT_REMOVE_PRIMARY {
          when: "Cannot remove primary email"
          retriable: false
        }
        LAST_EMAIL {
          when: "Cannot remove the only email on account"
          retriable: false
        }
      }
    }
    
    preconditions {
      VerifiedEmail.exists(user_id: actor.id, email: input.email)
      VerifiedEmail.count(user_id: actor.id) > 1
      not VerifiedEmail.lookup(actor.id, input.email).is_primary
    }
    
    postconditions {
      success implies {
        not VerifiedEmail.exists(user_id: actor.id, email: input.email)
      }
    }
  }
  
  behavior SetPrimaryEmail {
    description: "Set a verified email as primary"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      email: String { format: "email" }
    }
    
    output {
      success: VerifiedEmail
      
      errors {
        EMAIL_NOT_VERIFIED {
          when: "Email is not verified"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        VerifiedEmail.lookup(actor.id, input.email).is_primary == true
        VerifiedEmail.count(user_id: actor.id, is_primary: true) == 1
      }
    }
  }
  
  behavior CleanupExpiredRequests {
    description: "Clean up expired verification requests"
    
    actors {
      System { }
    }
    
    output {
      success: {
        expired_count: Int
        deleted_count: Int
      }
    }
    
    temporal {
      runs every 1h
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios VerifyEmailByToken {
    scenario "successful verification" {
      given {
        request = EmailVerificationRequest.create(
          user_id: user.id,
          email: "test@example.com",
          status: PENDING,
          expires_at: now() + 24h
        )
      }
      
      when {
        result = VerifyEmailByToken(token: request.token)
      }
      
      then {
        result is success
        result.verified == true
        VerifiedEmail.exists(email: "test@example.com")
      }
    }
    
    scenario "expired token" {
      given {
        request = EmailVerificationRequest.create(
          user_id: user.id,
          email: "test@example.com",
          status: PENDING,
          expires_at: now() - 1h
        )
      }
      
      when {
        result = VerifyEmailByToken(token: request.token)
      }
      
      then {
        result is TOKEN_EXPIRED
      }
    }
  }
  
  scenarios VerifyEmailByCode {
    scenario "correct code" {
      given {
        request = EmailVerificationRequest.create(
          user_id: user.id,
          email: "test@example.com",
          code: "123456",
          status: PENDING
        )
      }
      
      when {
        result = VerifyEmailByCode(
          code: "123456",
          email: "test@example.com"
        )
      }
      
      then {
        result is success
        result.verified == true
      }
    }
    
    scenario "incorrect code increments attempts" {
      given {
        request = EmailVerificationRequest.create(
          user_id: user.id,
          email: "test@example.com",
          code: "123456",
          attempts: 0
        )
      }
      
      when {
        result = VerifyEmailByCode(
          code: "000000",
          email: "test@example.com"
        )
      }
      
      then {
        result is INVALID_CODE
        EmailVerificationRequest.lookup(request.id).attempts == 1
      }
    }
  }
}
