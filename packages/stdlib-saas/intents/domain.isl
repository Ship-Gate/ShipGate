# SaaS Standard Library
# 
# Complete foundation for building SaaS applications.
# Includes multi-tenancy, billing, team management, and more.

domain SaaS {
  version: "1.0.0"
  
  # Include standard auth and payments
  use stdlib-auth
  use stdlib-payments
  
  # ============================================
  # Multi-Tenancy
  # ============================================
  
  entity Organization {
    id: UUID [immutable, unique]
    name: String { max_length: 100 }
    slug: String { pattern: "^[a-z0-9-]+$" } [unique, indexed]
    plan: SubscriptionPlan
    status: OrganizationStatus [default: ACTIVE]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    settings: JSON?  # Flexible org-level settings
    
    invariants {
      slug.length >= 3
      slug.length <= 50
    }
  }
  
  enum OrganizationStatus {
    ACTIVE
    SUSPENDED
    CANCELLED
  }
  
  enum SubscriptionPlan {
    FREE
    STARTER
    PROFESSIONAL
    ENTERPRISE
  }
  
  # ============================================
  # Team Management
  # ============================================
  
  entity TeamMember {
    id: UUID [immutable, unique]
    organization_id: UUID [immutable, indexed]
    user_id: UUID [immutable, indexed]
    role: TeamRole
    invited_by: UUID?
    invited_at: Timestamp [immutable]
    accepted_at: Timestamp?
    
    invariants {
      accepted_at == null or accepted_at >= invited_at
    }
  }
  
  enum TeamRole {
    OWNER       # Full control, billing, can delete org
    ADMIN       # Manage team, settings (no billing)
    MEMBER      # Standard access
    VIEWER      # Read-only access
  }
  
  # ============================================
  # Projects (Multi-tenant resource)
  # ============================================
  
  entity Project {
    id: UUID [immutable, unique]
    organization_id: UUID [immutable, indexed]
    name: String { max_length: 100 }
    description: String? { max_length: 1000 }
    status: ProjectStatus [default: ACTIVE]
    created_by: UUID [immutable]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    archived_at: Timestamp?
    
    lifecycle {
      ACTIVE -> ARCHIVED
      ARCHIVED -> ACTIVE
    }
  }
  
  enum ProjectStatus {
    ACTIVE
    ARCHIVED
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior CreateOrganization {
    description: "Create a new organization and set up the creator as owner"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      name: String
      slug: String
      plan: SubscriptionPlan? [default: FREE]
    }
    
    output {
      success: Organization
      
      errors {
        SLUG_TAKEN {
          when: "Organization slug already exists"
          retriable: false
        }
        INVALID_SLUG {
          when: "Slug format is invalid"
          retriable: true
        }
        LIMIT_REACHED {
          when: "User has reached maximum organizations"
          retriable: false
        }
      }
    }
    
    preconditions {
      name.length > 0
      slug.length >= 3
      slug matches "^[a-z0-9-]+$"
    }
    
    postconditions {
      success implies {
        - Organization.exists(result.id)
        - TeamMember.exists(organization_id == result.id, user_id == actor.id, role == OWNER)
      }
    }
  }
  
  behavior InviteTeamMember {
    description: "Invite a user to join the organization"
    
    actors {
      User { 
        must: authenticated
        role: OWNER or ADMIN
        in: organization_id
      }
    }
    
    input {
      organization_id: UUID
      email: Email
      role: TeamRole [default: MEMBER]
    }
    
    output {
      success: TeamMember
      
      errors {
        NOT_FOUND {
          when: "Organization does not exist"
        }
        ALREADY_MEMBER {
          when: "User is already a member"
        }
        INVALID_ROLE {
          when: "Cannot invite with higher role than self"
        }
        SEAT_LIMIT {
          when: "Organization has reached seat limit for plan"
        }
      }
    }
    
    postconditions {
      success implies {
        - eventually within 5m: invitation email sent to input.email
      }
    }
  }
  
  behavior CreateProject {
    description: "Create a new project within an organization"
    
    actors {
      User {
        must: authenticated
        role: OWNER or ADMIN or MEMBER
        in: organization_id
      }
    }
    
    input {
      organization_id: UUID
      name: String
      description: String?
    }
    
    output {
      success: Project
      
      errors {
        ORG_NOT_FOUND {
          when: "Organization does not exist"
        }
        PROJECT_LIMIT {
          when: "Organization has reached project limit for plan"
        }
        INVALID_NAME {
          when: "Project name is invalid"
        }
      }
    }
    
    preconditions {
      name.length > 0
      name.length <= 100
    }
  }
  
  # ============================================
  # Plan Limits
  # ============================================
  
  invariants PlanLimits {
    description: "Enforce plan-based limits"
    scope: global
    
    always {
      - FREE plan: max 3 projects, max 2 team members
      - STARTER plan: max 10 projects, max 5 team members  
      - PROFESSIONAL plan: max 50 projects, max 20 team members
      - ENTERPRISE plan: unlimited
    }
  }
  
  # ============================================
  # Security
  # ============================================
  
  invariants DataIsolation {
    description: "Multi-tenant data isolation"
    scope: global
    
    always {
      - Projects only visible to organization members
      - TeamMembers only visible to organization members
      - All queries scoped by organization_id
    }
  }
}
