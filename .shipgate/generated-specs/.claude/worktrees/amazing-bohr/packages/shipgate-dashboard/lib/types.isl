# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Verdict, RunStatus, Severity, EnvStatus, WorkflowRun, Job, PullRequest, StatusCheck, Environment, Finding, TeamMember, TimelineEvent, Webhook, SummaryCard
# dependencies: 

domain Types {
  version: "1.0.0"

  type Verdict = String
  type RunStatus = String
  type Severity = String
  type EnvStatus = String
  type WorkflowRun = String
  type Job = String
  type PullRequest = String
  type StatusCheck = String
  type Environment = String
  type Finding = String
  type TeamMember = String
  type TimelineEvent = String
  type Webhook = String
  type SummaryCard = String

  invariants exports_present {
    - true
  }
}
