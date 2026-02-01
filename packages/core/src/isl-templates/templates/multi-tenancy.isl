# Multi-Tenancy Domain
# Tenant isolation, configuration, and resource management

domain MultiTenancy {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type TenantSlug = String { min_length: 3, max_length: 50, pattern: "^[a-z0-9-]+$" }
  type TenantDomain = String { format: "hostname", max_length: 255 }
  
  enum TenantStatus {
    ACTIVE
    SUSPENDED
    PENDING
    ARCHIVED
  }
  
  enum TenantPlan {
    FREE
    STARTER
    PROFESSIONAL
    ENTERPRISE
  }
  
  enum IsolationLevel {
    SHARED_SCHEMA    # Tenant ID column
    SEPARATE_SCHEMA  # Schema per tenant
    SEPARATE_DB      # Database per tenant
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity Tenant {
    id: UUID [immutable, unique]
    slug: TenantSlug [unique, indexed]
    name: String { max_length: 255 }
    display_name: String?
    domain: TenantDomain? [unique, indexed]
    custom_domains: List<TenantDomain>?
    status: TenantStatus [default: PENDING]
    plan: TenantPlan [default: FREE]
    isolation_level: IsolationLevel [default: SHARED_SCHEMA]
    settings: Map<String, Any>
    branding: {
      logo_url: String?
      primary_color: String?
      favicon_url: String?
    }?
    limits: {
      max_users: Int?
      max_storage_gb: Int?
      max_api_calls_per_month: Int?
    }
    usage: {
      current_users: Int
      storage_used_gb: Decimal
      api_calls_this_month: Int
    }
    metadata: Map<String, String>
    owner_id: UUID
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      slug.length >= 3
      usage.current_users <= limits.max_users or limits.max_users == null
    }
  }
  
  entity TenantMember {
    id: UUID [immutable, unique]
    tenant_id: UUID [indexed]
    user_id: UUID [indexed]
    role: String [default: "member"]
    permissions: List<String>?
    invited_by: UUID?
    joined_at: Timestamp [immutable]
    
    invariants {
      (tenant_id, user_id) is unique
    }
  }
  
  entity TenantInvitation {
    id: UUID [immutable, unique]
    tenant_id: UUID [indexed]
    email: String [indexed]
    role: String [default: "member"]
    token_hash: String [indexed]
    expires_at: Timestamp
    created_at: Timestamp [immutable]
    accepted_at: Timestamp?
  }
  
  entity TenantAuditLog {
    id: UUID [immutable, unique]
    tenant_id: UUID [indexed]
    actor_id: UUID?
    action: String [indexed]
    resource_type: String?
    resource_id: UUID?
    details: Map<String, Any>?
    ip_address: String?
    created_at: Timestamp [immutable, indexed]
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior CreateTenant {
    description: "Create a new tenant"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      name: String
      slug: TenantSlug
      plan: TenantPlan?
      settings: Map<String, Any>?
    }
    
    output {
      success: {
        tenant: Tenant
        membership: TenantMember
      }
      
      errors {
        SLUG_TAKEN {
          when: "Tenant slug is already in use"
          retriable: false
        }
        SLUG_RESERVED {
          when: "Tenant slug is reserved"
          retriable: false
        }
        MAX_TENANTS_EXCEEDED {
          when: "User has reached maximum tenants"
          retriable: false
        }
      }
    }
    
    preconditions {
      not Tenant.exists(slug: input.slug)
      input.slug not in reserved_slugs
    }
    
    postconditions {
      success implies {
        Tenant.exists(result.tenant.id)
        TenantMember.exists(
          tenant_id: result.tenant.id,
          user_id: actor.id,
          role: "owner"
        )
      }
    }
    
    effects {
      AuditLog { log_tenant_created }
    }
  }
  
  behavior UpdateTenant {
    description: "Update tenant settings"
    
    actors {
      User { must: authenticated, role: "owner" }
      Admin { must: authenticated }
    }
    
    input {
      tenant_id: UUID
      name: String?
      display_name: String?
      settings: Map<String, Any>?
      branding: Map<String, Any>?
    }
    
    output {
      success: Tenant
      
      errors {
        TENANT_NOT_FOUND {
          when: "Tenant does not exist"
          retriable: false
        }
        INSUFFICIENT_PERMISSIONS {
          when: "Cannot update this tenant"
          retriable: false
        }
      }
    }
  }
  
  behavior AddCustomDomain {
    description: "Add a custom domain to tenant"
    
    actors {
      User { must: authenticated, role: ["owner", "admin"] }
    }
    
    input {
      tenant_id: UUID
      domain: TenantDomain
    }
    
    output {
      success: {
        tenant: Tenant
        verification_record: {
          type: String
          name: String
          value: String
        }
      }
      
      errors {
        DOMAIN_ALREADY_USED {
          when: "Domain is already in use"
          retriable: false
        }
        INVALID_DOMAIN {
          when: "Domain format is invalid"
          retriable: false
        }
        PLAN_LIMIT {
          when: "Custom domains not available on current plan"
          retriable: false
        }
      }
    }
  }
  
  behavior VerifyDomain {
    description: "Verify custom domain ownership"
    
    actors {
      User { must: authenticated, role: ["owner", "admin"] }
      System { }
    }
    
    input {
      tenant_id: UUID
      domain: TenantDomain
    }
    
    output {
      success: {
        verified: Boolean
        error: String?
      }
    }
  }
  
  behavior ResolveTenant {
    description: "Resolve tenant from domain or slug"
    
    actors {
      System { }
    }
    
    input {
      domain: TenantDomain?
      slug: TenantSlug?
    }
    
    output {
      success: {
        tenant: Tenant
        branding: Map<String, Any>?
      }
      
      errors {
        TENANT_NOT_FOUND {
          when: "No tenant found for this domain/slug"
          retriable: false
        }
        TENANT_SUSPENDED {
          when: "Tenant is suspended"
          retriable: false
        }
      }
    }
    
    temporal {
      response within 10ms (p99)
      cacheable for 5m
    }
  }
  
  behavior SwitchTenant {
    description: "Switch user context to a different tenant"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      tenant_id: UUID
    }
    
    output {
      success: {
        tenant: Tenant
        membership: TenantMember
        permissions: List<String>
      }
      
      errors {
        NOT_A_MEMBER {
          when: "User is not a member of this tenant"
          retriable: false
        }
        TENANT_SUSPENDED {
          when: "Tenant is suspended"
          retriable: false
        }
      }
    }
    
    preconditions {
      TenantMember.exists(tenant_id: input.tenant_id, user_id: actor.id)
    }
  }
  
  behavior InviteMember {
    description: "Invite a user to the tenant"
    
    actors {
      User { must: authenticated, role: ["owner", "admin"] }
    }
    
    input {
      tenant_id: UUID
      email: String
      role: String [default: "member"]
    }
    
    output {
      success: TenantInvitation
      
      errors {
        ALREADY_MEMBER {
          when: "User is already a member"
          retriable: false
        }
        SEAT_LIMIT {
          when: "Tenant has reached member limit"
          retriable: false
        }
      }
    }
    
    effects {
      Email { send_tenant_invitation }
    }
  }
  
  behavior UpdateMemberRole {
    description: "Update a member's role"
    
    actors {
      User { must: authenticated, role: "owner" }
    }
    
    input {
      tenant_id: UUID
      user_id: UUID
      role: String
    }
    
    output {
      success: TenantMember
    }
  }
  
  behavior SuspendTenant {
    description: "Suspend a tenant (admin action)"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      tenant_id: UUID
      reason: String
    }
    
    output {
      success: Tenant
    }
    
    postconditions {
      success implies {
        Tenant.lookup(input.tenant_id).status == SUSPENDED
      }
    }
  }
  
  behavior GetTenantUsage {
    description: "Get tenant usage statistics"
    
    actors {
      User { must: authenticated, role: ["owner", "admin"] }
    }
    
    input {
      tenant_id: UUID
    }
    
    output {
      success: {
        usage: {
          users: { current: Int, limit: Int? }
          storage_gb: { current: Decimal, limit: Int? }
          api_calls: { current: Int, limit: Int? }
        }
        billing_period: { start: Timestamp, end: Timestamp }
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios CreateTenant {
    scenario "create new tenant" {
      when {
        result = CreateTenant(
          name: "Acme Corp",
          slug: "acme"
        )
      }
      
      then {
        result is success
        result.tenant.slug == "acme"
        result.membership.role == "owner"
      }
    }
  }
  
  scenarios ResolveTenant {
    scenario "resolve by custom domain" {
      given {
        tenant = Tenant.create(
          slug: "acme",
          domain: "app.acme.com",
          status: ACTIVE
        )
      }
      
      when {
        result = ResolveTenant(domain: "app.acme.com")
      }
      
      then {
        result is success
        result.tenant.id == tenant.id
      }
    }
  }
}
