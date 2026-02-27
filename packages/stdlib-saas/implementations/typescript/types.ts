// ============================================================================
// SaaS Standard Library Types
// Generated from ISL specifications
// ============================================================================

// ============================================================================
// Enums
// ============================================================================

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export enum SubscriptionPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export enum TeamRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

// ============================================================================
// Core Types
// ============================================================================

export type OrganizationId = string;
export type TeamMemberId = string;
export type ProjectId = string;
export type UserId = string;
export type Email = string;

// ============================================================================
// Entity Interfaces
// ============================================================================

export interface Organization {
  id: OrganizationId;
  name: string;
  slug: string;
  plan: SubscriptionPlan;
  status: OrganizationStatus;
  settings: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: TeamMemberId;
  organizationId: OrganizationId;
  userId: UserId;
  role: TeamRole;
  invitedBy: UserId | null;
  invitedAt: Date;
  acceptedAt: Date | null;
}

export interface Project {
  id: ProjectId;
  organizationId: OrganizationId;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

// ============================================================================
// Plan Limits
// ============================================================================

export interface PlanLimits {
  maxProjects: number;
  maxTeamMembers: number;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  [SubscriptionPlan.FREE]: { maxProjects: 3, maxTeamMembers: 2 },
  [SubscriptionPlan.STARTER]: { maxProjects: 10, maxTeamMembers: 5 },
  [SubscriptionPlan.PROFESSIONAL]: { maxProjects: 50, maxTeamMembers: 20 },
  [SubscriptionPlan.ENTERPRISE]: { maxProjects: Infinity, maxTeamMembers: Infinity },
};

// ============================================================================
// Input Types
// ============================================================================

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  plan?: SubscriptionPlan;
}

export interface InviteTeamMemberInput {
  organizationId: OrganizationId;
  email: Email;
  role?: TeamRole;
}

export interface CreateProjectInput {
  organizationId: OrganizationId;
  name: string;
  description?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
}

export interface AcceptInvitationInput {
  teamMemberId: TeamMemberId;
}

// ============================================================================
// Output Types
// ============================================================================

export interface CreateOrganizationOutput {
  organization: Organization;
  teamMember: TeamMember;
}

export interface InviteTeamMemberOutput {
  teamMember: TeamMember;
}

export interface CreateProjectOutput {
  project: Project;
}

// ============================================================================
// Error Types
// ============================================================================

export enum SaasErrorCode {
  // Organization errors
  SLUG_TAKEN = 'SLUG_TAKEN',
  INVALID_SLUG = 'INVALID_SLUG',
  ORGANIZATION_NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
  ORGANIZATION_LIMIT_REACHED = 'ORGANIZATION_LIMIT_REACHED',
  ORGANIZATION_SUSPENDED = 'ORGANIZATION_SUSPENDED',
  
  // Team errors
  ALREADY_MEMBER = 'ALREADY_MEMBER',
  INVALID_ROLE = 'INVALID_ROLE',
  SEAT_LIMIT_REACHED = 'SEAT_LIMIT_REACHED',
  MEMBER_NOT_FOUND = 'MEMBER_NOT_FOUND',
  CANNOT_REMOVE_OWNER = 'CANNOT_REMOVE_OWNER',
  INVITATION_EXPIRED = 'INVITATION_EXPIRED',
  
  // Project errors
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  PROJECT_LIMIT_REACHED = 'PROJECT_LIMIT_REACHED',
  INVALID_PROJECT_NAME = 'INVALID_PROJECT_NAME',
  PROJECT_ALREADY_ARCHIVED = 'PROJECT_ALREADY_ARCHIVED',
  
  // Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // General errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface SaasError {
  code: SaasErrorCode;
  message: string;
  retriable: boolean;
  httpStatus: number;
  details?: Record<string, unknown>;
}

export class SaasException extends Error {
  constructor(
    public readonly code: SaasErrorCode,
    message: string,
    public readonly retriable: boolean = false,
    public readonly httpStatus: number = 400,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SaasException';
  }

  toError(): SaasError {
    return {
      code: this.code,
      message: this.message,
      retriable: this.retriable,
      httpStatus: this.httpStatus,
      details: this.details,
    };
  }
}

// ============================================================================
// Result Type
// ============================================================================

export type Result<T, E = SaasError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure<E = SaasError>(error: E): Result<never, E> {
  return { success: false, error };
}

// ============================================================================
// Repository Interfaces
// ============================================================================

export interface OrganizationRepository {
  findById(id: OrganizationId): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  findByUserId(userId: UserId): Promise<Organization[]>;
  create(org: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization>;
  update(id: OrganizationId, data: Partial<Organization>): Promise<Organization>;
  delete(id: OrganizationId): Promise<void>;
  slugExists(slug: string): Promise<boolean>;
  countByUserId(userId: UserId): Promise<number>;
}

export interface TeamMemberRepository {
  findById(id: TeamMemberId): Promise<TeamMember | null>;
  findByOrganizationId(orgId: OrganizationId): Promise<TeamMember[]>;
  findByUserIdAndOrganizationId(userId: UserId, orgId: OrganizationId): Promise<TeamMember | null>;
  findByUserId(userId: UserId): Promise<TeamMember[]>;
  create(member: Omit<TeamMember, 'id'>): Promise<TeamMember>;
  update(id: TeamMemberId, data: Partial<TeamMember>): Promise<TeamMember>;
  delete(id: TeamMemberId): Promise<void>;
  countByOrganizationId(orgId: OrganizationId): Promise<number>;
  existsByUserIdAndOrganizationId(userId: UserId, orgId: OrganizationId): Promise<boolean>;
}

export interface ProjectRepository {
  findById(id: ProjectId): Promise<Project | null>;
  findByOrganizationId(orgId: OrganizationId): Promise<Project[]>;
  create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project>;
  update(id: ProjectId, data: Partial<Project>): Promise<Project>;
  delete(id: ProjectId): Promise<void>;
  countByOrganizationId(orgId: OrganizationId): Promise<number>;
}

// ============================================================================
// Event Types
// ============================================================================

export interface SaasEvent {
  type: string;
  timestamp: Date;
  organizationId?: OrganizationId;
  userId?: UserId;
  metadata?: Record<string, unknown>;
}

export interface OrganizationCreatedEvent extends SaasEvent {
  type: 'OrganizationCreated';
  organizationId: OrganizationId;
  name: string;
  slug: string;
  plan: SubscriptionPlan;
  createdBy: UserId;
}

export interface TeamMemberInvitedEvent extends SaasEvent {
  type: 'TeamMemberInvited';
  organizationId: OrganizationId;
  teamMemberId: TeamMemberId;
  email: Email;
  role: TeamRole;
  invitedBy: UserId;
}

export interface TeamMemberAcceptedEvent extends SaasEvent {
  type: 'TeamMemberAccepted';
  organizationId: OrganizationId;
  teamMemberId: TeamMemberId;
  userId: UserId;
}

export interface TeamMemberRemovedEvent extends SaasEvent {
  type: 'TeamMemberRemoved';
  organizationId: OrganizationId;
  teamMemberId: TeamMemberId;
  userId: UserId;
  removedBy: UserId;
}

export interface ProjectCreatedEvent extends SaasEvent {
  type: 'ProjectCreated';
  organizationId: OrganizationId;
  projectId: ProjectId;
  name: string;
  createdBy: UserId;
}

export interface ProjectArchivedEvent extends SaasEvent {
  type: 'ProjectArchived';
  organizationId: OrganizationId;
  projectId: ProjectId;
  archivedBy: UserId;
}

export type SaasEventTypes =
  | OrganizationCreatedEvent
  | TeamMemberInvitedEvent
  | TeamMemberAcceptedEvent
  | TeamMemberRemovedEvent
  | ProjectCreatedEvent
  | ProjectArchivedEvent;

export interface EventEmitter {
  emit(event: SaasEventTypes): Promise<void>;
}

// ============================================================================
// Configuration
// ============================================================================

export interface SaasConfig {
  maxOrganizationsPerUser: number;
  slugPattern: RegExp;
  minSlugLength: number;
  maxSlugLength: number;
  maxProjectNameLength: number;
  maxOrganizationNameLength: number;
}

export const DEFAULT_SAAS_CONFIG: SaasConfig = {
  maxOrganizationsPerUser: 5,
  slugPattern: /^[a-z0-9-]+$/,
  minSlugLength: 3,
  maxSlugLength: 50,
  maxProjectNameLength: 100,
  maxOrganizationNameLength: 100,
};

// ============================================================================
// Actor Context
// ============================================================================

export interface ActorContext {
  userId: UserId;
  organizationId?: OrganizationId;
  role?: TeamRole;
}
