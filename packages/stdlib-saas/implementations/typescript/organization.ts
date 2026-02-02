// ============================================================================
// Organization Operations
// ============================================================================

import { randomUUID } from 'crypto';
import {
  Organization,
  OrganizationId,
  OrganizationStatus,
  SubscriptionPlan,
  TeamMember,
  TeamRole,
  UserId,
  CreateOrganizationInput,
  CreateOrganizationOutput,
  UpdateOrganizationInput,
  OrganizationRepository,
  TeamMemberRepository,
  EventEmitter,
  SaasConfig,
  DEFAULT_SAAS_CONFIG,
  Result,
  success,
  failure,
  SaasException,
  SaasErrorCode,
  PLAN_LIMITS,
} from './types.js';

// ============================================================================
// Validation
// ============================================================================

export function validateSlug(slug: string, config: SaasConfig = DEFAULT_SAAS_CONFIG): boolean {
  if (slug.length < config.minSlugLength || slug.length > config.maxSlugLength) {
    return false;
  }
  return config.slugPattern.test(slug);
}

export function validateOrganizationName(name: string, config: SaasConfig = DEFAULT_SAAS_CONFIG): boolean {
  return name.length > 0 && name.length <= config.maxOrganizationNameLength;
}

export function normalizeSlug(slug: string): string {
  return slug.toLowerCase().trim();
}

// ============================================================================
// Organization Service
// ============================================================================

export interface OrganizationServiceDependencies {
  organizationRepository: OrganizationRepository;
  teamMemberRepository: TeamMemberRepository;
  eventEmitter?: EventEmitter;
  config?: Partial<SaasConfig>;
}

export class OrganizationService {
  private readonly orgRepo: OrganizationRepository;
  private readonly teamRepo: TeamMemberRepository;
  private readonly eventEmitter?: EventEmitter;
  private readonly config: SaasConfig;

  constructor(deps: OrganizationServiceDependencies) {
    this.orgRepo = deps.organizationRepository;
    this.teamRepo = deps.teamMemberRepository;
    this.eventEmitter = deps.eventEmitter;
    this.config = { ...DEFAULT_SAAS_CONFIG, ...deps.config };
  }

  // ==========================================================================
  // Create Organization
  // ==========================================================================

  async createOrganization(
    actorId: UserId,
    input: CreateOrganizationInput
  ): Promise<Result<CreateOrganizationOutput>> {
    try {
      // Validate name
      if (!validateOrganizationName(input.name, this.config)) {
        throw new SaasException(
          SaasErrorCode.VALIDATION_ERROR,
          'Organization name is invalid',
          true,
          400
        );
      }

      // Validate slug
      const normalizedSlug = normalizeSlug(input.slug);
      if (!validateSlug(normalizedSlug, this.config)) {
        throw new SaasException(
          SaasErrorCode.INVALID_SLUG,
          'Slug format is invalid. Must be 3-50 characters, lowercase letters, numbers, and hyphens only.',
          true,
          400
        );
      }

      // Check slug availability
      if (await this.orgRepo.slugExists(normalizedSlug)) {
        throw new SaasException(
          SaasErrorCode.SLUG_TAKEN,
          'Organization slug already exists',
          false,
          409
        );
      }

      // Check organization limit for user
      const existingOrgCount = await this.orgRepo.countByUserId(actorId);
      if (existingOrgCount >= this.config.maxOrganizationsPerUser) {
        throw new SaasException(
          SaasErrorCode.ORGANIZATION_LIMIT_REACHED,
          `You have reached the maximum number of organizations (${this.config.maxOrganizationsPerUser})`,
          false,
          403
        );
      }

      const plan = input.plan ?? SubscriptionPlan.FREE;

      // Create organization
      const organization = await this.orgRepo.create({
        name: input.name.trim(),
        slug: normalizedSlug,
        plan,
        status: OrganizationStatus.ACTIVE,
        settings: null,
      });

      // Create owner membership
      const teamMember = await this.teamRepo.create({
        organizationId: organization.id,
        userId: actorId,
        role: TeamRole.OWNER,
        invitedBy: null,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      });

      // Emit event
      if (this.eventEmitter) {
        await this.eventEmitter.emit({
          type: 'OrganizationCreated',
          timestamp: new Date(),
          organizationId: organization.id,
          name: organization.name,
          slug: organization.slug,
          plan: organization.plan,
          createdBy: actorId,
        });
      }

      return success({
        organization,
        teamMember,
      });
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Get Organization
  // ==========================================================================

  async getOrganization(
    actorId: UserId,
    organizationId: OrganizationId
  ): Promise<Result<Organization>> {
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

      const organization = await this.orgRepo.findById(organizationId);
      if (!organization) {
        throw new SaasException(
          SaasErrorCode.ORGANIZATION_NOT_FOUND,
          'Organization not found',
          false,
          404
        );
      }

      return success(organization);
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Update Organization
  // ==========================================================================

  async updateOrganization(
    actorId: UserId,
    organizationId: OrganizationId,
    input: UpdateOrganizationInput
  ): Promise<Result<Organization>> {
    try {
      // Check membership and role
      const membership = await this.teamRepo.findByUserIdAndOrganizationId(actorId, organizationId);
      if (!membership) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'You do not have access to this organization',
          false,
          403
        );
      }

      if (membership.role !== TeamRole.OWNER && membership.role !== TeamRole.ADMIN) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Only owners and admins can update organization settings',
          false,
          403
        );
      }

      const organization = await this.orgRepo.findById(organizationId);
      if (!organization) {
        throw new SaasException(
          SaasErrorCode.ORGANIZATION_NOT_FOUND,
          'Organization not found',
          false,
          404
        );
      }

      // Validate name if provided
      if (input.name !== undefined && !validateOrganizationName(input.name, this.config)) {
        throw new SaasException(
          SaasErrorCode.VALIDATION_ERROR,
          'Organization name is invalid',
          true,
          400
        );
      }

      const updatedOrg = await this.orgRepo.update(organizationId, {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.settings !== undefined && { settings: input.settings }),
      });

      return success(updatedOrg);
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // List User Organizations
  // ==========================================================================

  async listUserOrganizations(actorId: UserId): Promise<Result<Organization[]>> {
    try {
      const organizations = await this.orgRepo.findByUserId(actorId);
      return success(organizations);
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Get Organization Limits
  // ==========================================================================

  async getOrganizationLimits(
    actorId: UserId,
    organizationId: OrganizationId
  ): Promise<Result<{ limits: typeof PLAN_LIMITS[SubscriptionPlan]; usage: { projects: number; teamMembers: number } }>> {
    try {
      const orgResult = await this.getOrganization(actorId, organizationId);
      if (!orgResult.success) {
        return orgResult;
      }

      const organization = orgResult.data;
      const limits = PLAN_LIMITS[organization.plan];

      const [projectCount, memberCount] = await Promise.all([
        this.orgRepo.countByUserId(actorId), // This would need a project repo in real implementation
        this.teamRepo.countByOrganizationId(organizationId),
      ]);

      return success({
        limits,
        usage: {
          projects: projectCount,
          teamMembers: memberCount,
        },
      });
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

export class InMemoryOrganizationRepository implements OrganizationRepository {
  private organizations: Map<OrganizationId, Organization> = new Map();
  private teamMembers: Map<string, TeamMember[]> = new Map();

  async findById(id: OrganizationId): Promise<Organization | null> {
    return this.organizations.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    for (const org of this.organizations.values()) {
      if (org.slug === slug) {
        return org;
      }
    }
    return null;
  }

  async findByUserId(userId: UserId): Promise<Organization[]> {
    const userMemberships = this.teamMembers.get(userId) ?? [];
    const orgIds = userMemberships.map(m => m.organizationId);
    return Array.from(this.organizations.values()).filter(org => orgIds.includes(org.id));
  }

  async create(org: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization> {
    const now = new Date();
    const organization: Organization = {
      ...org,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.set(organization.id, organization);
    return organization;
  }

  async update(id: OrganizationId, data: Partial<Organization>): Promise<Organization> {
    const existing = this.organizations.get(id);
    if (!existing) {
      throw new Error('Organization not found');
    }
    const updated: Organization = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.organizations.set(id, updated);
    return updated;
  }

  async delete(id: OrganizationId): Promise<void> {
    this.organizations.delete(id);
  }

  async slugExists(slug: string): Promise<boolean> {
    for (const org of this.organizations.values()) {
      if (org.slug === slug) {
        return true;
      }
    }
    return false;
  }

  async countByUserId(userId: UserId): Promise<number> {
    const orgs = await this.findByUserId(userId);
    return orgs.length;
  }

  // Helper for testing
  setTeamMembers(userId: UserId, members: TeamMember[]): void {
    this.teamMembers.set(userId, members);
  }
}
