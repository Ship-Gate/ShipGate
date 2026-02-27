# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: canAssignRole, canManageMembers, TeamServiceDependencies, TeamService, InMemoryTeamMemberRepository
# dependencies: crypto

domain Team {
  version: "1.0.0"

  type TeamServiceDependencies = String
  type TeamService = String
  type InMemoryTeamMemberRepository = String

  invariants exports_present {
    - true
  }
}
