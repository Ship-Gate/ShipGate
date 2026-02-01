/**
 * Role-Based Access Control (RBAC)
 */

import type { User, Role, Permission, PermissionAction, AuthResult } from './types';

export interface RBACStore {
  findRole(id: string): Promise<Role | null>;
  findRoleByName(name: string): Promise<Role | null>;
  findAllRoles(): Promise<Role[]>;
  createRole(role: Omit<Role, 'id' | 'createdAt'>): Promise<Role>;
  updateRole(id: string, updates: Partial<Role>): Promise<Role>;
  deleteRole(id: string): Promise<void>;
  
  findPermission(id: string): Promise<Permission | null>;
  createPermission(permission: Omit<Permission, 'id'>): Promise<Permission>;
  deletePermission(id: string): Promise<void>;
  
  assignRoleToUser(userId: string, roleId: string): Promise<void>;
  removeRoleFromUser(userId: string, roleId: string): Promise<void>;
  getUserRoles(userId: string): Promise<Role[]>;
  
  grantPermissionToRole(roleId: string, permissionId: string): Promise<void>;
  revokePermissionFromRole(roleId: string, permissionId: string): Promise<void>;
  
  grantPermissionToUser(userId: string, permissionId: string): Promise<void>;
  revokePermissionFromUser(userId: string, permissionId: string): Promise<void>;
  getUserDirectPermissions(userId: string): Promise<Permission[]>;
}

export class RBACService {
  constructor(private store: RBACStore) {}

  /**
   * Check if user has permission
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: PermissionAction,
    context?: Record<string, unknown>
  ): Promise<{ allowed: boolean; reason?: string; matchedPermission?: Permission }> {
    // Get direct user permissions
    const directPermissions = await this.store.getUserDirectPermissions(userId);
    
    // Check direct permissions first (highest priority)
    for (const permission of directPermissions) {
      if (this.matchesPermission(permission, resource, action, context)) {
        return {
          allowed: true,
          reason: 'Direct user permission',
          matchedPermission: permission,
        };
      }
    }

    // Get user roles
    const roles = await this.store.getUserRoles(userId);
    
    // Check role permissions (including inherited)
    for (const role of roles) {
      const rolePermissions = await this.getAllRolePermissions(role);
      
      for (const permission of rolePermissions) {
        if (this.matchesPermission(permission, resource, action, context)) {
          return {
            allowed: true,
            reason: `Role permission via ${role.name}`,
            matchedPermission: permission,
          };
        }
      }
    }

    return {
      allowed: false,
      reason: 'No matching permission found',
    };
  }

  /**
   * Get all permissions for a role (including inherited)
   */
  async getAllRolePermissions(role: Role): Promise<Permission[]> {
    const permissions = [...role.permissions];

    if (role.inheritsPermissions && role.parentId) {
      const parent = await this.store.findRole(role.parentId);
      if (parent) {
        const parentPermissions = await this.getAllRolePermissions(parent);
        permissions.push(...parentPermissions);
      }
    }

    return permissions;
  }

  /**
   * Create a new role
   */
  async createRole(input: {
    name: string;
    description?: string;
    permissions?: Permission[];
    parentRoleId?: string;
  }): Promise<AuthResult<Role>> {
    // Check name uniqueness
    const existing = await this.store.findRoleByName(input.name);
    if (existing) {
      return {
        ok: false,
        error: {
          code: 'NAME_EXISTS',
          message: 'Role name already exists',
        },
      };
    }

    // Check parent exists
    if (input.parentRoleId) {
      const parent = await this.store.findRole(input.parentRoleId);
      if (!parent) {
        return {
          ok: false,
          error: {
            code: 'PARENT_NOT_FOUND',
            message: 'Parent role does not exist',
          },
        };
      }
    }

    const role = await this.store.createRole({
      name: input.name,
      description: input.description,
      permissions: input.permissions || [],
      parentId: input.parentRoleId,
      inheritsPermissions: !!input.parentRoleId,
      isSystemRole: false,
    });

    return { ok: true, data: role };
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string): Promise<AuthResult<void>> {
    const role = await this.store.findRole(roleId);
    if (!role) {
      return {
        ok: false,
        error: {
          code: 'ROLE_NOT_FOUND',
          message: 'Role does not exist',
        },
      };
    }

    await this.store.assignRoleToUser(userId, roleId);
    return { ok: true, data: undefined };
  }

  /**
   * Grant permission to user
   */
  async grantPermission(
    targetType: 'user' | 'role',
    targetId: string,
    resource: string,
    action: PermissionAction,
    conditions?: Record<string, unknown>
  ): Promise<AuthResult<Permission>> {
    const permission = await this.store.createPermission({
      resource,
      action,
      conditions,
    });

    if (targetType === 'user') {
      await this.store.grantPermissionToUser(targetId, permission.id);
    } else {
      await this.store.grantPermissionToRole(targetId, permission.id);
    }

    return { ok: true, data: permission };
  }

  /**
   * Get all permissions for a user (direct + role-based)
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const permissions: Permission[] = [];

    // Direct permissions
    const directPermissions = await this.store.getUserDirectPermissions(userId);
    permissions.push(...directPermissions);

    // Role permissions
    const roles = await this.store.getUserRoles(userId);
    for (const role of roles) {
      const rolePermissions = await this.getAllRolePermissions(role);
      permissions.push(...rolePermissions);
    }

    // Deduplicate
    const seen = new Set<string>();
    return permissions.filter((p) => {
      const key = `${p.resource}:${p.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Private methods

  private matchesPermission(
    permission: Permission,
    resource: string,
    action: PermissionAction,
    context?: Record<string, unknown>
  ): boolean {
    // Check resource match
    if (permission.resource !== '*' && permission.resource !== resource) {
      // Check wildcard patterns
      if (!this.matchesWildcard(permission.resource, resource)) {
        return false;
      }
    }

    // Check action match
    if (permission.action !== 'all' && permission.action !== action) {
      return false;
    }

    // Check conditions (ABAC)
    if (permission.conditions && context) {
      if (!this.evaluateConditions(permission.conditions, context)) {
        return false;
      }
    }

    return true;
  }

  private matchesWildcard(pattern: string, value: string): boolean {
    // Simple wildcard matching: "users:*" matches "users:read", "users:write"
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(value);
  }

  private evaluateConditions(
    conditions: Record<string, unknown>,
    context: Record<string, unknown>
  ): boolean {
    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = context[key];

      if (typeof expectedValue === 'object' && expectedValue !== null) {
        // Complex condition (e.g., { $in: [...] })
        const condition = expectedValue as Record<string, unknown>;
        
        if ('$in' in condition) {
          const allowedValues = condition.$in as unknown[];
          if (!allowedValues.includes(actualValue)) {
            return false;
          }
        }

        if ('$eq' in condition) {
          if (actualValue !== condition.$eq) {
            return false;
          }
        }

        if ('$ne' in condition) {
          if (actualValue === condition.$ne) {
            return false;
          }
        }
      } else {
        // Simple equality check
        if (actualValue !== expectedValue) {
          return false;
        }
      }
    }

    return true;
  }
}

/**
 * Standard roles
 */
export const StandardRoles = {
  SUPER_ADMIN: {
    name: 'super_admin',
    description: 'Full system access',
    permissions: [{ resource: '*', action: 'all' as PermissionAction }],
    isSystemRole: true,
  },
  ADMIN: {
    name: 'admin',
    description: 'Administrative access',
    permissions: [
      { resource: 'users', action: 'all' as PermissionAction },
      { resource: 'roles', action: 'all' as PermissionAction },
    ],
    isSystemRole: true,
  },
  USER: {
    name: 'user',
    description: 'Standard user access',
    permissions: [
      { resource: 'profile', action: 'all' as PermissionAction },
      { resource: 'sessions', action: 'all' as PermissionAction },
    ],
    isSystemRole: true,
  },
};

/**
 * Create RBAC service
 */
export function createRBACService(store: RBACStore): RBACService {
  return new RBACService(store);
}
