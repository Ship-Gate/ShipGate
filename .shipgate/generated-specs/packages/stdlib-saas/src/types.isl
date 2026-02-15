# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: UUID, Timestamp, JSON, Organization, TeamMember, Project, FeatureFlag, FeatureRule, PlanEntitlements, PlanLimits, OnboardingStep, OnboardingHandler, OnboardingContext, OnboardingResult, SaaSError, TenantContext
# dependencies: 

domain Types {
  version: "1.0.0"

  type UUID = String
  type Timestamp = String
  type JSON = String
  type Organization = String
  type TeamMember = String
  type Project = String
  type FeatureFlag = String
  type FeatureRule = String
  type PlanEntitlements = String
  type PlanLimits = String
  type OnboardingStep = String
  type OnboardingHandler = String
  type OnboardingContext = String
  type OnboardingResult = String
  type SaaSError = String
  type TenantContext = String

  invariants exports_present {
    - true
  }
}
