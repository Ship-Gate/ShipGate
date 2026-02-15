# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateProjectName, canCreateProject, canUpdateProject, canArchiveProject, ProjectServiceDependencies, ProjectService, InMemoryProjectRepository
# dependencies: crypto

domain Project {
  version: "1.0.0"

  type ProjectServiceDependencies = String
  type ProjectService = String
  type InMemoryProjectRepository = String

  invariants exports_present {
    - true
  }
}
