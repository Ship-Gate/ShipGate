/**
 * Channel authorization implementation
 * @packageDocumentation
 */

import type {
  ChannelId,
  ConnectionId,
  UserId,
} from '../types.js';
import type {
  ChannelAuthorizer,
  AuthorizationRequest,
  AuthorizationResult,
  AuthorizationContext,
} from './types.js';
import { AuthorizationError } from '../errors.js';

// ============================================================================
// Default Authorization Rules
// ============================================================================

export class DefaultChannelAuthorizer implements ChannelAuthorizer {
  constructor(
    private readonly options: {
      publicChannels?: string[];
      requireAuthForSubscribe?: boolean;
      requireAuthForPublish?: boolean;
      adminPermissions?: string[];
      defaultPermissions?: string[];
    } = {}
  ) {}

  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const { action, channelId, context } = request;

    // Check if user is admin — use explicit permission set, not wildcard
    if (this.isAdmin(context)) {
      return {
        allowed: true,
        permissions: this.options.adminPermissions || ['read', 'write', 'subscribe', 'publish', 'manage'],
      };
    }

    // Check public channel access
    if (this.isPublicChannel(channelId)) {
      return {
        allowed: true,
        permissions: this.options.defaultPermissions || ['read', 'write'],
      };
    }

    // Apply action-specific rules
    switch (action) {
      case 'subscribe':
        return this.authorizeSubscribe(channelId, context);
      
      case 'publish':
        return this.authorizePublish(channelId, context);
      
      case 'unsubscribe':
        // Always allow unsubscribe
        return { allowed: true };
      
      default:
        return {
          allowed: false,
          reason: `Unknown action: ${action}`,
        };
    }
  }

  private authorizeSubscribe(channelId: ChannelId, context: AuthorizationContext): AuthorizationResult {
    if (this.options.requireAuthForSubscribe && !context.userId) {
      return {
        allowed: false,
        reason: 'Authentication required for subscription',
      };
    }

    // Check explicit permissions
    if (context.permissions.includes('subscribe') || 
        context.permissions.includes(`${channelId}:subscribe`)) {
      return {
        allowed: true,
        permissions: context.permissions,
      };
    }

    return {
      allowed: false,
      reason: 'Insufficient permissions to subscribe',
    };
  }

  private authorizePublish(channelId: ChannelId, context: AuthorizationContext): AuthorizationResult {
    if (this.options.requireAuthForPublish && !context.userId) {
      return {
        allowed: false,
        reason: 'Authentication required for publishing',
      };
    }

    // Check explicit permissions
    if (context.permissions.includes('publish') || 
        context.permissions.includes(`${channelId}:publish`) ||
        context.permissions.includes('write')) {
      return {
        allowed: true,
        permissions: context.permissions,
      };
    }

    return {
      allowed: false,
      reason: 'Insufficient permissions to publish',
    };
  }

  private isAdmin(context: AuthorizationContext): boolean {
    return this.options.adminPermissions?.some(perm => 
      context.permissions.includes(perm)
    ) || context.permissions.includes('admin') || context.permissions.includes('*');
  }

  private isPublicChannel(channelId: ChannelId): boolean {
    return this.options.publicChannels?.includes('*') ||
           this.options.publicChannels?.includes(channelId) || 
           channelId.startsWith('public:') ||
           channelId.startsWith('broadcast:');
  }
}

// ============================================================================
// Role-Based Authorization
// ============================================================================

export interface Role {
  name: string;
  permissions: string[];
  inherits?: string[];
}

export interface User {
  id: UserId;
  roles: string[];
  permissions?: string[];
}

export class RoleBasedAuthorizer implements ChannelAuthorizer {
  private readonly roles = new Map<string, Role>();
  private readonly users = new Map<UserId, User>();

  constructor(
    roles: Role[] = [],
    users: User[] = []
  ) {
    // Register roles
    for (const role of roles) {
      this.roles.set(role.name, role);
    }

    // Register users
    for (const user of users) {
      this.users.set(user.id, user);
    }
  }

  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const { action, channelId, context } = request;

    if (!context.userId) {
      // Anonymous user - check default permissions
      return {
        allowed: action === 'subscribe' && channelId.startsWith('public:'),
        reason: !channelId.startsWith('public:') ? 'Authentication required' : undefined,
      };
    }

    const user = this.users.get(context.userId);
    if (!user) {
      return {
        allowed: false,
        reason: 'User not found',
      };
    }

    // Resolve all permissions for the user
    const permissions = this.resolvePermissions(user);

    // Check for wildcard permission
    if (permissions.includes('*')) {
      return {
        allowed: true,
        permissions,
      };
    }

    // Check action-specific permissions
    const requiredPermissions = this.getRequiredPermissions(action, channelId);
    const hasPermission = requiredPermissions.some(perm => 
      permissions.includes(perm)
    );

    return {
      allowed: hasPermission,
      permissions,
      reason: hasPermission ? undefined : 'Insufficient permissions',
    };
  }

  private resolvePermissions(user: User): string[] {
    const permissions = new Set(user.permissions || []);

    // Add permissions from roles
    for (const roleName of user.roles) {
      const role = this.roles.get(roleName);
      if (role) {
        // Add role permissions
        role.permissions.forEach(perm => permissions.add(perm));

        // Add inherited permissions
        if (role.inherits) {
          for (const inheritedRole of role.inherits) {
            const parentRole = this.roles.get(inheritedRole);
            if (parentRole) {
              parentRole.permissions.forEach(perm => permissions.add(perm));
            }
          }
        }
      }
    }

    return Array.from(permissions);
  }

  private getRequiredPermissions(action: string, channelId: ChannelId): string[] {
    switch (action) {
      case 'subscribe':
        return [
          'subscribe',
          `${channelId}:subscribe`,
          'read',
          `${channelId}:read`,
        ];
      
      case 'publish':
        return [
          'publish',
          `${channelId}:publish`,
          'write',
          `${channelId}:write`,
        ];
      
      case 'unsubscribe':
        return [
          'unsubscribe',
          `${channelId}:unsubscribe`,
        ];
      
      default:
        return [];
    }
  }

  // ============================================================================
  // Role and User Management
  // ============================================================================

  addRole(role: Role): void {
    this.roles.set(role.name, role);
  }

  removeRole(name: string): boolean {
    return this.roles.delete(name);
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  removeUser(userId: UserId): boolean {
    return this.users.delete(userId);
  }

  getUser(userId: UserId): User | undefined {
    return this.users.get(userId);
  }

  getRole(name: string): Role | undefined {
    return this.roles.get(name);
  }
}

// ============================================================================
// Token-Based Authorization
// ============================================================================

export interface TokenPayload {
  sub: UserId; // Subject (user ID)
  permissions?: string[];
  roles?: string[];
  exp?: number; // Expiration
  iat?: number; // Issued at
  channelId?: ChannelId; // Optional channel-specific token
}

export interface TokenValidator {
  validate(token: string): Promise<TokenPayload | null>;
}

export class TokenBasedAuthorizer implements ChannelAuthorizer {
  constructor(
    private readonly tokenValidator: TokenValidator,
    private readonly fallbackAuthorizer?: ChannelAuthorizer
  ) {}

  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const { action, channelId, context } = request;

    // Try to extract and validate token from metadata
    const token = context.metadata?.token;
    if (!token) {
      // No token, use fallback if available
      if (this.fallbackAuthorizer) {
        return this.fallbackAuthorizer.authorize(request);
      }
      
      return {
        allowed: false,
        reason: 'No authentication token provided',
      };
    }

    // Validate token
    const payload = await this.tokenValidator.validate(token);
    if (!payload) {
      return {
        allowed: false,
        reason: 'Invalid or expired token',
      };
    }

    // Check token expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return {
        allowed: false,
        reason: 'Token expired',
      };
    }

    // Check if token is channel-specific
    if (payload.channelId && payload.channelId !== channelId) {
      return {
        allowed: false,
        reason: 'Token is not valid for this channel',
      };
    }

    // Build permissions from token
    const permissions = new Set(payload.permissions || []);

    // Add role-based permissions if roles are present
    if (payload.roles) {
      for (const role of payload.roles) {
        permissions.add(`role:${role}`);
      }
    }

    // Check required permissions
    const requiredPermissions = this.getRequiredPermissions(action, channelId);
    const hasPermission = requiredPermissions.some(perm => 
      permissions.has(perm)
    );

    return {
      allowed: hasPermission,
      permissions: Array.from(permissions),
      reason: hasPermission ? undefined : 'Insufficient permissions in token',
    };
  }

  private getRequiredPermissions(action: string, channelId: ChannelId): string[] {
    switch (action) {
      case 'subscribe':
        return ['subscribe', `${channelId}:subscribe`, 'read', `${channelId}:read`];
      case 'publish':
        return ['publish', `${channelId}:publish`, 'write', `${channelId}:write`];
      case 'unsubscribe':
        return ['unsubscribe', `${channelId}:unsubscribe`];
      default:
        return [];
    }
  }
}

// ============================================================================
// Composite Authorization (multiple strategies)
// ============================================================================

export class CompositeAuthorizer implements ChannelAuthorizer {
  constructor(
    private readonly authorizers: ChannelAuthorizer[],
    private readonly strategy: 'any' | 'all' = 'any'
  ) {}

  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    if (this.authorizers.length === 0) {
      return {
        allowed: false,
        reason: 'No authorizers configured',
      };
    }

    const results: AuthorizationResult[] = [];

    for (const authorizer of this.authorizers) {
      try {
        const result = await authorizer.authorize(request);
        results.push(result);

        if (this.strategy === 'any' && result.allowed) {
          return result;
        }
      } catch (error) {
        results.push({
          allowed: false,
          reason: `Authorizer error: ${error.message}`,
        });
      }
    }

    if (this.strategy === 'all') {
      const allAllowed = results.every(r => r.allowed);
      if (allAllowed) {
        // Merge permissions from all results
        const allPermissions = new Set<string>();
        for (const result of results) {
          if (result.permissions) {
            result.permissions.forEach(p => allPermissions.add(p));
          }
        }

        return {
          allowed: true,
          permissions: Array.from(allPermissions),
        };
      }
    }

    // If we get here, authorization failed
    return {
      allowed: false,
      reason: results.map(r => r.reason).filter(Boolean).join('; ') || 'Authorization failed',
    };
  }
}

// ============================================================================
// Authorization Factory
// ============================================================================

export class AuthorizationFactory {
  static default(options?: {
    publicChannels?: string[];
    requireAuthForSubscribe?: boolean;
    requireAuthForPublish?: boolean;
    adminPermissions?: string[];
  }): ChannelAuthorizer {
    return new DefaultChannelAuthorizer(options);
  }

  static roleBased(
    roles: Role[] = [],
    users: User[] = []
  ): RoleBasedAuthorizer {
    return new RoleBasedAuthorizer(roles, users);
  }

  static tokenBased(
    tokenValidator: TokenValidator,
    fallback?: ChannelAuthorizer
  ): TokenBasedAuthorizer {
    return new TokenBasedAuthorizer(tokenValidator, fallback);
  }

  static composite(
    authorizers: ChannelAuthorizer[],
    strategy: 'any' | 'all' = 'any'
  ): CompositeAuthorizer {
    return new CompositeAuthorizer(authorizers, strategy);
  }
}
