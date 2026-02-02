// Authentication: Logout behavior
domain AuthLogout {
  version: "1.0.0"

  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    token_hash: String [secret]
    expires_at: Timestamp
    revoked: Boolean [default: false]
    revoked_at: Timestamp?
    created_at: Timestamp [immutable]

    invariants {
      revoked implies revoked_at != null
    }
  }

  behavior Logout {
    description: "Invalidate user session"

    actors {
      User { must: authenticated }
    }

    input {
      session_id: UUID
    }

    output {
      success: Boolean

      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
        SESSION_ALREADY_REVOKED {
          when: "Session was already revoked"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to revoke this session"
          retriable: false
        }
      }
    }

    pre {
      Session.exists(session_id)
    }

    post success {
      - Session.lookup(session_id).revoked == true
      - Session.lookup(session_id).revoked_at != null
    }

    temporal {
      - immediately: session invalid for new requests
      - eventually within 5s: session removed from all caches
    }
  }

  behavior LogoutAll {
    description: "Revoke all sessions for a user"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      user_id: UUID
    }

    output {
      success: { count: Int }

      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to revoke sessions"
          retriable: false
        }
      }
    }

    post success {
      - all(s in Session.where(user_id: input.user_id): s.revoked == true)
    }

    temporal {
      - eventually within 30s: all sessions invalidated
    }
  }

  scenarios Logout {
    scenario "successful logout" {
      given {
        session = Session.create(user_id: "user-123", revoked: false)
      }

      when {
        result = Logout(session_id: session.id)
      }

      then {
        result is success
        Session.lookup(session.id).revoked == true
      }
    }
  }
}
