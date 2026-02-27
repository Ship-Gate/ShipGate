# Authorization Behaviors
# RBAC, permissions, access control

import { Auth } from "../domain.isl"

# ============================================
# Types
# ============================================

type PermissionAction = String {
  pattern: /^(read|write|delete|admin|create|update)$/
}

type ResourceId = String?

type ABACContext = Map<String, Any> {
  # Common attributes:
  # - ip_address: IPAddress
  # - time_of_day: Int
  # - day_of_week: Int
  # - resource_owner_id: UserId
  # - resource_metadata: Map<String, Any>
}

# ============================================
# Check Permission (RBAC)
# ============================================

behavior CheckPermission {
  description: "Check if user has permission for resource/action using RBAC"
  
  input {
    user_id: UserId
    resource: String
    action: PermissionAction
    resource_id: ResourceId?
  }
  
  output {
    success: {
      allowed: Boolean
      reason: String?
      matched_permission: PermissionId?
      matched_role: RoleId?
    }
    
    errors {
      USER_NOT_FOUND {
        when: "User does not exist"
        retriable: false
        http_status: 404
      }
    }
  }
  
  preconditions {
    input.user_id != null
    input.resource != null
    input.action != null
    User.exists(input.user_id)
  }
  
  postconditions {
    success implies {
      - result.allowed == true implies {
          - User.lookup(input.user_id).has_permission(permission) == true
            where permission == Permission(resource: input.resource, action: input.action)
          - result.matched_permission != null or result.matched_role != null
        }
      - result.allowed == false implies {
          - not User.lookup(input.user_id).has_permission(permission)
            where permission == Permission(resource: input.resource, action: input.action)
        }
    }
  }
  
  invariants {
    - permission check is idempotent (no side effects)
    - permission check is fast (< 10ms)
    - default deny if no permission matches
  }
  
  temporal {
    - within 5.ms (p50): permission check
    - within 10.ms (p99): permission check
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
# Token Invariants
# ============================================

invariants TokenSecurity {
  scope: global
  
  always {
    # Tokens are never stored in plaintext
    - all Token: token_hash != null and token_hash.length >= 64
    
    # Expired tokens cannot be valid
    - all Token: expires_at < now() implies is_valid == false
    
    # Revoked tokens cannot be valid
    - all Token: revoked_at != null implies is_valid == false
    
    # Token reuse detection
    - all Token: use_count <= max_uses if max_uses != null
    
    # Access tokens have shorter lifetime than refresh tokens
    - all Token where type == ACCESS: expires_at <= 
        Token.lookup_by_session(session_id).expires_at
        where Token.type == REFRESH
  }
}

# ============================================
# Scenarios
# ============================================

scenarios CheckPermission {
  scenario "user has direct permission" {
    given {
      user = User.create({ email: "user@example.com" })
      Permission.create({ 
        user_id: user.id,
        resource: "orders",
        action: "read"
      })
    }
    
    when {
      result = CheckPermission(
        user_id: user.id,
        resource: "orders",
        action: "read"
      )
    }
    
    then {
      result.success == true
      result.data.allowed == true
      result.data.matched_permission != null
    }
  }
  
  scenario "user has permission via role" {
    given {
      user = User.create({ email: "admin@example.com" })
      admin_role = Role.create({ id: "admin", permissions: ["users:all"] })
      User.assign_role(user.id, admin_role.id)
    }
    
    when {
      result = CheckPermission(
        user_id: user.id,
        resource: "users",
        action: "delete"
      )
    }
    
    then {
      result.success == true
      result.data.allowed == true
      result.data.matched_role == "admin"
    }
  }
  
  scenario "permission denied" {
    given {
      user = User.create({ email: "user@example.com" })
      # No permissions assigned
    }
    
    when {
      result = CheckPermission(
        user_id: user.id,
        resource: "admin_panel",
        action: "read"
      )
    }
    
    then {
      result.success == true
      result.data.allowed == false
    }
  }
  
  scenario "user not found" {
    when {
      result = CheckPermission(
        user_id: "non-existent-id",
        resource: "orders",
        action: "read"
      )
    }
    
    then {
      result.success == false
      result.error == USER_NOT_FOUND
    }
  }
}

scenarios EvaluatePolicy {
  scenario "ABAC policy permits access" {
    given {
      user = User.create({ email: "user@example.com", department: "sales" })
      Policy.create({
        resource: "reports",
        action: "read",
        condition: "user.department == 'sales' and time_of_day >= 9 and time_of_day <= 17"
      })
    }
    
    when {
      result = EvaluatePolicy(
        user_id: user.id,
        resource: "reports",
        action: "read",
        context: { time_of_day: 14 }
      )
    }
    
    then {
      result.success == true
      result.data.allowed == true
      result.data.decision == PERMIT
    }
  }
  
  scenario "ABAC policy denies access" {
    given {
      user = User.create({ email: "user@example.com", department: "sales" })
      Policy.create({
        resource: "reports",
        action: "read",
        condition: "user.department == 'sales' and time_of_day >= 9 and time_of_day <= 17"
      })
    }
    
    when {
      result = EvaluatePolicy(
        user_id: user.id,
        resource: "reports",
        action: "read",
        context: { time_of_day: 20 }  # Outside business hours
      )
    }
    
    then {
      result.success == true
      result.data.allowed == false
      result.data.decision == DENY
    }
  }
  
  scenario "ABAC falls back to RBAC when no policy matches" {
    given {
      user = User.create({ email: "user@example.com" })
      # No ABAC policy, but RBAC permission exists
      Permission.create({ user_id: user.id, resource: "orders", action: "read" })
    }
    
    when {
      result = EvaluatePolicy(
        user_id: user.id,
        resource: "orders",
        action: "read"
      )
    }
    
    then {
      result.success == true
      result.data.decision == NOT_APPLICABLE
      # Should fallback to RBAC check
    }
  }
}
