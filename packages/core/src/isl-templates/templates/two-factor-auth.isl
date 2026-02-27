# Two-Factor Authentication (2FA) Domain
# Complete 2FA implementation with TOTP, SMS, and backup codes

domain TwoFactorAuth {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type TOTPSecret = String { length: 32 }
  type TOTPCode = String { length: 6 }
  type BackupCode = String { length: 10 }
  type PhoneNumber = String { format: "e164" }
  
  enum TwoFactorMethod {
    TOTP        # Time-based One-Time Password (Authenticator app)
    SMS         # SMS code
    EMAIL       # Email code
    PUSH        # Push notification
    HARDWARE    # Hardware key (FIDO2/WebAuthn)
  }
  
  enum TwoFactorStatus {
    DISABLED
    PENDING_SETUP
    ENABLED
    LOCKED
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity TwoFactorConfig {
    id: UUID [immutable, unique]
    user_id: UUID [unique, indexed]
    status: TwoFactorStatus [default: DISABLED]
    primary_method: TwoFactorMethod?
    enabled_methods: List<TwoFactorMethod>
    totp_secret: TOTPSecret? [secret]
    phone_number: PhoneNumber?
    recovery_email: String?
    last_used_at: Timestamp?
    setup_completed_at: Timestamp?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      status == ENABLED implies primary_method != null
      status == ENABLED implies enabled_methods.length > 0
      primary_method in enabled_methods or primary_method == null
    }
  }
  
  entity BackupCodeSet {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    codes_hash: List<String> [secret]  # Hashed codes
    used_codes: List<Int>  # Indices of used codes
    total_codes: Int [default: 10]
    generated_at: Timestamp [immutable]
    
    invariants {
      used_codes.length <= total_codes
      codes_hash.length == total_codes
    }
  }
  
  entity TwoFactorChallenge {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    session_id: UUID [indexed]
    method: TwoFactorMethod
    code_hash: String? [secret]
    attempts: Int [default: 0]
    max_attempts: Int [default: 5]
    verified: Boolean [default: false]
    expires_at: Timestamp
    created_at: Timestamp [immutable]
    
    invariants {
      attempts <= max_attempts
      expires_at > created_at
    }
  }
  
  entity WebAuthnCredential {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    credential_id: String [unique]
    public_key: String
    name: String
    sign_count: Int [default: 0]
    transports: List<String>
    last_used_at: Timestamp?
    created_at: Timestamp [immutable]
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior InitializeTOTP {
    description: "Generate TOTP secret and QR code for setup"
    
    actors {
      User { must: authenticated }
    }
    
    output {
      success: {
        secret: TOTPSecret
        qr_code_url: String
        manual_entry_key: String
        issuer: String
      }
      
      errors {
        TOTP_ALREADY_ENABLED {
          when: "TOTP is already enabled"
          retriable: false
        }
        SETUP_IN_PROGRESS {
          when: "Another 2FA setup is in progress"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        TwoFactorConfig.lookup(actor.id).status == PENDING_SETUP
        TwoFactorConfig.lookup(actor.id).totp_secret == result.secret
      }
    }
    
    invariants {
      result.secret generated with cryptographic randomness
      result.secret displayed only once
    }
  }
  
  behavior VerifyAndEnableTOTP {
    description: "Verify TOTP code and enable 2FA"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      code: TOTPCode
    }
    
    output {
      success: {
        enabled: Boolean
        backup_codes: List<BackupCode>
      }
      
      errors {
        INVALID_CODE {
          when: "TOTP code is incorrect"
          retriable: true
        }
        SETUP_NOT_STARTED {
          when: "TOTP setup was not initialized"
          retriable: false
        }
        CODE_ALREADY_USED {
          when: "This code was already used"
          retriable: true
        }
      }
    }
    
    preconditions {
      TwoFactorConfig.lookup(actor.id).status == PENDING_SETUP
      TwoFactorConfig.lookup(actor.id).totp_secret != null
    }
    
    postconditions {
      success implies {
        TwoFactorConfig.lookup(actor.id).status == ENABLED
        TwoFactorConfig.lookup(actor.id).primary_method == TOTP
        BackupCodeSet.exists(user_id: actor.id)
      }
    }
    
    invariants {
      result.backup_codes displayed only once
      result.backup_codes stored hashed
    }
    
    effects {
      Email { send_2fa_enabled_notification }
      AuditLog { log_2fa_enabled }
    }
  }
  
  behavior CreateChallenge {
    description: "Create a 2FA challenge for authentication"
    
    actors {
      System { }
    }
    
    input {
      user_id: UUID
      session_id: UUID
      preferred_method: TwoFactorMethod?
    }
    
    output {
      success: {
        challenge_id: UUID
        method: TwoFactorMethod
        hint: String?  # e.g., "***123" for phone
        expires_in: Int
      }
      
      errors {
        TWO_FACTOR_NOT_ENABLED {
          when: "User does not have 2FA enabled"
          retriable: false
        }
        METHOD_NOT_AVAILABLE {
          when: "Requested method is not enabled"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        TwoFactorChallenge.exists(result.challenge_id)
      }
      
      result.method == SMS implies {
        // SMS code sent
      }
    }
    
    temporal {
      response within 500ms
      method == SMS implies eventually within 30s: sms_delivered
    }
  }
  
  behavior VerifyChallenge {
    description: "Verify a 2FA challenge"
    
    actors {
      System { }
    }
    
    input {
      challenge_id: UUID
      code: String
    }
    
    output {
      success: {
        verified: Boolean
        session_id: UUID
      }
      
      errors {
        INVALID_CODE {
          when: "Code is incorrect"
          retriable: true
        }
        CHALLENGE_EXPIRED {
          when: "Challenge has expired"
          retriable: false
        }
        MAX_ATTEMPTS_EXCEEDED {
          when: "Too many failed attempts"
          retriable: false
        }
        CHALLENGE_NOT_FOUND {
          when: "Challenge does not exist"
          retriable: false
        }
      }
    }
    
    preconditions {
      TwoFactorChallenge.exists(input.challenge_id)
      TwoFactorChallenge.lookup(input.challenge_id).expires_at > now()
      TwoFactorChallenge.lookup(input.challenge_id).attempts < 
        TwoFactorChallenge.lookup(input.challenge_id).max_attempts
    }
    
    postconditions {
      success implies {
        TwoFactorChallenge.lookup(input.challenge_id).verified == true
        TwoFactorConfig.lookup(user_id).last_used_at == now()
      }
      
      INVALID_CODE implies {
        TwoFactorChallenge.lookup(input.challenge_id).attempts == 
          old(TwoFactorChallenge.lookup(input.challenge_id).attempts) + 1
      }
    }
    
    temporal {
      response within 200ms
    }
    
    security {
      timing_attack_resistant
    }
  }
  
  behavior UseBackupCode {
    description: "Authenticate using a backup code"
    
    actors {
      System { }
    }
    
    input {
      user_id: UUID
      code: BackupCode
    }
    
    output {
      success: {
        verified: Boolean
        remaining_codes: Int
      }
      
      errors {
        INVALID_CODE {
          when: "Backup code is invalid"
          retriable: true
        }
        CODE_ALREADY_USED {
          when: "Backup code was already used"
          retriable: false
        }
        NO_CODES_REMAINING {
          when: "All backup codes have been used"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        // Code marked as used
        BackupCodeSet.lookup(input.user_id).used_codes.length == 
          old(BackupCodeSet.lookup(input.user_id).used_codes.length) + 1
      }
    }
    
    effects {
      Email { send_backup_code_used_notification }
    }
  }
  
  behavior RegenerateBackupCodes {
    description: "Generate new backup codes (invalidates old ones)"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      confirm_password: String [sensitive]
    }
    
    output {
      success: {
        codes: List<BackupCode>
        generated_at: Timestamp
      }
      
      errors {
        INVALID_PASSWORD {
          when: "Password is incorrect"
          retriable: true
        }
        TWO_FACTOR_NOT_ENABLED {
          when: "2FA is not enabled"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        BackupCodeSet.lookup(actor.id).generated_at == now()
        BackupCodeSet.lookup(actor.id).used_codes.length == 0
      }
    }
    
    invariants {
      result.codes displayed only once
    }
  }
  
  behavior DisableTwoFactor {
    description: "Disable 2FA for a user"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      password: String [sensitive]
      code: String?  # 2FA code if enabled
    }
    
    output {
      success: Boolean
      
      errors {
        INVALID_PASSWORD {
          when: "Password is incorrect"
          retriable: true
        }
        INVALID_CODE {
          when: "2FA code is incorrect"
          retriable: true
        }
      }
    }
    
    postconditions {
      success implies {
        TwoFactorConfig.lookup(actor.id).status == DISABLED
        TwoFactorConfig.lookup(actor.id).totp_secret == null
        not BackupCodeSet.exists(user_id: actor.id)
      }
    }
    
    effects {
      Email { send_2fa_disabled_notification }
      AuditLog { log_2fa_disabled }
    }
  }
  
  behavior AddWebAuthnCredential {
    description: "Register a hardware security key"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      credential_id: String
      public_key: String
      name: String
      transports: List<String>
    }
    
    output {
      success: WebAuthnCredential
      
      errors {
        CREDENTIAL_EXISTS {
          when: "This credential is already registered"
          retriable: false
        }
        MAX_CREDENTIALS {
          when: "Maximum number of credentials reached"
          retriable: false
        }
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios VerifyChallenge {
    scenario "valid TOTP code" {
      given {
        config = TwoFactorConfig.create(
          user_id: user.id,
          status: ENABLED,
          primary_method: TOTP,
          totp_secret: "JBSWY3DPEHPK3PXP"
        )
        challenge = TwoFactorChallenge.create(
          user_id: user.id,
          method: TOTP,
          expires_at: now() + 5m
        )
      }
      
      when {
        result = VerifyChallenge(
          challenge_id: challenge.id,
          code: generate_totp(config.totp_secret)
        )
      }
      
      then {
        result is success
        result.verified == true
      }
    }
    
    scenario "invalid code increments attempts" {
      given {
        challenge = TwoFactorChallenge.create(
          user_id: user.id,
          method: TOTP,
          attempts: 0
        )
      }
      
      when {
        result = VerifyChallenge(
          challenge_id: challenge.id,
          code: "000000"
        )
      }
      
      then {
        result is INVALID_CODE
        TwoFactorChallenge.lookup(challenge.id).attempts == 1
      }
    }
  }
  
  scenarios UseBackupCode {
    scenario "valid backup code" {
      given {
        codes = BackupCodeSet.create(
          user_id: user.id,
          codes_hash: [...],
          used_codes: []
        )
      }
      
      when {
        result = UseBackupCode(
          user_id: user.id,
          code: valid_backup_code
        )
      }
      
      then {
        result is success
        result.remaining_codes == 9
      }
    }
  }
}
