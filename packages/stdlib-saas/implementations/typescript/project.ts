// ============================================================================
// Project Operations
// ============================================================================

import { randomUUID } from 'crypto';
import {
  Project,
  ProjectId,
  ProjectStatus,
  OrganizationId,
  UserId,
  TeamRole,
  CreateProjectInput,
  CreateProjectOutput,
  UpdateProjectInput,
  OrganizationRepository,
  TeamMemberRepository,
  ProjectRepository,
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

export function validateProjectName(name: string, config: SaasConfig = DEFAULT_SAAS_CONFIG): boolean {
  return name.length > 0 && name.length <= config.maxProjectNameLength;
}

// ============================================================================
// Permission Checks
// ============================================================================

export function canCreateProject(role: TeamRole): boolean {
  return role !== TeamRole.VIEWER;
}

export function canUpdateProject(role: TeamRole): boolean {
  return role !== TeamRole.VIEWER;
}

export function canArchiveProject(role: TeamRole): boolean {
  return role === TeamRole.OWNER || role === TeamRole.ADMIN;
}

// ============================================================================
// Project Service
// ============================================================================

export interface ProjectServiceDependencies {
  organizationRepository: OrganizationRepository;
  teamMemberRepository: TeamMemberRepository;
  projectRepository: ProjectRepository;
  eventEmitter?: EventEmitter;
  config?: Partial<SaasConfig>;
}

export class ProjectService {
  private readonly orgRepo: OrganizationRepository;
  private readonly teamRepo: TeamMemberRepository;
  private readonly projectRepo: ProjectRepository;
  private readonly eventEmitter?: EventEmitter;
  private readonly config: SaasConfig;

  constructor(deps: ProjectServiceDependencies) {
    this.orgRepo = deps.organizationRepository;
    this.teamRepo = deps.teamMemberRepository;
    this.projectRepo = deps.projectRepository;
    this.eventEmitter = deps.eventEmitter;
    this.config = { ...DEFAULT_SAAS_CONFIG, ...deps.config };
  }

  // ==========================================================================
  // Create Project
  // ==========================================================================

  async createProject(
    actorId: UserId,
    input: CreateProjectInput
  ): Promise<Result<CreateProjectOutput>> {
    try {
      // Get actor's membership
      const membership = await this.teamRepo.findByUserIdAndOrganizationId(
        actorId,
        input.organizationId
      );

      if (!membership) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'You do not have access to this organization',
          false,
          403
        );
      }

      // Check permission
      if (!canCreateProject(membership.role)) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Viewers cannot create projects',
          false,
          403
        );
      }

      // Validate name
      if (!validateProjectName(input.name, this.config)) {
        throw new SaasException(
          SaasErrorCode.INVALID_PROJECT_NAME,
          `Project name must be between 1 and ${this.config.maxProjectNameLength} characters`,
          true,
          400
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

      // Check project limits
      const currentProjectCount = await this.projectRepo.countByOrganizationId(input.organizationId);
      const limits = PLAN_LIMITS[organization.plan];

      if (currentProjectCount >= limits.maxProjects) {
        throw new SaasException(
          SaasErrorCode.PROJECT_LIMIT_REACHED,
          `Organization has reached project limit for ${organization.plan} plan (${limits.maxProjects} projects)`,
          false,
          403,
          { currentCount: currentProjectCount, limit: limits.maxProjects }
        );
      }

      // Create project
      const project = await this.projectRepo.create({
        organizationId: input.organizationId,
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        status: ProjectStatus.ACTIVE,
        createdBy: actorId,
        archivedAt: null,
      });

      // Emit event
      if (this.eventEmitter) {
        await this.eventEmitter.emit({
          type: 'ProjectCreated',
          timestamp: new Date(),
          organizationId: input.organizationId,
          projectId: project.id,
          name: project.name,
          createdBy: actorId,
        });
      }

      return success({ project });
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Get Project
  // ==========================================================================

  async getProject(
    actorId: UserId,
    organizationId: OrganizationId,
    projectId: ProjectId
  ): Promise<Result<Project>> {
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

      const project = await this.projectRepo.findById(projectId);
      if (!project) {
        throw new SaasException(
          SaasErrorCode.PROJECT_NOT_FOUND,
          'Project not found',
          false,
          404
        );
      }

      // Ensure project belongs to the organization
      if (project.organizationId !== organizationId) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Project does not belong to this organization',
          false,
          403
        );
      }

      return success(project);
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // List Projects
  // ==========================================================================

  async listProjects(
    actorId: UserId,
    organizationId: OrganizationId
  ): Promise<Result<Project[]>> {
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

      const projects = await this.projectRepo.findByOrganizationId(organizationId);
      return success(projects);
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Update Project
  // ==========================================================================

  async updateProject(
    actorId: UserId,
    organizationId: OrganizationId,
    projectId: ProjectId,
    input: UpdateProjectInput
  ): Promise<Result<Project>> {
    try {
      // Get actor's membership
      const membership = await this.teamRepo.findByUserIdAndOrganizationId(actorId, organizationId);
      if (!membership) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'You do not have access to this organization',
          false,
          403
        );
      }

      // Check permission
      if (!canUpdateProject(membership.role)) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Viewers cannot update projects',
          false,
          403
        );
      }

      // Get project
      const project = await this.projectRepo.findById(projectId);
      if (!project) {
        throw new SaasException(
          SaasErrorCode.PROJECT_NOT_FOUND,
          'Project not found',
          false,
          404
        );
      }

      if (project.organizationId !== organizationId) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Project does not belong to this organization',
          false,
          403
        );
      }

      // Validate name if provided
      if (input.name !== undefined && !validateProjectName(input.name, this.config)) {
        throw new SaasException(
          SaasErrorCode.INVALID_PROJECT_NAME,
          `Project name must be between 1 and ${this.config.maxProjectNameLength} characters`,
          true,
          400
        );
      }

      const updatedProject = await this.projectRepo.update(projectId, {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.description !== undefined && { description: input.description?.trim() ?? null }),
      });

      return success(updatedProject);
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Archive Project
  // ==========================================================================

  async archiveProject(
    actorId: UserId,
    organizationId: OrganizationId,
    projectId: ProjectId
  ): Promise<Result<Project>> {
    try {
      // Get actor's membership
      const membership = await this.teamRepo.findByUserIdAndOrganizationId(actorId, organizationId);
      if (!membership) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'You do not have access to this organization',
          false,
          403
        );
      }

      // Check permission
      if (!canArchiveProject(membership.role)) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Only owners and admins can archive projects',
          false,
          403
        );
      }

      // Get project
      const project = await this.projectRepo.findById(projectId);
      if (!project) {
        throw new SaasException(
          SaasErrorCode.PROJECT_NOT_FOUND,
          'Project not found',
          false,
          404
        );
      }

      if (project.organizationId !== organizationId) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Project does not belong to this organization',
          false,
          403
        );
      }

      if (project.status === ProjectStatus.ARCHIVED) {
        throw new SaasException(
          SaasErrorCode.PROJECT_ALREADY_ARCHIVED,
          'Project is already archived',
          false,
          409
        );
      }

      const updatedProject = await this.projectRepo.update(projectId, {
        status: ProjectStatus.ARCHIVED,
        archivedAt: new Date(),
      });

      // Emit event
      if (this.eventEmitter) {
        await this.eventEmitter.emit({
          type: 'ProjectArchived',
          timestamp: new Date(),
          organizationId,
          projectId,
          archivedBy: actorId,
        });
      }

      return success(updatedProject);
    } catch (error: unknown) {
      if (error instanceof SaasException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Restore Project
  // ==========================================================================

  async restoreProject(
    actorId: UserId,
    organizationId: OrganizationId,
    projectId: ProjectId
  ): Promise<Result<Project>> {
    try {
      // Get actor's membership
      const membership = await this.teamRepo.findByUserIdAndOrganizationId(actorId, organizationId);
      if (!membership) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'You do not have access to this organization',
          false,
          403
        );
      }

      // Check permission
      if (!canArchiveProject(membership.role)) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Only owners and admins can restore projects',
          false,
          403
        );
      }

      // Get project
      const project = await this.projectRepo.findById(projectId);
      if (!project) {
        throw new SaasException(
          SaasErrorCode.PROJECT_NOT_FOUND,
          'Project not found',
          false,
          404
        );
      }

      if (project.organizationId !== organizationId) {
        throw new SaasException(
          SaasErrorCode.FORBIDDEN,
          'Project does not belong to this organization',
          false,
          403
        );
      }

      if (project.status === ProjectStatus.ACTIVE) {
        throw new SaasException(
          SaasErrorCode.VALIDATION_ERROR,
          'Project is not archived',
          false,
          409
        );
      }

      // Check project limits before restoring
      const organization = await this.orgRepo.findById(organizationId);
      if (organization) {
        const activeProjectCount = (await this.projectRepo.findByOrganizationId(organizationId))
          .filter((p: Project) => p.status === ProjectStatus.ACTIVE).length;
        const limits = PLAN_LIMITS[organization.plan];

        if (activeProjectCount >= limits.maxProjects) {
          throw new SaasException(
            SaasErrorCode.PROJECT_LIMIT_REACHED,
            `Cannot restore project: organization has reached project limit for ${organization.plan} plan`,
            false,
            403
          );
        }
      }

      const updatedProject = await this.projectRepo.update(projectId, {
        status: ProjectStatus.ACTIVE,
        archivedAt: null,
      });

      return success(updatedProject);
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

export class InMemoryProjectRepository implements ProjectRepository {
  private projects: Map<ProjectId, Project> = new Map();

  async findById(id: ProjectId): Promise<Project | null> {
    return this.projects.get(id) ?? null;
  }

  async findByOrganizationId(orgId: OrganizationId): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(p => p.organizationId === orgId);
  }

  async create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = new Date();
    const newProject: Project = {
      ...project,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(newProject.id, newProject);
    return newProject;
  }

  async update(id: ProjectId, data: Partial<Project>): Promise<Project> {
    const existing = this.projects.get(id);
    if (!existing) {
      throw new Error('Project not found');
    }
    const updated: Project = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.projects.set(id, updated);
    return updated;
  }

  async delete(id: ProjectId): Promise<void> {
    this.projects.delete(id);
  }

  async countByOrganizationId(orgId: OrganizationId): Promise<number> {
    return (await this.findByOrganizationId(orgId)).length;
  }
}
