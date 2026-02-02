// Authentication: Multi-factor authentication with TOTP
domain AuthMFA {
  version: "1.0.0"

  type TOTPCode = String { length: 6, pattern: "^[0-9]+$" }

  enum MFAMethod {
    TOTP
    SMS
    EMAIL
  }

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    mfa_enabled: Boolean [default: false]
    mfa_method: MFAMethod?
    mfa_secret: String? [secret]
    mfa_backup_codes: List<String>? [secret]
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      mfa_enabled implies mfa_method != null
      mfa_enabled implies mfa_secret != null
    }
  }

  entity MFAChallenge {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    session_id: UUID [indexed]
    method: MFAMethod
    expires_at: Timestamp
    verified: Boolean [default: false]
    attempts: Int [default: 0]
    created_at: Timestamp [immutable]

    invariants {
      attempts >= 0
      attempts <= 5
    }
  }

  behavior EnableMFA {
    description: "Enable TOTP-based MFA for user"

    actors {
      User { must: authenticated }
    }

    input {
      user_id: UUID
      method: MFAMethod
    }

    output {
      success: {
        secret: String
        qr_code_url: String
        backup_codes: List<String>
      }

      errors {
        MFA_ALREADY_ENABLED {
          when: "MFA is already enabled"
          retriable: false
        }
        INVALID_METHOD {
          when: "MFA method not supported"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to modify this user"
          retriable: false
        }
      }
    }

    pre {
      User.exists(input.user_id)
      User.lookup(input.user_id).mfa_enabled == false
    }

    post success {
      - User.lookup(input.user_id).mfa_secret != null
      - result.backup_codes.length == 10
    }

    invariants {
      - secret generated using cryptographic RNG
      - backup codes are single-use
    }
  }

  behavior ConfirmMFA {
    description: "Confirm MFA setup with initial code"

    actors {
      User { must: authenticated }
    }

    input {
      user_id: UUID
      code: TOTPCode
    }

    output {
      success: Boolean

      errors {
        INVALID_CODE {
          when: "TOTP code is invalid"
          retriable: true
        }
        MFA_NOT_PENDING {
          when: "No pending MFA setup"
          retriable: false
        }
      }
    }

    pre {
      User.exists(input.user_id)
      User.lookup(input.user_id).mfa_secret != null
      User.lookup(input.user_id).mfa_enabled == false
    }

    post success {
      - User.lookup(input.user_id).mfa_enabled == true
    }
  }

  behavior VerifyMFA {
    description: "Verify MFA code during login"

    actors {
      Anonymous { }
    }

    input {
      challenge_id: UUID
      code: String
    }

    output {
      success: { session_token: String }

      errors {
        INVALID_CODE {
          when: "Code is invalid"
          retriable: true
        }
        CHALLENGE_EXPIRED {
          when: "Challenge has expired"
          retriable: false
        }
        TOO_MANY_ATTEMPTS {
          when: "Too many failed attempts"
          retriable: false
        }
      }
    }

    pre {
      MFAChallenge.exists(input.challenge_id)
      MFAChallenge.lookup(input.challenge_id).expires_at > now()
      MFAChallenge.lookup(input.challenge_id).attempts < 5
    }

    post success {
      - MFAChallenge.lookup(input.challenge_id).verified == true
    }

    post INVALID_CODE {
      - MFAChallenge.lookup(input.challenge_id).attempts == old(MFAChallenge.lookup(input.challenge_id).attempts) + 1
    }

    temporal {
      - within 200ms (p99): response returned
    }

    security {
      - rate_limit 5 per challenge
      - challenge expires after 5 minutes
    }
  }

  behavior DisableMFA {
    description: "Disable MFA for user"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      user_id: UUID
      code: TOTPCode?
      backup_code: String?
    }

    output {
      success: Boolean

      errors {
        MFA_NOT_ENABLED {
          when: "MFA is not enabled"
          retriable: false
        }
        INVALID_CODE {
          when: "Code is invalid"
          retriable: true
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      User.exists(input.user_id)
      User.lookup(input.user_id).mfa_enabled == true
      input.code != null or input.backup_code != null
    }

    post success {
      - User.lookup(input.user_id).mfa_enabled == false
      - User.lookup(input.user_id).mfa_secret == null
    }
  }

  scenarios EnableMFA {
    scenario "enable TOTP" {
      given {
        user = User.create(mfa_enabled: false)
      }

      when {
        result = EnableMFA(user_id: user.id, method: TOTP)
      }

      then {
        result is success
        result.backup_codes.length == 10
      }
    }
  }
}
