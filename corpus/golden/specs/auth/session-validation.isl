// Authentication: Session validation
domain AuthSessionValidation {
  version: "1.0.0"

  enum UserStatus {
    ACTIVE
    INACTIVE
    LOCKED
    DELETED
  }

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    status: UserStatus
    created_at: Timestamp [immutable]
  }

  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    token_hash: String [secret]
    ip_address: String [pii]
    user_agent: String?
    expires_at: Timestamp
    revoked: Boolean [default: false]
    last_activity: Timestamp
    created_at: Timestamp [immutable]

    invariants {
      expires_at > created_at
    }
  }

  behavior ValidateSession {
    description: "Check if session is valid and active"

    actors {
      System { }
    }

    input {
      session_id: UUID
    }

    output {
      success: User

      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
        SESSION_EXPIRED {
          when: "Session has expired"
          retriable: false
        }
        SESSION_REVOKED {
          when: "Session was revoked"
          retriable: false
        }
        USER_NOT_ACTIVE {
          when: "User account is not active"
          retriable: false
        }
      }
    }

    pre {
      session_id.is_valid_uuid
    }

    post success {
      - Session.lookup(input.session_id).revoked == false
      - Session.lookup(input.session_id).expires_at > now()
      - User.lookup(Session.lookup(input.session_id).user_id).status == ACTIVE
    }

    temporal {
      - within 10ms (p50): response returned
      - within 50ms (p99): response returned
    }
  }

  behavior ExtendSession {
    description: "Extend session expiration on activity"

    actors {
      System { }
    }

    input {
      session_id: UUID
    }

    output {
      success: Session

      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
        SESSION_EXPIRED {
          when: "Session has already expired"
          retriable: false
        }
      }
    }

    pre {
      Session.exists(input.session_id)
      Session.lookup(input.session_id).expires_at > now()
      Session.lookup(input.session_id).revoked == false
    }

    post success {
      - result.expires_at > old(Session.lookup(input.session_id).expires_at)
      - result.last_activity == now()
    }
  }

  behavior ListUserSessions {
    description: "List all active sessions for a user"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      user_id: UUID
      include_expired: Boolean?
    }

    output {
      success: List<Session>

      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to view sessions"
          retriable: false
        }
      }
    }

    pre {
      User.exists(input.user_id)
      actor.id == input.user_id or actor.role == ADMIN
    }

    post success {
      - input.include_expired == false implies all(s in result: s.expires_at > now() and s.revoked == false)
    }
  }

  scenarios ValidateSession {
    scenario "valid active session" {
      given {
        user = User.create(status: ACTIVE)
        session = Session.create(
          user_id: user.id,
          expires_at: now() + 1.hour,
          revoked: false
        )
      }

      when {
        result = ValidateSession(session_id: session.id)
      }

      then {
        result is success
        result.id == user.id
      }
    }

    scenario "expired session" {
      given {
        user = User.create(status: ACTIVE)
        session = Session.create(
          user_id: user.id,
          expires_at: now() - 1.hour,
          revoked: false
        )
      }

      when {
        result = ValidateSession(session_id: session.id)
      }

      then {
        result is SESSION_EXPIRED
      }
    }

    scenario "revoked session" {
      given {
        user = User.create(status: ACTIVE)
        session = Session.create(
          user_id: user.id,
          expires_at: now() + 1.hour,
          revoked: true
        )
      }

      when {
        result = ValidateSession(session_id: session.id)
      }

      then {
        result is SESSION_REVOKED
      }
    }
  }
}
