# Multi-Tenant SaaS — Canonical Sample
# Tenant isolation, subscription plans, and resource quotas
# Covers: pre/post, invariants, scenarios, security constraints

domain MultiTenantSaas {
  version: "1.0.0"

  enum PlanTier {
    FREE
    STARTER
    PRO
    ENTERPRISE
  }

  enum TenantStatus {
    ACTIVE
    SUSPENDED
    DEACTIVATED
  }

  entity Tenant {
    id: UUID [immutable, unique]
    name: String { min_length: 1, max_length: 100 }
    slug: String [unique, indexed]
    plan: PlanTier [default: FREE]
    status: TenantStatus [default: ACTIVE]
    max_users: Int
    max_storage_mb: Int
    created_at: Timestamp [immutable]

    invariants {
      plan == FREE implies max_users <= 5
      plan == STARTER implies max_users <= 20
      plan == PRO implies max_users <= 100
      plan == ENTERPRISE implies max_users <= 10000
      max_storage_mb > 0
      status == DEACTIVATED implies no active sessions
    }
  }

  entity TenantUser {
    id: UUID [immutable, unique]
    tenant_id: UUID [immutable, indexed]
    user_id: UUID [indexed]
    role: String [default: "member"]
    created_at: Timestamp [immutable]

    invariants {
      tenant_id references an existing Tenant
      (tenant_id, user_id) is unique
    }
  }

  entity Resource {
    id: UUID [immutable, unique]
    tenant_id: UUID [immutable, indexed]
    type: String [indexed]
    size_bytes: Int
    created_at: Timestamp [immutable]

    invariants {
      size_bytes >= 0
      tenant_id references an existing Tenant
    }
  }

  behavior CreateTenant {
    description: "Provision a new tenant"

    input {
      name: String
      slug: String
      plan: PlanTier?
      owner_user_id: UUID
    }

    output {
      success: Tenant
      errors {
        SLUG_TAKEN {
          when: "Slug is already in use"
          retriable: false
        }
        INVALID_SLUG {
          when: "Slug contains invalid characters"
          retriable: true
        }
      }
    }

    pre {
      slug.matches(/^[a-z0-9-]{3,50}$/)
      not Tenant.exists_by_slug(slug)
    }

    post success {
      - Tenant.exists(result.id)
      - result.slug == input.slug
      - result.status == ACTIVE
      - TenantUser.exists_for(result.id, input.owner_user_id) with role == "owner"
    }

    invariants {
      - owner is automatically added as first TenantUser
    }
  }

  behavior AddUserToTenant {
    description: "Invite a user to a tenant"

    input {
      tenant_id: UUID
      user_id: UUID
      role: String?
    }

    output {
      success: TenantUser
      errors {
        TENANT_NOT_FOUND {
          when: "Tenant does not exist"
          retriable: false
        }
        USER_ALREADY_MEMBER {
          when: "User is already a member of this tenant"
          retriable: false
        }
        USER_LIMIT_REACHED {
          when: "Tenant has reached its plan's user limit"
          retriable: false
        }
        TENANT_SUSPENDED {
          when: "Tenant is suspended or deactivated"
          retriable: false
        }
      }
    }

    pre {
      Tenant.exists(tenant_id)
      Tenant.lookup(tenant_id).status == ACTIVE
      TenantUser.count_for(tenant_id) < Tenant.lookup(tenant_id).max_users
      not TenantUser.exists_for(tenant_id, user_id)
    }

    post success {
      - TenantUser.exists_for(input.tenant_id, input.user_id)
      - TenantUser.count_for(input.tenant_id) == old(count) + 1
    }

    invariants {
      - user count never exceeds plan max_users
    }
  }

  behavior UpgradePlan {
    description: "Upgrade a tenant to a higher plan tier"

    input {
      tenant_id: UUID
      new_plan: PlanTier
    }

    output {
      success: Tenant
      errors {
        TENANT_NOT_FOUND {
          when: "Tenant does not exist"
          retriable: false
        }
        DOWNGRADE_NOT_ALLOWED {
          when: "Use DowngradePlan for lowering tier"
          retriable: false
        }
        ALREADY_ON_PLAN {
          when: "Tenant is already on this plan"
          retriable: false
        }
      }
    }

    pre {
      Tenant.exists(tenant_id)
      new_plan > Tenant.lookup(tenant_id).plan
    }

    post success {
      - result.plan == input.new_plan
      - result.max_users >= old(Tenant.lookup(tenant_id).max_users)
      - result.max_storage_mb >= old(Tenant.lookup(tenant_id).max_storage_mb)
    }

    invariants {
      - upgrade never reduces quotas
      - existing data preserved across plan change
    }
  }

  behavior QueryTenantData {
    description: "Query resources scoped to a single tenant"

    input {
      tenant_id: UUID
      resource_type: String?
      requesting_user_id: UUID
    }

    output {
      success: {
        resources: List<Resource>
        total_size_bytes: Int
      }
      errors {
        TENANT_NOT_FOUND {
          when: "Tenant does not exist"
          retriable: false
        }
        ACCESS_DENIED {
          when: "User is not a member of this tenant"
          retriable: false
        }
      }
    }

    pre {
      Tenant.exists(tenant_id)
      TenantUser.exists_for(tenant_id, requesting_user_id)
    }

    post success {
      - result.resources.all(r => r.tenant_id == input.tenant_id)
      - result.total_size_bytes == result.resources.sum(r => r.size_bytes)
    }

    invariants {
      - queries NEVER return data from another tenant
      - tenant_id filter is applied at database level, not application level
    }
  }

  behavior SuspendTenant {
    description: "Suspend a tenant (admin action)"

    input {
      tenant_id: UUID
      reason: String
    }

    output {
      success: Tenant
      errors {
        TENANT_NOT_FOUND {
          when: "Tenant does not exist"
          retriable: false
        }
        ALREADY_SUSPENDED {
          when: "Tenant is already suspended"
          retriable: false
        }
      }
    }

    pre {
      Tenant.exists(tenant_id)
      Tenant.lookup(tenant_id).status == ACTIVE
    }

    post success {
      - result.status == SUSPENDED
    }

    invariants {
      - suspended tenants cannot create new resources
      - existing resources are preserved but read-only
    }
  }

  scenario "Tenant isolation enforcement" {
    step t1 = CreateTenant({ name: "Acme", slug: "acme", owner_user_id: u1 })
    step t2 = CreateTenant({ name: "Globex", slug: "globex", owner_user_id: u2 })

    step query = QueryTenantData({ tenant_id: t1.result.id, requesting_user_id: u2 })
    assert query.error == ACCESS_DENIED

    step data = QueryTenantData({ tenant_id: t1.result.id, requesting_user_id: u1 })
    assert data.result.resources.all(r => r.tenant_id == t1.result.id)
  }

  scenario "User limit enforced by plan" {
    step tenant = CreateTenant({ name: "Small Co", slug: "small-co", plan: FREE, owner_user_id: u1 })
    # FREE plan allows max 5 users; owner is user #1

    step u2 = AddUserToTenant({ tenant_id: tenant.result.id, user_id: user2 })
    step u3 = AddUserToTenant({ tenant_id: tenant.result.id, user_id: user3 })
    step u4 = AddUserToTenant({ tenant_id: tenant.result.id, user_id: user4 })
    step u5 = AddUserToTenant({ tenant_id: tenant.result.id, user_id: user5 })

    step u6 = AddUserToTenant({ tenant_id: tenant.result.id, user_id: user6 })
    assert u6.error == USER_LIMIT_REACHED
  }
}
