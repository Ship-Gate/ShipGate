/**
 * Upload pipeline — sends scan results to the ShipGate Dashboard API.
 *
 * Flow: ensureProject -> createRun -> uploadFindings (chunked) -> completeRun
 */

import { api } from './api-client.js';
import { loadCliConfig } from './config-store.js';

const FINDINGS_CHUNK_SIZE = 500;

interface UploadOptions {
  orgId: string;
  projectName: string;
  repoUrl?: string;
  agentType: 'cli' | 'vscode';
  agentVersion?: string;
  commitSha?: string;
  branch?: string;
}

interface FindingInput {
  severity: string;
  category: string;
  title: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  message: string;
  fingerprint: string;
  confidence?: number;
  meta?: Record<string, unknown>;
}

interface RunResult {
  runId: string;
  findingsUploaded: number;
}

/**
 * Ensure a project exists, creating it if needed.
 * Returns the project ID.
 */
async function ensureProject(
  orgId: string,
  name: string,
  repoUrl?: string
): Promise<string> {
  const res = await api.post<{ id: string }>('/api/v1/projects', {
    orgId,
    name,
    repoUrl,
  });
  return res.data!.id;
}

/**
 * Upload a complete scan result to the dashboard.
 */
export async function uploadScanResult(
  options: UploadOptions,
  findings: FindingInput[],
  verdict: 'SHIP' | 'WARN' | 'NO_SHIP',
  score: number,
  durationMs: number
): Promise<RunResult> {
  const projectId = await ensureProject(
    options.orgId,
    options.projectName,
    options.repoUrl
  );

  // Create run
  const runRes = await api.post<{ id: string }>('/api/v1/runs', {
    orgId: options.orgId,
    projectId,
    agentType: options.agentType,
    agentVersion: options.agentVersion,
    commitSha: options.commitSha,
    branch: options.branch,
  });
  const runId = runRes.data!.id;

  // Upload findings in chunks
  let uploaded = 0;
  for (let i = 0; i < findings.length; i += FINDINGS_CHUNK_SIZE) {
    const chunk = findings.slice(i, i + FINDINGS_CHUNK_SIZE);
    await api.post(`/api/v1/runs/${runId}/findings`, { findings: chunk });
    uploaded += chunk.length;
  }

  // Complete run
  await api.post(`/api/v1/runs/${runId}/complete`, {
    status: 'completed',
    verdict,
    score,
    durationMs,
  });

  return { runId, findingsUploaded: uploaded };
}

/**
 * Resolve the default orgId for uploads.
 * Uses config value or fetches user's first org from the API.
 */
export async function resolveOrgId(): Promise<string> {
  const config = loadCliConfig();
  if (config.defaultOrgId) return config.defaultOrgId;

  const res = await api.get<{
    orgs: Array<{ id: string; name: string }>;
  }>('/api/v1/me');

  const orgs = res.data?.orgs;
  if (!orgs || orgs.length === 0) {
    throw new Error('No organizations found. Create one in the dashboard first.');
  }
  return orgs[0]!.id;
}
