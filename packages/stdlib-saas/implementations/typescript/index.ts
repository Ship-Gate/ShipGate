// ============================================================================
// ISL SaaS Standard Library - TypeScript Implementation
// @isl-lang/stdlib-saas
// Version: 1.0.0
//
// Complete foundation for building SaaS applications.
// Includes multi-tenancy, billing, team management, and more.
// ============================================================================

// Re-export all types
export * from './types.js';

// Re-export organization module
export {
  OrganizationService,
  type OrganizationServiceDependencies,
  validateSlug,
  validateOrganizationName,
  normalizeSlug,
  InMemoryOrganizationRepository,
} from './organization.js';

// Re-export team module
export {
  TeamService,
  type TeamServiceDependencies,
  canAssignRole,
  canManageMembers,
  InMemoryTeamMemberRepository,
} from './team.js';

// Re-export project module
export {
  ProjectService,
  type ProjectServiceDependencies,
  validateProjectName,
  canCreateProject,
  canUpdateProject,
  canArchiveProject,
  InMemoryProjectRepository,
} from './project.js';

// ============================================================================
// Unified SaaS Service
// ============================================================================

import {
  OrganizationRepository,
  TeamMemberRepository,
  ProjectRepository,
  EventEmitter,
  SaasConfig,
  DEFAULT_SAAS_CONFIG,
  UserId,
  OrganizationId,
  ProjectId,
  TeamMemberId,
  TeamRole,
  CreateOrganizationInput,
  CreateOrganizationOutput,
  InviteTeamMemberInput,
  InviteTeamMemberOutput,
  CreateProjectInput,
  CreateProjectOutput,
  UpdateOrganizationInput,
  UpdateProjectInput,
  AcceptInvitationInput,
  Organization,
  TeamMember,
  Project,
  Result,
} from './types.js';

import { OrganizationService } from './organization.js';
import { TeamService } from './team.js';
import { ProjectService } from './project.js';

export interface SaasServiceDependencies {
  organizationRepository: OrganizationRepository;
  teamMemberRepository: TeamMemberRepository;
  projectRepository: ProjectRepository;
  eventEmitter?: EventEmitter;
  config?: Partial<SaasConfig>;
}

/**
 * Unified SaaS Service that combines organization, team, and project management.
 * This provides a single entry point for all SaaS operations.
 */
export class SaasService {
  private readonly organizationService: OrganizationService;
  private readonly teamService: TeamService;
  private readonly projectService: ProjectService;
  private readonly config: SaasConfig;

  constructor(deps: SaasServiceDependencies) {
    this.config = { ...DEFAULT_SAAS_CONFIG, ...deps.config };

    this.organizationService = new OrganizationService({
      organizationRepository: deps.organizationRepository,
      teamMemberRepository: deps.teamMemberRepository,
      eventEmitter: deps.eventEmitter,
      config: deps.config,
    });

    this.teamService = new TeamService({
      organizationRepository: deps.organizationRepository,
      teamMemberRepository: deps.teamMemberRepository,
      eventEmitter: deps.eventEmitter,
    });

    this.projectService = new ProjectService({
      organizationRepository: deps.organizationRepository,
      teamMemberRepository: deps.teamMemberRepository,
      projectRepository: deps.projectRepository,
      eventEmitter: deps.eventEmitter,
      config: deps.config,
    });
  }

  // ==========================================================================
  // Organization Operations
  // ==========================================================================

  async createOrganization(
    actorId: UserId,
    input: CreateOrganizationInput
  ): Promise<Result<CreateOrganizationOutput>> {
    return this.organizationService.createOrganization(actorId, input);
  }

  async getOrganization(
    actorId: UserId,
    organizationId: OrganizationId
  ): Promise<Result<Organization>> {
    return this.organizationService.getOrganization(actorId, organizationId);
  }

  async updateOrganization(
    actorId: UserId,
    organizationId: OrganizationId,
    input: UpdateOrganizationInput
  ): Promise<Result<Organization>> {
    return this.organizationService.updateOrganization(actorId, organizationId, input);
  }

  async listUserOrganizations(actorId: UserId): Promise<Result<Organization[]>> {
    return this.organizationService.listUserOrganizations(actorId);
  }

  // ==========================================================================
  // Team Operations
  // ==========================================================================

  async inviteTeamMember(
    actorId: UserId,
    input: InviteTeamMemberInput
  ): Promise<Result<InviteTeamMemberOutput>> {
    return this.teamService.inviteTeamMember(actorId, input);
  }

  async acceptInvitation(
    actorId: UserId,
    input: AcceptInvitationInput
  ): Promise<Result<TeamMember>> {
    return this.teamService.acceptInvitation(actorId, input);
  }

  async removeTeamMember(
    actorId: UserId,
    organizationId: OrganizationId,
    targetMemberId: TeamMemberId
  ): Promise<Result<void>> {
    return this.teamService.removeTeamMember(actorId, organizationId, targetMemberId);
  }

  async listTeamMembers(
    actorId: UserId,
    organizationId: OrganizationId
  ): Promise<Result<TeamMember[]>> {
    return this.teamService.listTeamMembers(actorId, organizationId);
  }

  async updateMemberRole(
    actorId: UserId,
    organizationId: OrganizationId,
    targetMemberId: TeamMemberId,
    newRole: TeamRole
  ): Promise<Result<TeamMember>> {
    return this.teamService.updateMemberRole(actorId, organizationId, targetMemberId, newRole);
  }

  // ==========================================================================
  // Project Operations
  // ==========================================================================

  async createProject(
    actorId: UserId,
    input: CreateProjectInput
  ): Promise<Result<CreateProjectOutput>> {
    return this.projectService.createProject(actorId, input);
  }

  async getProject(
    actorId: UserId,
    organizationId: OrganizationId,
    projectId: ProjectId
  ): Promise<Result<Project>> {
    return this.projectService.getProject(actorId, organizationId, projectId);
  }

  async listProjects(
    actorId: UserId,
    organizationId: OrganizationId
  ): Promise<Result<Project[]>> {
    return this.projectService.listProjects(actorId, organizationId);
  }

  async updateProject(
    actorId: UserId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    input: UpdateProjectInput
  ): Promise<Result<Project>> {
    return this.projectService.updateProject(actorId, organizationId, projectId, input);
  }

  async archiveProject(
    actorId: UserId,
    organizationId: OrganizationId,
    projectId: ProjectId
  ): Promise<Result<Project>> {
    return this.projectService.archiveProject(actorId, organizationId, projectId);
  }

  async restoreProject(
    actorId: UserId,
    organizationId: OrganizationId,
    projectId: ProjectId
  ): Promise<Result<Project>> {
    return this.projectService.restoreProject(actorId, organizationId, projectId);
  }
}

// ============================================================================
// Factory for creating SaasService with in-memory repositories (testing)
// ============================================================================

import { InMemoryOrganizationRepository } from './organization.js';
import { InMemoryTeamMemberRepository } from './team.js';
import { InMemoryProjectRepository } from './project.js';

export function createInMemorySaasService(
  config?: Partial<SaasConfig>
): SaasService {
  return new SaasService({
    organizationRepository: new InMemoryOrganizationRepository(),
    teamMemberRepository: new InMemoryTeamMemberRepository(),
    projectRepository: new InMemoryProjectRepository(),
    config,
  });
}
