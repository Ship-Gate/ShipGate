# Logout Behavior Specification
#
# Session revocation and cleanup.

domain Auth.Behaviors {
  version: "0.1.0"

  import { User, UserId } from "../user.isl"
  import { Session, SessionId, SessionStatus, RevocationReason } from "../session.isl"

  # ============================================
  # Logout Behavior
  # ============================================

  behavior Logout {
    description: "Invalidate a user session and revoke authentication"

    # ============================================
    # Actors
    # ============================================

    actors {
      User {
        must: authenticated
        owns: session_id
        constraints {
          actor.session_id == input.session_id or actor.has_role(ADMIN)
        }
      }

      Admin {
        has_role: ADMIN
        can: revoke any session
      }
    }

    # ============================================
    # Input
    # ============================================

    input {
      session_id: SessionId
      revoke_all: Boolean [default: false]
      reason: RevocationReason? [default: USER_LOGOUT]
    }

    # ============================================
    # Output
    # ============================================

    output {
      success: {
        revoked_count: Int
        message: String
      }

      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
          http_status: 404
        }
        SESSION_ALREADY_REVOKED {
          when: "Session was already revoked"
          retriable: false
          http_status: 409
        }
        UNAUTHORIZED {
          when: "Actor does not own this session and is not admin"
          retriable: false
          http_status: 403
        }
      }
    }

    # ============================================
    # Preconditions
    # ============================================

    preconditions {
      # Session ID provided
      input.session_id != null
      
      # Session must exist (for single logout)
      input.revoke_all == false implies Session.exists(input.session_id)
      
      # Actor authorization
      actor.owns(input.session_id) or actor.has_role(ADMIN)
    }

    # ============================================
    # Postconditions
    # ============================================

    postconditions {
      success implies {
        # Single session revoked
        input.revoke_all == false implies {
          - Session.lookup(input.session_id).status == REVOKED
          - Session.lookup(input.session_id).revoked_at == now()
          - Session.lookup(input.session_id).revocation_reason == input.reason
          - result.revoked_count == 1
        }
        
        # All sessions revoked
        input.revoke_all == true implies {
          - all s in Session.where(user_id == actor.user_id and status == ACTIVE):
              s.status == REVOKED
          - result.revoked_count == count of revoked sessions
        }
        
        # Audit logged
        - audit_log.contains(SessionRevoked {
            session_id: input.session_id,
            user_id: actor.user_id,
            reason: input.reason,
            revoked_by: actor.id
          })
        
        # Cache invalidated
        - session_cache.invalidated(input.session_id)
      }

      SESSION_NOT_FOUND implies {
        - no changes made
      }

      SESSION_ALREADY_REVOKED implies {
        - Session.lookup(input.session_id).status == REVOKED
        - no additional changes made
      }
    }

    # ============================================
    # Invariants
    # ============================================

    invariants {
      - session immediately invalid for new requests after logout
      - session token cannot be reused after revocation
      - revocation is idempotent (calling twice has same effect)
    }

    # ============================================
    # Temporal Constraints
    # ============================================

    temporal {
      - immediately: session invalid for new requests
      - within 100ms (p99): response returned
      - eventually within 5s: session removed from all caches
      - eventually within 30s: distributed cache invalidation complete
    }

    # ============================================
    # Security
    # ============================================

    security {
      - requires valid session token
      - actor can only revoke own sessions (unless admin)
      - audit trail for all revocations
      - no rate limiting (user should always be able to logout)
    }

    # ============================================
    # Observability
    # ============================================

    observability {
      metrics {
        logout_requests: counter [reason, revoke_all]
        logout_duration: histogram
        sessions_revoked: counter [reason]
      }

      traces {
        span: "auth.logout"
        attributes: [revoke_all, reason]
      }

      logs {
        success: info {
          include: [user_id, session_id, revoked_count, reason]
          exclude: []
        }
        error: warn {
          include: [error_code, session_id]
          exclude: []
        }
      }
    }
  }

  # ============================================
  # Logout All Sessions Behavior
  # ============================================

  behavior LogoutAllSessions {
    description: "Revoke all active sessions for a user"

    actors {
      User {
        must: authenticated
      }

      Admin {
        has_role: ADMIN
        can: revoke sessions for any user
      }
    }

    input {
      user_id: UserId?  # Required for admin, optional for self
      except_current: Boolean [default: false]
      reason: RevocationReason [default: USER_LOGOUT]
    }

    output {
      success: {
        revoked_count: Int
        remaining_sessions: Int
      }

      errors {
        USER_NOT_FOUND {
          when: "Specified user does not exist"
          retriable: false
          http_status: 404
        }
        UNAUTHORIZED {
          when: "Cannot revoke sessions for other users without admin role"
          retriable: false
          http_status: 403
        }
        NO_ACTIVE_SESSIONS {
          when: "User has no active sessions to revoke"
          retriable: false
          http_status: 404
        }
      }
    }

    preconditions {
      # Authorization check
      input.user_id == null or input.user_id == actor.user_id or actor.has_role(ADMIN)
      
      # User exists if specified
      input.user_id != null implies User.exists(input.user_id)
    }

    postconditions {
      success implies {
        # Determine target user
        target_user_id = input.user_id ?? actor.user_id
        
        # All sessions revoked (except current if requested)
        - input.except_current == false implies
            Session.where(user_id == target_user_id and status == ACTIVE).count == 0
        
        - input.except_current == true implies
            Session.where(user_id == target_user_id and status == ACTIVE).count <= 1
        
        # Current session preserved if requested
        - input.except_current == true and actor.session_id != null implies
            Session.lookup(actor.session_id).status == ACTIVE
        
        # Count accurate
        - result.remaining_sessions == 
            Session.where(user_id == target_user_id and status == ACTIVE).count
      }
    }

    temporal {
      - within 500ms (p99): response returned
      - eventually within 10s: all caches invalidated
    }

    security {
      - requires authentication
      - admin role required for other users
      - full audit trail
    }
  }

  # ============================================
  # Scenarios
  # ============================================

  scenarios Logout {
    scenario "Successful single session logout" {
      given {
        user = User.create({ email: "user@example.com", status: ACTIVE })
        session = Session.create({ 
          user_id: user.id, 
          status: ACTIVE,
          expires_at: now() + 24h
        })
      }

      when {
        Logout({
          session_id: session.id,
          revoke_all: false
        })
      }

      then {
        - result.success == true
        - result.data.revoked_count == 1
        - session.status == REVOKED
        - session.revoked_at != null
      }
    }

    scenario "Logout all sessions" {
      given {
        user = User.create({ email: "user@example.com", status: ACTIVE })
        session1 = Session.create({ user_id: user.id, status: ACTIVE })
        session2 = Session.create({ user_id: user.id, status: ACTIVE })
        session3 = Session.create({ user_id: user.id, status: ACTIVE })
      }

      when {
        Logout({
          session_id: session1.id,
          revoke_all: true
        })
      }

      then {
        - result.success == true
        - result.data.revoked_count == 3
        - session1.status == REVOKED
        - session2.status == REVOKED
        - session3.status == REVOKED
      }
    }

    scenario "Logout fails for non-existent session" {
      when {
        Logout({
          session_id: "non-existent-id",
          revoke_all: false
        })
      }

      then {
        - result.success == false
        - result.error == SESSION_NOT_FOUND
      }
    }

    scenario "Logout already revoked session returns error" {
      given {
        user = User.create({ email: "user@example.com", status: ACTIVE })
        session = Session.create({ 
          user_id: user.id, 
          status: REVOKED,
          revoked_at: now() - 1h
        })
      }

      when {
        Logout({
          session_id: session.id,
          revoke_all: false
        })
      }

      then {
        - result.success == false
        - result.error == SESSION_ALREADY_REVOKED
      }
    }
  }

  # ============================================
  # Chaos Engineering
  # ============================================

  chaos Logout {
    scenario "Cache invalidation failure" {
      inject {
        service_unavailable(target: "cache_service", probability: 1.0)
      }

      given {
        session = Session.create({ status: ACTIVE })
      }

      when {
        Logout({ session_id: session.id })
      }

      then {
        # Logout should still succeed
        - result.success == true
        # Session marked revoked in database
        - session.status == REVOKED
        # Cache invalidation will be retried
        - cache_invalidation.queued_for_retry(session.id)
      }
    }

    scenario "Database write failure" {
      inject {
        database_failure(target: "sessions", operation: "update", probability: 1.0)
      }

      given {
        session = Session.create({ status: ACTIVE })
      }

      when {
        Logout({ session_id: session.id })
      }

      then {
        - result.success == false
        - result.error.retriable == true
        # Session unchanged
        - session.status == ACTIVE
      }
    }
  }
}
