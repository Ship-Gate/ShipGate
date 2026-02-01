# Authorization Behaviors
# RBAC, permissions, access control

import { Auth } from "../domain.isl"

# ============================================
# Check Permission
# ============================================

behavior CheckPermission {
  description: "Check if user has permission for resource/action"
  
  input {
    user_id: UserId
    resource: String
    action: PermissionAction
    context: Map<String, Any>?  # For ABAC conditions
  }
  
  output {
    success: {
      allowed: Boolean
      reason: String?
      matched_permission: Permission?
    }
  }
  
  preconditions {
    input.user_id != null
    input.resource != null
    input.action != null
  }
  
  postconditions {
    result.allowed == true implies {
      - User has direct permission
        or User.role has permission
        or User.role inherits permission from parent
    }
  }
  
  temporal {
    - within 5.ms (p99): permission check
  }
  
  # Permission resolution order:
  # 1. Direct user permissions (highest priority)
  # 2. Role permissions
  # 3. Inherited role permissions
  # 4. Default deny
}

# ============================================
# Require Permission (Guard)
# ============================================

behavior RequirePermission {
  description: "Guard that throws if permission denied"
  
  input {
    resource: String
    action: PermissionAction
    resource_id: String?
  }
  
  output {
    success: {}
    
    errors {
      UNAUTHORIZED {
        when: "User not authenticated"
        http_status: 401
      }
      FORBIDDEN {
        when: "User lacks required permission"
        http_status: 403
        data: { required: Permission }
      }
    }
  }
  
  preconditions {
    context.authenticated
  }
  
  postconditions {
    success implies {
      CheckPermission(
        user_id: context.user.id,
        resource: input.resource,
        action: input.action
      ).allowed == true
    }
  }
}

# ============================================
# Grant Permission
# ============================================

behavior GrantPermission {
  description: "Grant permission to user or role"
  
  actors {
    Admin {
      requires: permission("permissions", ADMIN)
    }
  }
  
  input {
    target_type: "user" | "role"
    target_id: UUID
    permission: Permission
  }
  
  output {
    success: {}
    
    errors {
      TARGET_NOT_FOUND {
        when: "User or role does not exist"
      }
      PERMISSION_EXISTS {
        when: "Permission already granted"
      }
      INVALID_PERMISSION {
        when: "Permission is invalid"
      }
    }
  }
  
  postconditions {
    success implies {
      - target has permission
      - AuditLog.created(action: PERMISSION_GRANTED)
    }
  }
}

# ============================================
# Revoke Permission
# ============================================

behavior RevokePermission {
  description: "Revoke permission from user or role"
  
  actors {
    Admin {
      requires: permission("permissions", ADMIN)
    }
  }
  
  input {
    target_type: "user" | "role"
    target_id: UUID
    permission_id: UUID
  }
  
  output {
    success: {}
    
    errors {
      TARGET_NOT_FOUND {}
      PERMISSION_NOT_FOUND {}
      CANNOT_REVOKE_SYSTEM {
        when: "Cannot revoke system permissions"
      }
    }
  }
  
  postconditions {
    success implies {
      - target no longer has permission
      - AuditLog.created(action: PERMISSION_REVOKED)
    }
  }
}

# ============================================
# Assign Role
# ============================================

behavior AssignRole {
  description: "Assign role to user"
  
  actors {
    Admin {
      requires: permission("roles", ADMIN)
    }
  }
  
  input {
    user_id: UserId
    role_id: UUID
  }
  
  output {
    success: {
      user: User
    }
    
    errors {
      USER_NOT_FOUND {}
      ROLE_NOT_FOUND {}
      ROLE_ALREADY_ASSIGNED {}
    }
  }
  
  postconditions {
    success implies {
      - User.roles contains Role(input.role_id)
      - User inherits Role.permissions
    }
  }
}

# ============================================
# Create Role
# ============================================

behavior CreateRole {
  description: "Create a new role"
  
  actors {
    Admin {
      requires: permission("roles", CREATE)
    }
  }
  
  input {
    name: String { min_length: 1, max_length: 64 }
    description: String?
    permissions: Set<Permission>?
    parent_role_id: UUID?  # For inheritance
  }
  
  output {
    success: {
      role: Role
    }
    
    errors {
      NAME_EXISTS {
        when: "Role name already exists"
      }
      PARENT_NOT_FOUND {
        when: "Parent role does not exist"
      }
      CYCLIC_HIERARCHY {
        when: "Would create circular inheritance"
      }
    }
  }
  
  postconditions {
    success implies {
      - Role.exists(name: input.name)
      - Role.permissions == input.permissions
      - input.parent_role_id implies Role.parent == Role(input.parent_role_id)
    }
  }
}

# ============================================
# ABAC - Attribute Based Access Control
# ============================================

behavior EvaluatePolicy {
  description: "Evaluate ABAC policy"
  
  input {
    policy_id: UUID
    subject: Map<String, Any>    # User attributes
    resource: Map<String, Any>   # Resource attributes
    action: String
    environment: Map<String, Any>?  # Time, IP, etc.
  }
  
  output {
    success: {
      decision: PolicyDecision
      obligations: List<Obligation>?
    }
  }
  
  type PolicyDecision = PERMIT | DENY | NOT_APPLICABLE
  
  type Obligation = {
    action: String
    parameters: Map<String, Any>
  }
}

# ============================================
# Standard Roles
# ============================================

constants StandardRoles {
  SUPER_ADMIN = Role {
    name: "super_admin"
    permissions: [Permission(resource: "*", action: ALL)]
    is_system_role: true
  }
  
  ADMIN = Role {
    name: "admin"
    permissions: [
      Permission(resource: "users", action: ALL),
      Permission(resource: "roles", action: ALL),
      Permission(resource: "permissions", action: READ)
    ]
  }
  
  USER = Role {
    name: "user"
    permissions: [
      Permission(resource: "profile", action: ALL),
      Permission(resource: "sessions", action: ALL)
    ]
  }
  
  READONLY = Role {
    name: "readonly"
    permissions: [
      Permission(resource: "*", action: READ)
    ]
  }
}

# ============================================
# Scenarios
# ============================================

scenarios CheckPermission {
  scenario "user has direct permission" {
    given {
      User has Permission(resource: "orders", action: READ)
    }
    
    when {
      result = CheckPermission(
        user_id: user.id,
        resource: "orders",
        action: READ
      )
    }
    
    then {
      result.allowed == true
    }
  }
  
  scenario "user has permission via role" {
    given {
      User has Role "admin"
      Role "admin" has Permission(resource: "users", action: ALL)
    }
    
    when {
      result = CheckPermission(
        user_id: user.id,
        resource: "users",
        action: DELETE
      )
    }
    
    then {
      result.allowed == true
    }
  }
  
  scenario "permission denied" {
    given {
      User has no Permission for "admin_panel"
    }
    
    when {
      result = CheckPermission(
        user_id: user.id,
        resource: "admin_panel",
        action: READ
      )
    }
    
    then {
      result.allowed == false
    }
  }
}
