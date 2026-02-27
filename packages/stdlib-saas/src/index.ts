/**
 * @packageDocumentation
 * @isl-lang/stdlib-saas
 */

// Core types and errors
export * from './types';
export * from './errors';

// Tenancy
export * from './tenancy/types';
export * from './tenancy/tenant';
export * from './tenancy/context';
export * from './tenancy/isolation';
export * from './tenancy/store';

// Features
export * from './features/types';
export * from './features/flags';
export * from './features/rules';
export * from './features/store';

// Plans
export * from './plans/types';
export * from './plans/manager';
export * from './plans/entitlements';
export * from './plans/store';

// Onboarding
export * from './onboarding/types';
export * from './onboarding/provisioner';
export * from './onboarding/steps';
export * from './onboarding/store';

// Re-export commonly used classes
import { TenantService } from './tenancy/tenant';
import { FeatureFlagService } from './features/flags';
import { PlanManager } from './plans/manager';
import { OnboardingProvisioner } from './onboarding/provisioner';
import { PlanEntitlements } from './plans/entitlements';
import { TenantContextManager } from './tenancy/context';
import { DataIsolation } from './tenancy/isolation';

export {
  TenantService,
  FeatureFlagService,
  PlanManager,
  OnboardingProvisioner,
  PlanEntitlements,
  TenantContextManager,
  DataIsolation
};
