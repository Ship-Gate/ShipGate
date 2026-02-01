# Team/Organization Management Domain
# Complete team management with memberships, roles, and billing

domain Teams {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type TeamSlug = String { min_length: 3, max_length: 50, pattern: "^[a-z0-9-]+$" }
  type TeamName = String { max_length: 100 }
  
  enum TeamRole {
    OWNER
    ADMIN
    MEMBER
    VIEWER
    BILLING
  }
  
  enum TeamPlan {
    FREE
    STARTER
    PRO
    ENTERPRISE
  }
  
  enum MembershipStatus {
    ACTIVE
    SUSPENDED
    PENDING
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity Team {
    id: UUID [immutable, unique]
    slug: TeamSlug [unique, indexed]
    name: TeamName
    description: String?
    avatar_url: String?
    website: String?
    plan: TeamPlan [default: FREE]
    plan_seats: Int?
    used_seats: Int [default: 0]
    billing_email: String?
    is_personal: Boolean [default: false]
    settings: Map<String, Any>
    metadata: Map<String, String>
    created_by: UUID
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      used_seats >= 0
      plan_seats == null or used_seats <= plan_seats
      slug.length >= 3
    }
  }
  
  entity TeamMembership {
    id: UUID [immutable, unique]
    team_id: UUID [indexed]
    user_id: UUID [indexed]
    role: TeamRole [default: MEMBER]
    status: MembershipStatus [default: ACTIVE]
    custom_permissions: List<String>?
    joined_at: Timestamp [immutable]
    invited_by: UUID?
    expires_at: Timestamp?
    
    invariants {
      expires_at == null or expires_at > joined_at
    }
  }
  
  entity TeamInvitation {
    id: UUID [immutable, unique]
    team_id: UUID [indexed]
    email: String [indexed]
    role: TeamRole [default: MEMBER]
    invited_by: UUID
    token_hash: String [indexed]
    status: String [values: ["pending", "accepted", "expired", "revoked"]]
    expires_at: Timestamp
    created_at: Timestamp [immutable]
    accepted_at: Timestamp?
    
    invariants {
      expires_at > created_at
      accepted_at != null implies status == "accepted"
    }
  }
  
  entity TeamAuditLog {
    id: UUID [immutable, unique]
    team_id: UUID [indexed]
    actor_id: UUID
    action: String
    target_type: String?
    target_id: UUID?
    details: Map<String, Any>
    ip_address: String?
    created_at: Timestamp [immutable, indexed]
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior CreateTeam {
    description: "Create a new team/organization"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      name: TeamName
      slug: TeamSlug
      description: String?
      is_personal: Boolean?
    }
    
    output {
      success: {
        team: Team
        membership: TeamMembership
      }
      
      errors {
        SLUG_TAKEN {
          when: "Team slug is already in use"
          retriable: false
        }
        SLUG_RESERVED {
          when: "Team slug is reserved"
          retriable: false
        }
        MAX_TEAMS_EXCEEDED {
          when: "Maximum number of teams reached"
          retriable: false
        }
      }
    }
    
    preconditions {
      not Team.exists(slug: input.slug)
      input.slug not in reserved_slugs
    }
    
    postconditions {
      success implies {
        Team.exists(result.team.id)
        TeamMembership.exists(
          team_id: result.team.id,
          user_id: actor.id,
          role: OWNER
        )
      }
    }
  }
  
  behavior UpdateTeam {
    description: "Update team information"
    
    actors {
      User { must: authenticated, role: [OWNER, ADMIN] }
    }
    
    input {
      team_id: UUID
      name: TeamName?
      description: String?
      avatar_url: String?
      website: String?
      billing_email: String?
      settings: Map<String, Any>?
    }
    
    output {
      success: Team
      
      errors {
        TEAM_NOT_FOUND {
          when: "Team does not exist"
          retriable: false
        }
        INSUFFICIENT_PERMISSIONS {
          when: "User cannot update this team"
          retriable: false
        }
      }
    }
  }
  
  behavior DeleteTeam {
    description: "Delete a team and all associated data"
    
    actors {
      User { must: authenticated, role: OWNER }
    }
    
    input {
      team_id: UUID
      confirm_slug: TeamSlug
    }
    
    output {
      success: Boolean
      
      errors {
        TEAM_NOT_FOUND {
          when: "Team does not exist"
          retriable: false
        }
        CONFIRMATION_MISMATCH {
          when: "Slug confirmation does not match"
          retriable: true
        }
        HAS_ACTIVE_SUBSCRIPTION {
          when: "Team has active subscription"
          retriable: false
        }
      }
    }
    
    preconditions {
      Team.lookup(input.team_id).slug == input.confirm_slug
    }
    
    postconditions {
      success implies {
        not Team.exists(input.team_id)
        TeamMembership.count(team_id: input.team_id) == 0
      }
    }
    
    effects {
      AuditLog { log_team_deletion }
      Email { notify_members }
    }
  }
  
  behavior InviteMember {
    description: "Invite a user to join the team"
    
    actors {
      User { must: authenticated, role: [OWNER, ADMIN] }
    }
    
    input {
      team_id: UUID
      email: String
      role: TeamRole [default: MEMBER]
      custom_message: String?
    }
    
    output {
      success: TeamInvitation
      
      errors {
        TEAM_NOT_FOUND {
          when: "Team does not exist"
          retriable: false
        }
        ALREADY_MEMBER {
          when: "User is already a team member"
          retriable: false
        }
        INVITATION_EXISTS {
          when: "Pending invitation already exists"
          retriable: false
        }
        SEAT_LIMIT_REACHED {
          when: "Team has reached seat limit"
          retriable: false
        }
        CANNOT_INVITE_OWNER {
          when: "Cannot invite with owner role"
          retriable: false
        }
      }
    }
    
    preconditions {
      Team.exists(input.team_id)
      not TeamMembership.exists(team_id: input.team_id, email: input.email)
      input.role != OWNER
      Team.lookup(input.team_id).plan_seats == null or
        Team.lookup(input.team_id).used_seats < Team.lookup(input.team_id).plan_seats
    }
    
    postconditions {
      success implies {
        TeamInvitation.exists(result.id)
      }
    }
    
    effects {
      Email { send_invitation }
    }
  }
  
  behavior AcceptInvitation {
    description: "Accept a team invitation"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      token: String
    }
    
    output {
      success: TeamMembership
      
      errors {
        INVALID_TOKEN {
          when: "Invitation token is invalid"
          retriable: false
        }
        INVITATION_EXPIRED {
          when: "Invitation has expired"
          retriable: false
        }
        ALREADY_MEMBER {
          when: "User is already a team member"
          retriable: false
        }
        EMAIL_MISMATCH {
          when: "User email does not match invitation"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        TeamMembership.exists(
          team_id: invitation.team_id,
          user_id: actor.id
        )
        TeamInvitation.lookup_by_token(input.token).status == "accepted"
        Team.lookup(invitation.team_id).used_seats == 
          old(Team.lookup(invitation.team_id).used_seats) + 1
      }
    }
  }
  
  behavior RemoveMember {
    description: "Remove a member from the team"
    
    actors {
      User { must: authenticated, role: [OWNER, ADMIN] }
    }
    
    input {
      team_id: UUID
      user_id: UUID
    }
    
    output {
      success: Boolean
      
      errors {
        MEMBER_NOT_FOUND {
          when: "User is not a team member"
          retriable: false
        }
        CANNOT_REMOVE_OWNER {
          when: "Cannot remove the team owner"
          retriable: false
        }
        CANNOT_REMOVE_SELF {
          when: "Use leave team to remove yourself"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        not TeamMembership.exists(
          team_id: input.team_id,
          user_id: input.user_id
        )
      }
    }
  }
  
  behavior UpdateMemberRole {
    description: "Change a member's role"
    
    actors {
      User { must: authenticated, role: OWNER }
    }
    
    input {
      team_id: UUID
      user_id: UUID
      new_role: TeamRole
    }
    
    output {
      success: TeamMembership
      
      errors {
        MEMBER_NOT_FOUND {
          when: "User is not a team member"
          retriable: false
        }
        CANNOT_CHANGE_OWN_ROLE {
          when: "Cannot change your own role"
          retriable: false
        }
        INVALID_ROLE_CHANGE {
          when: "Cannot change to owner role"
          retriable: false
        }
      }
    }
    
    effects {
      TeamAuditLog { log_role_change }
      Email { notify_role_change }
    }
  }
  
  behavior TransferOwnership {
    description: "Transfer team ownership to another member"
    
    actors {
      User { must: authenticated, role: OWNER }
    }
    
    input {
      team_id: UUID
      new_owner_id: UUID
      password: String [sensitive]
    }
    
    output {
      success: {
        team: Team
        old_owner_membership: TeamMembership
        new_owner_membership: TeamMembership
      }
      
      errors {
        INVALID_PASSWORD {
          when: "Password is incorrect"
          retriable: true
        }
        MEMBER_NOT_FOUND {
          when: "New owner is not a team member"
          retriable: false
        }
        CANNOT_TRANSFER_TO_SELF {
          when: "Cannot transfer to yourself"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        TeamMembership.lookup(team_id, input.new_owner_id).role == OWNER
        TeamMembership.lookup(team_id, actor.id).role == ADMIN
      }
    }
    
    effects {
      Email { notify_ownership_transfer }
    }
  }
  
  behavior LeaveTeam {
    description: "Leave a team"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      team_id: UUID
    }
    
    output {
      success: Boolean
      
      errors {
        NOT_A_MEMBER {
          when: "User is not a team member"
          retriable: false
        }
        OWNER_CANNOT_LEAVE {
          when: "Owner must transfer ownership first"
          retriable: false
        }
      }
    }
  }
  
  behavior ListTeamMembers {
    description: "List all members of a team"
    
    actors {
      User { must: authenticated, is_member: true }
    }
    
    input {
      team_id: UUID
      role: TeamRole?
      status: MembershipStatus?
      limit: Int [default: 50]
      cursor: String?
    }
    
    output {
      success: {
        members: List<{
          membership: TeamMembership
          user: UserProfile
        }>
        total_count: Int
        next_cursor: String?
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios InviteMember {
    scenario "successful invitation" {
      given {
        team = Team.create(slug: "acme", plan_seats: 10, used_seats: 5)
        membership = TeamMembership.create(
          team_id: team.id,
          user_id: admin.id,
          role: ADMIN
        )
      }
      
      when {
        result = InviteMember(
          team_id: team.id,
          email: "newuser@example.com",
          role: MEMBER
        )
      }
      
      then {
        result is success
        TeamInvitation.exists(email: "newuser@example.com")
      }
    }
    
    scenario "seat limit reached" {
      given {
        team = Team.create(plan_seats: 5, used_seats: 5)
      }
      
      when {
        result = InviteMember(
          team_id: team.id,
          email: "newuser@example.com"
        )
      }
      
      then {
        result is SEAT_LIMIT_REACHED
      }
    }
  }
}
