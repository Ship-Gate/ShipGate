/**
 * Core types for SaaS functionality
 */

export interface UUID {
  readonly value: string;
}

export interface Timestamp {
  readonly value: Date;
}

export interface JSON {
  [key: string]: any;
}

// Organization types
export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED'
}

export enum SubscriptionPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE'
}

export interface Organization {
  id: UUID;
  name: string;
  slug: string;
  plan: SubscriptionPlan;
  status: OrganizationStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
  settings?: JSON;
}

// Team types
export enum TeamRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER'
}

export interface TeamMember {
  id: UUID;
  organization_id: UUID;
  user_id: UUID;
  role: TeamRole;
  invited_by?: UUID;
  invited_at: Timestamp;
  accepted_at?: Timestamp;
}

// Project types
export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED'
}

export interface Project {
  id: UUID;
  organization_id: UUID;
  name: string;
  description?: string;
  status: ProjectStatus;
  created_by: UUID;
  created_at: Timestamp;
  updated_at: Timestamp;
  archived_at?: Timestamp;
}

// Feature flag types
export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rules: FeatureRule[];
}

export interface FeatureRule {
  type: 'plan' | 'tenant' | 'percentage' | 'user';
  value: string | number;
  enabled: boolean;
}

// Plan entitlement types
export interface PlanEntitlements {
  plan: SubscriptionPlan;
  limits: PlanLimits;
  features: string[];
}

export interface PlanLimits {
  maxProjects: number;
  maxTeamMembers: number;
  maxApiCalls?: number;
  maxStorage?: number;
  [key: string]: number | undefined;
}

// Onboarding types
export interface OnboardingStep {
  id: string;
  name: string;
  description: string;
  required: boolean;
  order: number;
  rollback?: boolean;
  handler: OnboardingHandler;
}

export interface OnboardingHandler {
  execute: (context: OnboardingContext) => Promise<OnboardingResult>;
  rollback?: (context: OnboardingContext) => Promise<void>;
}

export interface OnboardingContext {
  tenantId: UUID;
  userId: UUID;
  data: Record<string, any>;
  completedSteps: string[];
}

export interface OnboardingResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

// Error types
export class SaaSError extends Error {
  constructor(
    message: string,
    public code: string,
    public retriable: boolean = false
  ) {
    super(message);
    this.name = 'SaaSError';
  }
}

// Context types
export interface TenantContext {
  tenantId: UUID;
  userId: UUID;
  plan: SubscriptionPlan;
  features: Set<string>;
}
