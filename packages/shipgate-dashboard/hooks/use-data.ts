'use client';

import { useApi } from './use-api';

// ── Types ──────────────────────────────────────────────────────────────

export interface ProjectSummary {
  id: string;
  orgId: string;
  name: string;
  repoUrl: string | null;
  defaultBranch: string | null;
  runCount: number;
  createdAt: string;
}

export interface RunSummary {
  id: string;
  orgId: string;
  projectId: string;
  projectName: string;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  agentType: string;
  agentVersion: string | null;
  commitSha: string | null;
  branch: string | null;
  status: string;
  verdict: string | null;
  score: number | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  findingCount: number;
}

export interface RunDetail extends RunSummary {
  projectRepoUrl: string | null;
  metaJson: unknown;
  findings: FindingItem[];
  proofs: ProofItem[];
  artifacts: ArtifactItem[];
}

export interface FindingItem {
  id: string;
  runId: string;
  severity: string;
  category: string;
  title: string;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  message: string;
  fingerprint: string;
  confidence: number | null;
}

export interface ProofItem {
  id: string;
  runId: string;
  kind: string;
  status: string;
  artifactUrl: string | null;
  summaryJson: unknown;
  createdAt: string;
}

export interface ArtifactItem {
  id: string;
  runId: string;
  kind: string;
  path: string;
  sha256: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface OverviewMetrics {
  totalRuns: number;
  totalFindings: number;
  projectCount: number;
  shipRate: number;
  verdictBreakdown: Record<string, number>;
  severityBreakdown: Record<string, number>;
  trend: Array<{
    date: string;
    verdict: string | null;
    score: number | null;
    status: string;
  }>;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  provider: string;
  createdAt: string;
  orgs: Array<{ id: string; name: string; role: string }>;
}

// ── Hooks ──────────────────────────────────────────────────────────────

export function useProjects() {
  return useApi<ProjectSummary[]>('/api/v1/projects');
}

export function useRuns(projectId?: string, limit = 20) {
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', projectId);
  params.set('limit', String(limit));
  return useApi<RunSummary[]>(`/api/v1/runs?${params.toString()}`);
}

export function useRun(id: string | null) {
  return useApi<RunDetail>(id ? `/api/v1/runs/${id}` : null);
}

export function useOverview(projectId?: string) {
  const params = projectId ? `?projectId=${projectId}` : '';
  return useApi<OverviewMetrics>(`/api/v1/metrics/overview${params}`);
}

export function useFindingsBreakdown(projectId?: string, groupBy = 'severity') {
  const params = new URLSearchParams({ groupBy });
  if (projectId) params.set('projectId', projectId);
  return useApi<Array<{ key: string; count: number }>>(
    `/api/v1/metrics/findings?${params.toString()}`
  );
}

export function useProfile() {
  return useApi<UserProfile>('/api/v1/me');
}
