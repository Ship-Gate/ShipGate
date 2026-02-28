# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: addISLBreadcrumb, addBehaviorBreadcrumb, addCheckBreadcrumb, addPreconditionBreadcrumb, addPostconditionBreadcrumb, addInvariantBreadcrumb, addTemporalBreadcrumb, addVerificationBreadcrumb, addDomainBreadcrumb, createVerificationTrail, addBreadcrumbs, clearISLBreadcrumbs, ISL_BREADCRUMB_CATEGORIES, ISLBreadcrumbCategory
# dependencies: @sentry/node

domain Isl {
  version: "1.0.0"

  type ISLBreadcrumbCategory = String

  invariants exports_present {
    - true
  }
}
