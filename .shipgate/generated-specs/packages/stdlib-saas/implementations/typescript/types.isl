# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: success, failure, PLAN_LIMITS, DEFAULT_SAAS_CONFIG, OrganizationId, TeamMemberId, ProjectId, UserId, Email, Organization, TeamMember, Project, PlanLimits, CreateOrganizationInput, InviteTeamMemberInput, CreateProjectInput, UpdateOrganizationInput, UpdateProjectInput, AcceptInvitationInput, CreateOrganizationOutput, InviteTeamMemberOutput, CreateProjectOutput, SaasError, SaasException, Result, OrganizationRepository, TeamMemberRepository, ProjectRepository, SaasEvent, OrganizationCreatedEvent, TeamMemberInvitedEvent, TeamMemberAcceptedEvent, TeamMemberRemovedEvent, ProjectCreatedEvent, ProjectArchivedEvent, SaasEventTypes, EventEmitter, SaasConfig, ActorContext
# dependencies: 

domain Types {
  version: "1.0.0"

  type OrganizationId = String
  type TeamMemberId = String
  type ProjectId = String
  type UserId = String
  type Email = String
  type Organization = String
  type TeamMember = String
  type Project = String
  type PlanLimits = String
  type CreateOrganizationInput = String
  type InviteTeamMemberInput = String
  type CreateProjectInput = String
  type UpdateOrganizationInput = String
  type UpdateProjectInput = String
  type AcceptInvitationInput = String
  type CreateOrganizationOutput = String
  type InviteTeamMemberOutput = String
  type CreateProjectOutput = String
  type SaasError = String
  type SaasException = String
  type Result = String
  type OrganizationRepository = String
  type TeamMemberRepository = String
  type ProjectRepository = String
  type SaasEvent = String
  type OrganizationCreatedEvent = String
  type TeamMemberInvitedEvent = String
  type TeamMemberAcceptedEvent = String
  type TeamMemberRemovedEvent = String
  type ProjectCreatedEvent = String
  type ProjectArchivedEvent = String
  type SaasEventTypes = String
  type EventEmitter = String
  type SaasConfig = String
  type ActorContext = String

  invariants exports_present {
    - true
  }
}
