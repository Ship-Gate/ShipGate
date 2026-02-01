# Role-Based Access Control (RBAC) Domain
# Complete RBAC implementation with roles, permissions, and resource-level access

domain RBAC {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type PermissionId = String { max_length: 100 }
  type RoleId = String { max_length: 100 }
  type ResourceType = String { max_length: 100 }
  type ResourceId = String { max_length: 255 }
  
  enum Action {
    CREATE
    READ
    UPDATE
    DELETE
    EXECUTE
    MANAGE
    ADMIN
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity Permission {
    id: UUID [immutable, unique]
    name: PermissionId [unique, indexed]
    description: String?
    resource_type: ResourceType
    action: Action
    conditions: Map<String, String>?
    created_at: Timestamp [immutable]
    
    invariants {
      name.length > 0
    }
  }
  
  entity Role {
    id: UUID [immutable, unique]
    name: RoleId [unique, indexed]
    description: String?
    permissions: List<PermissionId>
    is_system_role: Boolean [default: false]
    parent_role: RoleId?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      name.length > 0
      parent_role != name  # No self-reference
    }
  }
  
  entity UserRole {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    role_id: RoleId [indexed]
    resource_type: ResourceType?
    resource_id: ResourceId?
    granted_by: UUID
    expires_at: Timestamp?
    created_at: Timestamp [immutable]
    
    invariants {
      expires_at == null or expires_at > created_at
      resource_id != null implies resource_type != null
    }
  }
  
  entity AccessPolicy {
    id: UUID [immutable, unique]
    name: String { max_length: 255 }
    description: String?
    resource_type: ResourceType
    conditions: String  # Policy expression
    effect: String [values: ["allow", "deny"]]
    priority: Int [default: 0]
    is_active: Boolean [default: true]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior CreateRole {
    description: "Create a new role with permissions"
    
    actors {
      Admin { must: authenticated, permission: "roles:create" }
    }
    
    input {
      name: RoleId
      description: String?
      permissions: List<PermissionId>
      parent_role: RoleId?
    }
    
    output {
      success: Role
      
      errors {
        ROLE_ALREADY_EXISTS {
          when: "A role with this name already exists"
          retriable: false
        }
        INVALID_PERMISSION {
          when: "One or more permissions do not exist"
          retriable: false
        }
        INVALID_PARENT_ROLE {
          when: "Parent role does not exist"
          retriable: false
        }
        CIRCULAR_DEPENDENCY {
          when: "Role hierarchy would create a cycle"
          retriable: false
        }
      }
    }
    
    preconditions {
      not Role.exists(name: input.name)
      input.permissions.all(p => Permission.exists(name: p))
      input.parent_role == null or Role.exists(name: input.parent_role)
    }
    
    postconditions {
      success implies {
        Role.exists(name: result.name)
        Role.lookup(result.name).permissions == input.permissions
      }
    }
    
    security {
      audit_log enabled
    }
  }
  
  behavior AssignRole {
    description: "Assign a role to a user"
    
    actors {
      Admin { must: authenticated, permission: "roles:assign" }
    }
    
    input {
      user_id: UUID
      role_id: RoleId
      resource_type: ResourceType?
      resource_id: ResourceId?
      expires_at: Timestamp?
    }
    
    output {
      success: UserRole
      
      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        ROLE_NOT_FOUND {
          when: "Role does not exist"
          retriable: false
        }
        ALREADY_ASSIGNED {
          when: "User already has this role for this resource"
          retriable: false
        }
        INSUFFICIENT_PRIVILEGES {
          when: "Cannot assign role with higher privileges"
          retriable: false
        }
      }
    }
    
    preconditions {
      User.exists(input.user_id)
      Role.exists(name: input.role_id)
      not UserRole.exists(
        user_id: input.user_id, 
        role_id: input.role_id,
        resource_id: input.resource_id
      )
    }
    
    postconditions {
      success implies {
        UserRole.exists(
          user_id: input.user_id,
          role_id: input.role_id
        )
      }
    }
    
    temporal {
      immediately: role effective for user
      eventually within 5s: caches invalidated
    }
    
    security {
      audit_log enabled
    }
  }
  
  behavior RevokeRole {
    description: "Remove a role from a user"
    
    actors {
      Admin { must: authenticated, permission: "roles:revoke" }
    }
    
    input {
      user_id: UUID
      role_id: RoleId
      resource_type: ResourceType?
      resource_id: ResourceId?
    }
    
    output {
      success: Boolean
      
      errors {
        ASSIGNMENT_NOT_FOUND {
          when: "User does not have this role"
          retriable: false
        }
        CANNOT_REVOKE_SYSTEM_ROLE {
          when: "System roles cannot be revoked"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        not UserRole.exists(
          user_id: input.user_id,
          role_id: input.role_id,
          resource_id: input.resource_id
        )
      }
    }
    
    temporal {
      immediately: role revoked
      eventually within 5s: active sessions updated
    }
  }
  
  behavior CheckPermission {
    description: "Check if a user has a specific permission"
    
    actors {
      System { }
    }
    
    input {
      user_id: UUID
      permission: PermissionId
      resource_type: ResourceType?
      resource_id: ResourceId?
      context: Map<String, String>?
    }
    
    output {
      success: {
        allowed: Boolean
        reason: String?
        matched_role: RoleId?
        matched_policy: String?
      }
      
      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
      }
    }
    
    temporal {
      response within 10ms (p50)
      response within 50ms (p99)
    }
    
    security {
      cache_result for 60s
    }
  }
  
  behavior ListUserPermissions {
    description: "Get all effective permissions for a user"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      user_id: UUID
      resource_type: ResourceType?
      resource_id: ResourceId?
    }
    
    output {
      success: {
        permissions: List<{
          permission: PermissionId
          source_role: RoleId
          resource_scope: String?
        }>
        roles: List<RoleId>
      }
      
      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Cannot view other user's permissions"
          retriable: false
        }
      }
    }
  }
  
  behavior CreatePolicy {
    description: "Create an access policy for fine-grained control"
    
    actors {
      Admin { must: authenticated, permission: "policies:create" }
    }
    
    input {
      name: String
      description: String?
      resource_type: ResourceType
      conditions: String
      effect: String
      priority: Int?
    }
    
    output {
      success: AccessPolicy
      
      errors {
        INVALID_CONDITIONS {
          when: "Policy conditions syntax is invalid"
          retriable: false
        }
        POLICY_CONFLICT {
          when: "Policy conflicts with existing policies"
          retriable: false
        }
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios CheckPermission {
    scenario "user with direct permission" {
      given {
        role = Role.create(
          name: "editor",
          permissions: ["articles:read", "articles:update"]
        )
        user_role = UserRole.create(
          user_id: user.id,
          role_id: "editor"
        )
      }
      
      when {
        result = CheckPermission(
          user_id: user.id,
          permission: "articles:update"
        )
      }
      
      then {
        result is success
        result.allowed == true
        result.matched_role == "editor"
      }
    }
    
    scenario "user with inherited permission" {
      given {
        admin_role = Role.create(
          name: "admin",
          permissions: ["*:*"]
        )
        editor_role = Role.create(
          name: "editor",
          permissions: ["articles:read"],
          parent_role: "admin"
        )
        user_role = UserRole.create(
          user_id: user.id,
          role_id: "editor"
        )
      }
      
      when {
        result = CheckPermission(
          user_id: user.id,
          permission: "users:delete"
        )
      }
      
      then {
        result is success
        result.allowed == true
      }
    }
    
    scenario "resource-scoped permission" {
      given {
        user_role = UserRole.create(
          user_id: user.id,
          role_id: "project-admin",
          resource_type: "project",
          resource_id: "project-123"
        )
      }
      
      when {
        result = CheckPermission(
          user_id: user.id,
          permission: "project:delete",
          resource_type: "project",
          resource_id: "project-123"
        )
      }
      
      then {
        result is success
        result.allowed == true
      }
    }
    
    scenario "permission denied" {
      given {
        user_role = UserRole.create(
          user_id: user.id,
          role_id: "viewer"
        )
      }
      
      when {
        result = CheckPermission(
          user_id: user.id,
          permission: "articles:delete"
        )
      }
      
      then {
        result is success
        result.allowed == false
      }
    }
  }
}
