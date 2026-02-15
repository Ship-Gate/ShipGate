# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateSlug, validateOrganizationName, normalizeSlug, OrganizationServiceDependencies, OrganizationService, InMemoryOrganizationRepository
# dependencies: crypto

domain Organization {
  version: "1.0.0"

  type OrganizationServiceDependencies = String
  type OrganizationService = String
  type InMemoryOrganizationRepository = String

  invariants exports_present {
    - true
  }
}
