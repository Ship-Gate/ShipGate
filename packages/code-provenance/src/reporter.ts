/**
 * Provenance Reporter
 *
 * Generates human-readable and machine-readable reports from
 * attribution data — summary stats, file blame views, CSV/JSON export.
 *
 * @module @isl-lang/code-provenance
 */

import type {
  ProjectAttribution,
  FileAttribution,
  LineAttribution,
  AgentTool,
} from './types.js';
import { getAgentDisplayName } from './classifier.js';

// ============================================================================
// Summary report (text)
// ============================================================================

export function formatSummaryReport(attr: ProjectAttribution): string {
  const { summary } = attr;
  const lines: string[] = [];

  lines.push('');
  lines.push('  Code Provenance Report');
  lines.push(`  Repository: ${attr.repository}`);
  lines.push(`  Branch: ${attr.branch} (${attr.commit})`);
  lines.push(`  Generated: ${attr.generatedAt}`);
  lines.push('');
  lines.push('  Attribution Summary');
  lines.push(`  Total lines:     ${fmt(summary.totalLines)}`);
  lines.push(`  Human-authored:  ${fmt(summary.humanAuthored)} (${pct(summary.humanAuthored, summary.totalLines)})`);
  lines.push(`  AI-assisted:     ${fmt(summary.aiAuthored)} (${pct(summary.aiAuthored, summary.totalLines)})`);
  if (summary.unknown > 0) {
    lines.push(`  Unknown:         ${fmt(summary.unknown)} (${pct(summary.unknown, summary.totalLines)})`);
  }

  const agentEntries = Object.entries(summary.byAgent)
    .filter(([, count]) => (count ?? 0) > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));

  if (agentEntries.length > 0) {
    lines.push('');
    lines.push('  By AI Agent');
    for (const [agent, count] of agentEntries) {
      const displayName = getAgentDisplayName(agent as AgentTool).padEnd(20);
      lines.push(`  ${displayName} ${fmt(count ?? 0).padStart(8)} (${pct(count ?? 0, summary.totalLines)})`);
    }
  }

  if (summary.topContributors.length > 0) {
    lines.push('');
    lines.push('  By Operator');
    for (const contrib of summary.topContributors.slice(0, 10)) {
      const nameCol = contrib.email.padEnd(30);
      const linesCol = fmt(contrib.lines).padStart(8);
      const aiCol = `${contrib.aiPercentage}% AI-assisted`;
      lines.push(`  ${nameCol} ${linesCol} (${pct(contrib.lines, summary.totalLines)})  -- ${aiCol}`);
    }
  }

  const topAiFiles = attr.files
    .filter((f) => f.totalLines > 0)
    .map((f) => ({ path: f.path, aiPct: Math.round((f.aiLines / f.totalLines) * 100), topAgent: getTopAgent(f) }))
    .sort((a, b) => b.aiPct - a.aiPct)
    .slice(0, 10);

  if (topAiFiles.length > 0) {
    lines.push('');
    lines.push('  Top AI-heavy files');
    for (const f of topAiFiles) {
      const pathCol = f.path.padEnd(45);
      const pctCol = `${f.aiPct}% AI`.padStart(7);
      const agentCol = f.topAgent ? `(${getAgentDisplayName(f.topAgent)})` : '';
      lines.push(`  ${pathCol} ${pctCol}  ${agentCol}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ============================================================================
// File blame report (text)
// ============================================================================

export function formatFileBlameReport(fileAttr: FileAttribution): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${fileAttr.path} -- Line Attribution`);
  lines.push(`  Total: ${fileAttr.totalLines} lines | Human: ${fileAttr.humanLines} | AI: ${fileAttr.aiLines} | Unknown: ${fileAttr.unknownLines}`);
  lines.push('');

  const lineNumWidth = String(fileAttr.totalLines).length;

  for (const line of fileAttr.lines) {
    const num = String(line.line).padStart(lineNumWidth);
    const content = truncate(line.content, 40);
    const author = truncate(line.author.email || line.author.name, 18);
    const date = line.commit.timestamp.slice(0, 10);
    const agent = line.agent ? getAgentDisplayName(line.agent.tool) : 'Human';
    const conf = line.confidence === 'high' ? '' : ` [${line.confidence}]`;

    lines.push(`  ${num} | ${content.padEnd(42)} ${author.padEnd(20)} ${date}  ${agent}${conf}`);
  }

  lines.push('');
  return lines.join('\n');
}

// ============================================================================
// JSON export
// ============================================================================

export function toJSON(attr: ProjectAttribution): string {
  return JSON.stringify(attr, null, 2);
}

export function fileToJSON(fileAttr: FileAttribution): string {
  return JSON.stringify(fileAttr, null, 2);
}

// ============================================================================
// CSV export
// ============================================================================

export function toCSV(attr: ProjectAttribution): string {
  const rows: string[] = [];
  rows.push('file,line,content,author_name,author_email,commit_hash,commit_date,agent,model,confidence,detection_method');

  for (const file of attr.files) {
    for (const line of file.lines) {
      rows.push([
        csvEscape(file.path),
        line.line,
        csvEscape(line.content),
        csvEscape(line.author.name),
        csvEscape(line.author.email),
        line.commit.hash.slice(0, 8),
        line.commit.timestamp.slice(0, 10),
        line.agent?.tool ?? 'human',
        csvEscape(line.agent?.model ?? ''),
        line.confidence,
        line.agent?.detectionMethod ?? '',
      ].join(','));
    }
  }

  return rows.join('\n');
}

export function fileToCSV(fileAttr: FileAttribution): string {
  const rows: string[] = [];
  rows.push('line,content,author_name,author_email,commit_hash,commit_date,agent,model,confidence,detection_method');

  for (const line of fileAttr.lines) {
    rows.push([
      line.line,
      csvEscape(line.content),
      csvEscape(line.author.name),
      csvEscape(line.author.email),
      line.commit.hash.slice(0, 8),
      line.commit.timestamp.slice(0, 10),
      line.agent?.tool ?? 'human',
      csvEscape(line.agent?.model ?? ''),
      line.confidence,
      line.agent?.detectionMethod ?? '',
    ].join(','));
  }

  return rows.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function pct(part: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 3) + '...';
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function getTopAgent(file: FileAttribution): AgentTool | null {
  let topAgent: AgentTool | null = null;
  let topCount = 0;
  for (const [agent, count] of Object.entries(file.byAgent)) {
    if ((count ?? 0) > topCount) {
      topCount = count ?? 0;
      topAgent = agent as AgentTool;
    }
  }
  return topAgent;
}

/**
 * Generate a summary-only object suitable for dashboard cards.
 */
export function generateDashboardSummary(attr: ProjectAttribution) {
  const { summary } = attr;
  return {
    repository: attr.repository,
    branch: attr.branch,
    commit: attr.commit,
    generatedAt: attr.generatedAt,
    totalLines: summary.totalLines,
    humanAuthored: summary.humanAuthored,
    aiAuthored: summary.aiAuthored,
    unknown: summary.unknown,
    aiPercentage: summary.totalLines > 0
      ? Math.round((summary.aiAuthored / summary.totalLines) * 100)
      : 0,
    byAgent: Object.entries(summary.byAgent).map(([tool, count]) => ({
      tool: tool as AgentTool,
      displayName: getAgentDisplayName(tool as AgentTool),
      lines: count ?? 0,
      percentage: summary.totalLines > 0
        ? Math.round(((count ?? 0) / summary.totalLines) * 100)
        : 0,
    })),
    topContributors: summary.topContributors.slice(0, 10),
    fileCount: attr.files.length,
    topAiFiles: attr.files
      .filter((f) => f.totalLines > 0)
      .map((f) => ({
        path: f.path,
        totalLines: f.totalLines,
        aiLines: f.aiLines,
        aiPercentage: Math.round((f.aiLines / f.totalLines) * 100),
        topAgent: getTopAgent(f),
      }))
      .sort((a, b) => b.aiPercentage - a.aiPercentage),
  };
}
