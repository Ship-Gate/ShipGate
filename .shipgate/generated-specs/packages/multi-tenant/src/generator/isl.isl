# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateTenantAwareISL, transformEntity, transformBehavior, generateFullTenantAwareISL, generateLimitCheck, generateTenantIsolationAnnotation, generateTenantContextAccess, MultiTenantConfig, TenantAwareTransform, EntityTransform, BehaviorTransform
# dependencies: 

domain Isl {
  version: "1.0.0"

  type MultiTenantConfig = String
  type TenantAwareTransform = String
  type EntityTransform = String
  type BehaviorTransform = String

  invariants exports_present {
    - true
  }
}
