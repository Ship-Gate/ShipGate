/**
 * Provenance utilities for the dashboard.
 *
 * Wraps @isl-lang/code-provenance for server-side use and provides
 * caching and data transformation for the dashboard API.
 */

import type { AgentTool } from '@isl-lang/code-provenance';

export interface ProvenanceSummaryResponse {
  repository: string;
  branch: string;
  commit: string;
  generatedAt: string;
  totalLines: number;
  humanAuthored: number;
  aiAuthored: number;
  unknown: number;
  aiPercentage: number;
  byAgent: Array<{
    tool: AgentTool;
    displayName: string;
    lines: number;
    percentage: number;
  }>;
  topContributors: Array<{
    name: string;
    email: string;
    lines: number;
    aiPercentage: number;
  }>;
  fileCount: number;
  topAiFiles: Array<{
    path: string;
    totalLines: number;
    aiLines: number;
    aiPercentage: number;
    topAgent: AgentTool | null;
  }>;
}

export interface ProvenanceFileListItem {
  path: string;
  totalLines: number;
  humanLines: number;
  aiLines: number;
  aiPercentage: number;
  topAgent: string | null;
}

export interface ProvenanceLineItem {
  line: number;
  content: string;
  authorName: string;
  authorEmail: string;
  agent: string | null;
  agentModel: string | null;
  commitHash: string;
  commitDate: string;
  confidence: string;
  detectionMethod: string | null;
}

export interface ProvenanceTrendPoint {
  date: string;
  totalLines: number;
  aiLines: number;
  humanLines: number;
  aiPercentage: number;
}

/**
 * Run a provenance scan and return the dashboard summary.
 * This is the main entry point for the dashboard API.
 */
export async function runProvenanceScan(cwd: string): Promise<ProvenanceSummaryResponse> {
  const {
    buildProjectAttribution,
    generateDashboardSummary,
  } = await import('@isl-lang/code-provenance');

  const attribution = buildProjectAttribution({ cwd, maxFiles: 500 });
  return generateDashboardSummary(attribution) as ProvenanceSummaryResponse;
}

/**
 * Get the file list with attribution stats.
 */
export async function getProvenanceFiles(cwd: string): Promise<ProvenanceFileListItem[]> {
  const {
    buildProjectAttribution,
    getAgentDisplayName,
  } = await import('@isl-lang/code-provenance');

  const attribution = buildProjectAttribution({ cwd, maxFiles: 500 });

  return attribution.files.map((f) => {
    let topAgent: string | null = null;
    let topCount = 0;
    for (const [agent, count] of Object.entries(f.byAgent)) {
      if ((count ?? 0) > topCount) {
        topCount = count ?? 0;
        topAgent = getAgentDisplayName(agent as AgentTool);
      }
    }

    return {
      path: f.path,
      totalLines: f.totalLines,
      humanLines: f.humanLines,
      aiLines: f.aiLines,
      aiPercentage: f.totalLines > 0 ? Math.round((f.aiLines / f.totalLines) * 100) : 0,
      topAgent,
    };
  });
}

/**
 * Get line-level attribution for a single file.
 */
export async function getProvenanceFileDetail(
  cwd: string,
  filePath: string,
): Promise<{ file: ProvenanceFileListItem; lines: ProvenanceLineItem[] }> {
  const {
    buildSingleFileAttribution,
    getAgentDisplayName,
  } = await import('@isl-lang/code-provenance');

  const fileAttr = buildSingleFileAttribution(filePath, cwd);

  let topAgent: string | null = null;
  let topCount = 0;
  for (const [agent, count] of Object.entries(fileAttr.byAgent)) {
    if ((count ?? 0) > topCount) {
      topCount = count ?? 0;
      topAgent = getAgentDisplayName(agent as AgentTool);
    }
  }

  return {
    file: {
      path: fileAttr.path,
      totalLines: fileAttr.totalLines,
      humanLines: fileAttr.humanLines,
      aiLines: fileAttr.aiLines,
      aiPercentage: fileAttr.totalLines > 0 ? Math.round((fileAttr.aiLines / fileAttr.totalLines) * 100) : 0,
      topAgent,
    },
    lines: fileAttr.lines.map((l) => ({
      line: l.line,
      content: l.content,
      authorName: l.author.name,
      authorEmail: l.author.email,
      agent: l.agent?.tool ?? null,
      agentModel: l.agent?.model ?? null,
      commitHash: l.commit.hash,
      commitDate: l.commit.timestamp,
      confidence: l.confidence,
      detectionMethod: l.agent?.detectionMethod ?? null,
    })),
  };
}

/**
 * Export provenance data as CSV.
 */
export async function exportProvenanceCSV(cwd: string): Promise<string> {
  const { buildProjectAttribution, toCSV } = await import('@isl-lang/code-provenance');
  const attribution = buildProjectAttribution({ cwd, maxFiles: 500 });
  return toCSV(attribution);
}

/**
 * Export provenance data as JSON.
 */
export async function exportProvenanceJSON(cwd: string): Promise<string> {
  const { buildProjectAttribution, toJSON } = await import('@isl-lang/code-provenance');
  const attribution = buildProjectAttribution({ cwd, maxFiles: 500 });
  return toJSON(attribution);
}
