/**
 * Custom errors for SaaS operations
 */

import { SaaSError } from './types';

export class TenantNotFoundError extends SaaSError {
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`, 'TENANT_NOT_FOUND', false);
  }
}

export class FeatureFlagError extends SaaSError {
  constructor(message: string) {
    super(message, 'FEATURE_FLAG_ERROR', false);
  }
}

export class PlanLimitExceededError extends SaaSError {
  constructor(limit: string, current: number, max: number) {
    super(
      `Plan limit exceeded for ${limit}: ${current}/${max}`,
      'PLAN_LIMIT_EXCEEDED',
      false
    );
  }
}

export class EntitlementError extends SaaSError {
  constructor(feature: string, plan: string) {
    super(
      `Feature "${feature}" not available in plan "${plan}"`,
      'ENTITLEMENT_ERROR',
      false
    );
  }
}

export class OnboardingError extends SaaSError {
  constructor(step: string, message: string) {
    super(
      `Onboarding step "${step}" failed: ${message}`,
      'ONBOARDING_ERROR',
      true
    );
  }
}

export class ContextPropagationError extends SaaSError {
  constructor(message: string) {
    super(message, 'CONTEXT_PROPAGATION_ERROR', false);
  }
}

export class IsolationViolationError extends SaaSError {
  constructor(operation: string, tenantId: string) {
    super(
      `Data isolation violation: ${operation} accessing tenant ${tenantId}`,
      'ISOLATION_VIOLATION',
      false
    );
  }
}
