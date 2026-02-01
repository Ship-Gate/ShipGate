# Registration Behaviors
# User signup, email verification, password management

import { Auth } from "../domain.isl"

# ============================================
# Register
# ============================================

behavior Register {
  description: "Create new user account"
  
  actors {
    Anonymous {
      for: self_registration
    }
    Admin {
      for: admin_registration
    }
  }
  
  input {
    email: Email
    password: Password
    username: Username?
    phone: PhoneNumber?
    
    # Optional profile
    name: String?
    
    # Consent
    terms_accepted: Boolean
    marketing_consent: Boolean?
    
    # Invitation
    invite_code: String?
  }
  
  output {
    success: {
      user: User
      verification_required: Boolean
      verification_sent_to: String?
    }
    
    errors {
      EMAIL_EXISTS {
        when: "Email already registered"
        retriable: false
      }
      USERNAME_EXISTS {
        when: "Username already taken"
        retriable: false
      }
      WEAK_PASSWORD {
        when: "Password does not meet policy"
        retriable: true
        data: { requirements: List<String> }
      }
      INVALID_INVITE {
        when: "Invite code invalid or expired"
        retriable: false
      }
      REGISTRATION_DISABLED {
        when: "Public registration is disabled"
        retriable: false
      }
    }
  }
  
  preconditions {
    # Valid email
    input.email != null
    input.email.is_valid_email
    
    # Password meets policy
    input.password.length >= config.password_policy.min_length
    
    # Terms accepted
    input.terms_accepted == true
  }
  
  postconditions {
    success implies {
      - User.exists(email: input.email)
      - User.password_hash == hash(input.password)
      - User.status == PENDING_VERIFICATION
      - result.verification_required == true
      - verification_email_sent(input.email)
      - AuditLog.created(action: USER_CREATED)
    }
  }
  
  invariants {
    - password hashed with bcrypt (cost >= 12)
    - verification token expires in 24 hours
    - rate limit prevents mass registration
  }
  
  security {
    - rate_limit 3 per hour per IP
    - captcha_required after 1 attempt
  }
}

# ============================================
# Verify Email
# ============================================

behavior VerifyEmail {
  description: "Verify email with token"
  
  input {
    token: String
  }
  
  output {
    success: {
      user: User
    }
    
    errors {
      INVALID_TOKEN {
        when: "Token invalid or expired"
        retriable: false
      }
      ALREADY_VERIFIED {
        when: "Email already verified"
        retriable: false
      }
    }
  }
  
  postconditions {
    success implies {
      - User.email_verified == true
      - User.status == ACTIVE
      - verification_token consumed (single use)
    }
  }
}

# ============================================
# Request Password Reset
# ============================================

behavior RequestPasswordReset {
  description: "Send password reset email"
  
  input {
    email: Email
  }
  
  output {
    success: {
      message: "If account exists, reset email sent"
    }
    
    # No errors exposed - prevents email enumeration
  }
  
  preconditions {
    input.email != null
  }
  
  postconditions {
    # Always returns success to prevent enumeration
    User.exists(email: input.email) implies {
      - password_reset_email_sent(input.email)
      - reset_token_created with expiry 1.hour
    }
  }
  
  security {
    - rate_limit 3 per hour per email
    - constant_time response (prevent timing attacks)
  }
}

# ============================================
# Reset Password
# ============================================

behavior ResetPassword {
  description: "Set new password with reset token"
  
  input {
    token: String
    new_password: Password
  }
  
  output {
    success: {
      message: "Password reset successfully"
    }
    
    errors {
      INVALID_TOKEN {
        when: "Token invalid or expired"
        retriable: false
      }
      WEAK_PASSWORD {
        when: "Password does not meet policy"
        retriable: true
      }
      PASSWORD_RECENTLY_USED {
        when: "Password was used recently"
        retriable: true
      }
    }
  }
  
  postconditions {
    success implies {
      - User.password_hash == hash(input.new_password)
      - reset_token consumed
      - all_sessions_revoked  # Force re-login
      - AuditLog.created(action: PASSWORD_RESET)
      - notification_email_sent
    }
  }
}

# ============================================
# Change Password
# ============================================

behavior ChangePassword {
  description: "Change password for authenticated user"
  
  actors {
    User {
      requires: authenticated
    }
  }
  
  input {
    current_password: Password
    new_password: Password
  }
  
  output {
    success: {}
    
    errors {
      INCORRECT_PASSWORD {
        when: "Current password is wrong"
        retriable: true
      }
      WEAK_PASSWORD {
        when: "New password does not meet policy"
        retriable: true
      }
      SAME_PASSWORD {
        when: "New password same as current"
        retriable: true
      }
    }
  }
  
  preconditions {
    context.authenticated
    input.current_password != null
    input.new_password != null
    input.new_password != input.current_password
  }
  
  postconditions {
    success implies {
      - User.password_hash == hash(input.new_password)
      - other_sessions_revoked (except current)
      - AuditLog.created(action: PASSWORD_CHANGED)
      - notification_email_sent
    }
  }
}

# ============================================
# Scenarios
# ============================================

scenarios Register {
  scenario "successful registration" {
    when {
      result = Register(
        email: "newuser@example.com",
        password: "SecurePass123!",
        terms_accepted: true
      )
    }
    
    then {
      result is success
      result.verification_required == true
      User.exists(email: "newuser@example.com")
    }
  }
  
  scenario "duplicate email" {
    given {
      User exists with email "existing@example.com"
    }
    
    when {
      result = Register(
        email: "existing@example.com",
        password: "SecurePass123!",
        terms_accepted: true
      )
    }
    
    then {
      result is error EMAIL_EXISTS
    }
  }
  
  scenario "weak password rejected" {
    when {
      result = Register(
        email: "user@example.com",
        password: "weak",
        terms_accepted: true
      )
    }
    
    then {
      result is error WEAK_PASSWORD
    }
  }
}
