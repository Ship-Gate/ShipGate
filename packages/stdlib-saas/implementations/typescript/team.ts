// ============================================================================
// Team Management Operations
// ============================================================================

import { randomUUID } from 'crypto';
import {
  TeamMember,
  TeamMemberId,
  TeamRole,
  OrganizationId,
  UserId,
  Email,
  SubscriptionPlan,
  InviteTeamMemberInput,
  InviteTeamMemberOutput,
  AcceptInvitationInput,
  OrganizationRepository,
  TeamMemberRepository,
  EventEmitter,
  Result,
  success,
  failure,
  SaasException,
  SaasErrorCode,
  PLAN_LIMITS,
} from './types.js';

// ============================================================================
// Role Hierarchy
// ============================================================================

const ROLE_HIERARCHY: Record<TeamRole, number> = {
  [TeamRole.OWNER]: 4,
  [TeamRole.ADMIN]: 3,
  [TeamRole.MEMBER]: 2,
  [TeamRole.VIEWER]: 1,
};

export function canAssignRole(actorRole: TeamRole, targetRole: TeamRole): boolean {
  // Actors can only assign roles lower than their own
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

export function canManageMembers(role: TeamRole): boolean {
  return role === TeamRole.OWNER || role === TeamRole.ADMIN;
}

// ============================================================================
// Team Service
// ============================================================================

export interface TeamServiceDependencies {
  organizationRepository: OrganizationRepository;
  teamMemberRepository: TeamMemberRepository;
  eventEmitter?: EventEmitter;
}

export class TeamService {
  private readonly orgRepo: OrganizationRepository;
  private readonly teamRepo: TeamMemberRepository;
  private readonly eventEmitter?: EventEmitter;

  constructor(deps: TeamServiceDependencies) {
    this.orgRepo = deps.organizationRepository;
    this.teamRepo = deps.teamMemberRepository;
    this.eventEmitter = deps.eventEmitter;
  }

  // ==========================================================================
  // Invite Team Member
  // ==========================================================================

  async inviteTeamMember(
    actorId: UserId,
    input: InviteTeamMemberInput
  ): Promise<Result<InviteTeamMemberOutput>> {
    try {
      // Get actor's membership
      const actorMembership = await this.teamRepo.findByUserIdAndOrganizationId(
        actorId,
        input.organizationId
      );

      if (!actorMembership) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'You do not have access to this organization',
          false,
          403
        );
      }

      // Check if actor can manage members
      if (!canManageMembers(actorMembership.role)) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Only owners and admins can invite team members',
          false,
          403
        );
      }

      // Get organization
      const organization = await this.orgRepo.findById(input.organizationId);
      if (!organization) {
        throw new SaasException(
          SaasErrorCode.ORGANIZATION_NOT_FOUND,
          'Organization not found',
          false,
          404
        );
      }

      const roleToAssign = input.role ?? TeamRole.MEMBER;

      // Check role assignment permission
      if (!canAssignRole(actorMembership.role, roleToAssign)) {
        throw new SaasException(
          SaasErrorCode.INVALID_ROLE,
          'Cannot invite with a role equal to or higher than your own',
          false,
          403
        );
      }

      // Check seat limits
      const currentMemberCount = await this.teamRepo.countByOrganizationId(input.organizationId);
      const limits = PLAN_LIMITS[organization.plan];

      if (currentMemberCount >= limits.maxTeamMembers) {
        throw new SaasException(
          SaasErrorCode.SEAT_LIMIT_REACHED,
          `Organization has reached seat limit for ${organization.plan} plan (${limits.maxTeamMembers} members)`,
          false,
          403,
          { currentCount: currentMemberCount, limit: limits.maxTeamMembers }
        );
      }

      // Create invitation (in a real system, you'd look up the user by email)
      // For now, we'll create a pending team member
      const teamMember = await this.teamRepo.create({
        organizationId: input.organizationId,
        userId: '', // Will be set when invitation is accepted
        role: roleToAssign,
        invitedBy: actorId,
        invitedAt: new Date(),
        acceptedAt: null,
      });

      // Emit event
      if (this.eventEmitter) {
        await this.eventEmitter.emit({
          type: 'TeamMemberInvited',
          timestamp: new Date(),
          organizationId: input.organizationId,
          teamMemberId: teamMember.id,
          email: input.email,
          role: roleToAssign,
          invitedBy: actorId,
        });
      }

      return success({ teamMember });
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Accept Invitation
  // ==========================================================================

  async acceptInvitation(
    actorId: UserId,
    input: AcceptInvitationInput
  ): Promise<Result<TeamMember>> {
    try {
      const teamMember = await this.teamRepo.findById(input.teamMemberId);

      if (!teamMember) {
        throw new SaasException(
          SaasErrorCode.MEMBER_NOT_FOUND,
          'Invitation not found',
          false,
          404
        );
      }

      if (teamMember.acceptedAt !== null) {
        throw new SaasException(
          SaasErrorCode.VALIDATION_ERROR,
          'Invitation has already been accepted',
          false,
          409
        );
      }

      // Update team member with user ID and acceptance time
      const updatedMember = await this.teamRepo.update(teamMember.id, {
        userId: actorId,
        acceptedAt: new Date(),
      });

      // Emit event
      if (this.eventEmitter) {
        await this.eventEmitter.emit({
          type: 'TeamMemberAccepted',
          timestamp: new Date(),
          organizationId: teamMember.organizationId,
          teamMemberId: teamMember.id,
          userId: actorId,
        });
      }

      return success(updatedMember);
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Remove Team Member
  // ==========================================================================

  async removeTeamMember(
    actorId: UserId,
    organizationId: OrganizationId,
    targetMemberId: TeamMemberId
  ): Promise<Result<void>> {
    try {
      // Get actor's membership
      const actorMembership = await this.teamRepo.findByUserIdAndOrganizationId(
        actorId,
        organizationId
      );

      if (!actorMembership) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'You do not have access to this organization',
          false,
          403
        );
      }

      // Check if actor can manage members
      if (!canManageMembers(actorMembership.role)) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Only owners and admins can remove team members',
          false,
          403
        );
      }

      // Get target member
      const targetMember = await this.teamRepo.findById(targetMemberId);

      if (!targetMember) {
        throw new SaasException(
          SaasErrorCode.MEMBER_NOT_FOUND,
          'Team member not found',
          false,
          404
        );
      }

      if (targetMember.organizationId !== organizationId) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Team member does not belong to this organization',
          false,
          403
        );
      }

      // Cannot remove owner
      if (targetMember.role === TeamRole.OWNER) {
        throw new SaasException(
          SaasErrorCode.CANNOT_REMOVE_OWNER,
          'Cannot remove the organization owner',
          false,
          403
        );
      }

      // Cannot remove member with equal or higher role
      if (ROLE_HIERARCHY[targetMember.role] >= ROLE_HIERARCHY[actorMembership.role]) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Cannot remove a member with equal or higher role',
          false,
          403
        );
      }

      await this.teamRepo.delete(targetMemberId);

      // Emit event
      if (this.eventEmitter) {
        await this.eventEmitter.emit({
          type: 'TeamMemberRemoved',
          timestamp: new Date(),
          organizationId,
          teamMemberId: targetMemberId,
          userId: targetMember.userId,
          removedBy: actorId,
        });
      }

      return success(undefined);
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // List Team Members
  // ==========================================================================

  async listTeamMembers(
    actorId: UserId,
    organizationId: OrganizationId
  ): Promise<Result<TeamMember[]>> {
    try {
      // Check membership
      const membership = await this.teamRepo.findByUserIdAndOrganizationId(actorId, organizationId);
      if (!membership) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'You do not have access to this organization',
          false,
          403
        );
      }

      const members = await this.teamRepo.findByOrganizationId(organizationId);
      return success(members);
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Update Team Member Role
  // ==========================================================================

  async updateMemberRole(
    actorId: UserId,
    organizationId: OrganizationId,
    targetMemberId: TeamMemberId,
    newRole: TeamRole
  ): Promise<Result<TeamMember>> {
    try {
      // Get actor's membership
      const actorMembership = await this.teamRepo.findByUserIdAndOrganizationId(
        actorId,
        organizationId
      );

      if (!actorMembership) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'You do not have access to this organization',
          false,
          403
        );
      }

      // Only owners can change roles
      if (actorMembership.role !== TeamRole.OWNER) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Only owners can change member roles',
          false,
          403
        );
      }

      // Get target member
      const targetMember = await this.teamRepo.findById(targetMemberId);

      if (!targetMember) {
        throw new SaasException(
          SaasErrorCode.MEMBER_NOT_FOUND,
          'Team member not found',
          false,
          404
        );
      }

      if (targetMember.organizationId !== organizationId) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Team member does not belong to this organization',
          false,
          403
        );
      }

      // Cannot change owner role
      if (targetMember.role === TeamRole.OWNER) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Cannot change the role of the organization owner',
          false,
          403
        );
      }

      // Cannot assign owner role
      if (newRole === TeamRole.OWNER) {
        throw new SaasException(
          SaasErrorCode.INVALID_ROLE,
          'Cannot assign owner role. Transfer ownership instead.',
          false,
          400
        );
      }

      const updatedMember = await this.teamRepo.update(targetMemberId, {
        role: newRole,
      });

      return success(updatedMember);
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }
}

// ============================================================================
// In-Memory Repository Implementation (for testing)
// ============================================================================

export class InMemoryTeamMemberRepository implements TeamMemberRepository {
  private members: Map<TeamMemberId, TeamMember> = new Map();

  async findById(id: TeamMemberId): Promise<TeamMember | null> {
    return this.members.get(id) ?? null;
  }

  async findByOrganizationId(orgId: OrganizationId): Promise<TeamMember[]> {
    return Array.from(this.members.values()).filter(m => m.organizationId === orgId);
  }

  async findByUserIdAndOrganizationId(
    userId: UserId,
    orgId: OrganizationId
  ): Promise<TeamMember | null> {
    for (const member of this.members.values()) {
      if (member.userId === userId && member.organizationId === orgId) {
        return member;
      }
    }
    return null;
  }

  async findByUserId(userId: UserId): Promise<TeamMember[]> {
    return Array.from(this.members.values()).filter(m => m.userId === userId);
  }

  async create(member: Omit<TeamMember, 'id'>): Promise<TeamMember> {
    const teamMember: TeamMember = {
      ...member,
      id: randomUUID(),
    };
    this.members.set(teamMember.id, teamMember);
    return teamMember;
  }

  async update(id: TeamMemberId, data: Partial<TeamMember>): Promise<TeamMember> {
    const existing = this.members.get(id);
    if (!existing) {
      throw new Error('Team member not found');
    }
    const updated: TeamMember = { ...existing, ...data };
    this.members.set(id, updated);
    return updated;
  }

  async delete(id: TeamMemberId): Promise<void> {
    this.members.delete(id);
  }

  async countByOrganizationId(orgId: OrganizationId): Promise<number> {
    return (await this.findByOrganizationId(orgId)).length;
  }

  async existsByUserIdAndOrganizationId(userId: UserId, orgId: OrganizationId): Promise<boolean> {
    const member = await this.findByUserIdAndOrganizationId(userId, orgId);
    return member !== null;
  }
}
