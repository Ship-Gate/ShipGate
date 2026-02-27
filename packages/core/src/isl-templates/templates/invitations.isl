# Invitation System Domain
# Generic invitation system for various use cases

domain Invitations {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type InvitationToken = String { min_length: 32, max_length: 64 }
  
  enum InvitationType {
    TEAM
    PROJECT
    WORKSPACE
    REFERRAL
    BETA_ACCESS
  }
  
  enum InvitationStatus {
    PENDING
    ACCEPTED
    DECLINED
    EXPIRED
    REVOKED
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity Invitation {
    id: UUID [immutable, unique]
    type: InvitationType
    inviter_id: UUID [indexed]
    invitee_email: String [indexed]
    invitee_id: UUID? [indexed]  # Set when accepted
    resource_type: String?
    resource_id: UUID? [indexed]
    role: String?
    token_hash: String [unique, indexed]
    status: InvitationStatus [default: PENDING]
    custom_message: String?
    metadata: Map<String, String>
    expires_at: Timestamp
    accepted_at: Timestamp?
    declined_at: Timestamp?
    revoked_at: Timestamp?
    reminder_sent_at: Timestamp?
    created_at: Timestamp [immutable]
    
    invariants {
      expires_at > created_at
      accepted_at != null implies status == ACCEPTED
      declined_at != null implies status == DECLINED
      revoked_at != null implies status == REVOKED
    }
    
    lifecycle {
      PENDING -> ACCEPTED
      PENDING -> DECLINED
      PENDING -> EXPIRED
      PENDING -> REVOKED
    }
  }
  
  entity InvitationQuota {
    id: UUID [immutable, unique]
    user_id: UUID [unique, indexed]
    type: InvitationType
    daily_limit: Int
    daily_used: Int [default: 0]
    monthly_limit: Int
    monthly_used: Int [default: 0]
    reset_daily_at: Timestamp
    reset_monthly_at: Timestamp
    
    invariants {
      daily_used <= daily_limit
      monthly_used <= monthly_limit
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior CreateInvitation {
    description: "Create and send an invitation"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      type: InvitationType
      email: String { format: "email" }
      resource_type: String?
      resource_id: UUID?
      role: String?
      custom_message: String?
      expires_in_days: Int [default: 7, max: 30]
      metadata: Map<String, String>?
    }
    
    output {
      success: Invitation
      
      errors {
        ALREADY_INVITED {
          when: "A pending invitation already exists for this email"
          retriable: false
        }
        ALREADY_MEMBER {
          when: "User is already a member of this resource"
          retriable: false
        }
        QUOTA_EXCEEDED {
          when: "Invitation quota exceeded"
          retriable: true
          retry_after: next_reset_time
        }
        RESOURCE_NOT_FOUND {
          when: "Resource does not exist"
          retriable: false
        }
        INSUFFICIENT_PERMISSIONS {
          when: "Cannot invite to this resource"
          retriable: false
        }
        SELF_INVITATION {
          when: "Cannot invite yourself"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.email != actor.email
      not Invitation.exists(
        invitee_email: input.email,
        resource_id: input.resource_id,
        status: PENDING
      )
    }
    
    postconditions {
      success implies {
        Invitation.exists(result.id)
        InvitationQuota.lookup(actor.id).daily_used == 
          old(InvitationQuota.lookup(actor.id).daily_used) + 1
      }
    }
    
    effects {
      Email { send_invitation }
    }
  }
  
  behavior AcceptInvitation {
    description: "Accept an invitation"
    
    actors {
      User { must: authenticated }
      Anonymous { }  # For registration flow
    }
    
    input {
      token: InvitationToken
    }
    
    output {
      success: {
        invitation: Invitation
        redirect_url: String?
      }
      
      errors {
        INVALID_TOKEN {
          when: "Invitation token is invalid"
          retriable: false
        }
        INVITATION_EXPIRED {
          when: "Invitation has expired"
          retriable: false
        }
        ALREADY_ACCEPTED {
          when: "Invitation was already accepted"
          retriable: false
        }
        EMAIL_MISMATCH {
          when: "Your email does not match the invitation"
          retriable: false
        }
      }
    }
    
    preconditions {
      Invitation.exists_by_hash(hash(input.token))
      Invitation.lookup_by_hash(hash(input.token)).status == PENDING
      Invitation.lookup_by_hash(hash(input.token)).expires_at > now()
    }
    
    postconditions {
      success implies {
        Invitation.lookup_by_hash(hash(input.token)).status == ACCEPTED
        Invitation.lookup_by_hash(hash(input.token)).accepted_at == now()
        Invitation.lookup_by_hash(hash(input.token)).invitee_id == actor.id
      }
    }
  }
  
  behavior DeclineInvitation {
    description: "Decline an invitation"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      token: InvitationToken
      reason: String?
    }
    
    output {
      success: Invitation
      
      errors {
        INVALID_TOKEN {
          when: "Invitation token is invalid"
          retriable: false
        }
        INVITATION_EXPIRED {
          when: "Invitation has expired"
          retriable: false
        }
        ALREADY_RESPONDED {
          when: "Invitation was already responded to"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        Invitation.lookup_by_hash(hash(input.token)).status == DECLINED
        Invitation.lookup_by_hash(hash(input.token)).declined_at == now()
      }
    }
  }
  
  behavior RevokeInvitation {
    description: "Revoke a pending invitation"
    
    actors {
      User { must: authenticated, is_inviter: true }
      Admin { must: authenticated }
    }
    
    input {
      invitation_id: UUID
      reason: String?
    }
    
    output {
      success: Invitation
      
      errors {
        INVITATION_NOT_FOUND {
          when: "Invitation does not exist"
          retriable: false
        }
        ALREADY_RESPONDED {
          when: "Invitation was already responded to"
          retriable: false
        }
        INSUFFICIENT_PERMISSIONS {
          when: "Cannot revoke this invitation"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        Invitation.lookup(input.invitation_id).status == REVOKED
        Invitation.lookup(input.invitation_id).revoked_at == now()
      }
    }
  }
  
  behavior ResendInvitation {
    description: "Resend an invitation email"
    
    actors {
      User { must: authenticated, is_inviter: true }
    }
    
    input {
      invitation_id: UUID
    }
    
    output {
      success: Invitation
      
      errors {
        INVITATION_NOT_FOUND {
          when: "Invitation does not exist"
          retriable: false
        }
        NOT_PENDING {
          when: "Can only resend pending invitations"
          retriable: false
        }
        TOO_SOON {
          when: "Please wait before resending"
          retriable: true
          retry_after: 1h
        }
      }
    }
    
    preconditions {
      Invitation.exists(input.invitation_id)
      Invitation.lookup(input.invitation_id).status == PENDING
      Invitation.lookup(input.invitation_id).reminder_sent_at == null or
        Invitation.lookup(input.invitation_id).reminder_sent_at < now() - 1h
    }
    
    effects {
      Email { send_invitation_reminder }
    }
  }
  
  behavior ListInvitations {
    description: "List invitations with filters"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      type: InvitationType?
      resource_id: UUID?
      status: InvitationStatus?
      direction: String [values: ["sent", "received"]]
      limit: Int [default: 20]
      cursor: String?
    }
    
    output {
      success: {
        invitations: List<Invitation>
        total_count: Int
        next_cursor: String?
      }
    }
  }
  
  behavior GetInvitationByToken {
    description: "Get invitation details by token (for preview)"
    
    actors {
      Anonymous { }
    }
    
    input {
      token: InvitationToken
    }
    
    output {
      success: {
        type: InvitationType
        inviter_name: String
        resource_name: String?
        expires_at: Timestamp
        custom_message: String?
      }
      
      errors {
        INVALID_TOKEN {
          when: "Invitation token is invalid"
          retriable: false
        }
        INVITATION_EXPIRED {
          when: "Invitation has expired"
          retriable: false
        }
      }
    }
  }
  
  behavior BulkInvite {
    description: "Send invitations to multiple emails"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      type: InvitationType
      emails: List<String> { max_length: 50 }
      resource_type: String?
      resource_id: UUID?
      role: String?
    }
    
    output {
      success: {
        created: List<Invitation>
        skipped: List<{
          email: String
          reason: String
        }>
      }
    }
    
    postconditions {
      result.created.length + result.skipped.length == input.emails.length
    }
  }
  
  behavior CleanupExpiredInvitations {
    description: "Mark expired invitations"
    
    actors {
      System { }
    }
    
    output {
      success: {
        expired_count: Int
      }
    }
    
    temporal {
      runs every 1h
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios AcceptInvitation {
    scenario "successful acceptance" {
      given {
        invitation = Invitation.create(
          type: TEAM,
          invitee_email: "user@example.com",
          status: PENDING,
          expires_at: now() + 7d
        )
      }
      
      when {
        result = AcceptInvitation(token: invitation.token)
      }
      
      then {
        result is success
        result.invitation.status == ACCEPTED
      }
    }
    
    scenario "expired invitation" {
      given {
        invitation = Invitation.create(
          invitee_email: "user@example.com",
          expires_at: now() - 1d
        )
      }
      
      when {
        result = AcceptInvitation(token: invitation.token)
      }
      
      then {
        result is INVITATION_EXPIRED
      }
    }
  }
}
