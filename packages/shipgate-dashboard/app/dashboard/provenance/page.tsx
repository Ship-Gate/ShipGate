'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useApi } from '@/hooks/use-api';
import { CardSkeleton, TableSkeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

interface AgentBreakdown {
  tool: string;
  displayName: string;
  lines: number;
  percentage: number;
}

interface Contributor {
  name: string;
  email: string;
  lines: number;
  aiPercentage: number;
}

interface TopAiFile {
  path: string;
  totalLines: number;
  aiLines: number;
  aiPercentage: number;
  topAgent: string | null;
}

interface ProvenanceSummary {
  repository: string;
  branch: string;
  commit: string;
  generatedAt: string;
  totalLines: number;
  humanAuthored: number;
  aiAuthored: number;
  unknown: number;
  aiPercentage: number;
  byAgent: AgentBreakdown[];
  topContributors: Contributor[];
  fileCount: number;
  topAiFiles: TopAiFile[];
}

interface FileLine {
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

interface FileListItem {
  path: string;
  totalLines: number;
  humanLines: number;
  aiLines: number;
  aiPercentage: number;
  topAgent: string | null;
}

interface TrendPoint {
  date: string;
  totalCommits: number;
  aiCommits: number;
  aiPercentage: number;
}

type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';

// ============================================================================
// Colors & labels
// ============================================================================

const AGENT_COLORS: Record<string, string> = {
  cursor: '#8b5cf6',
  copilot: '#3b82f6',
  'claude-code': '#f97316',
  codex: '#10b981',
  gemini: '#ef4444',
  windsurf: '#06b6d4',
  aider: '#eab308',
  cody: '#ec4899',
  'unknown-ai': '#6b7280',
};

function getAgentColor(tool: string): string {
  return AGENT_COLORS[tool] ?? '#6b7280';
}

function getAgentLabel(tool: string): string {
  const labels: Record<string, string> = {
    cursor: 'Cursor', copilot: 'GitHub Copilot', 'claude-code': 'Claude Code',
    codex: 'OpenAI Codex', gemini: 'Google Gemini', windsurf: 'Windsurf',
    aider: 'Aider', cody: 'Cody', 'unknown-ai': 'Unknown AI',
  };
  return labels[tool] ?? tool;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#22c55e', medium: '#eab308', low: '#6b7280',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'Verified via commit trailer or Co-authored-by',
  medium: 'Detected via commit message pattern',
  low: 'Inferred from config files or heuristics',
};

// ============================================================================
// Hooks
// ============================================================================

function useSelectedProject() {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setProjectId(params.get('project') || null);
  }, []);

  const apiBase = projectId
    ? `/api/v1/provenance?projectId=${projectId}`
    : '/api/v1/provenance?cwd=.';

  return { projectId, apiBase, setProjectId };
}

// ============================================================================
// Page
// ============================================================================

export default function ProvenancePage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileSearch, setFileSearch] = useState('');
  const [fileLimit, setFileLimit] = useState(50);
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [focusedLine, setFocusedLine] = useState(0);
  const blameRef = useRef<HTMLDivElement>(null);
  const { apiBase } = useSelectedProject();

  const dateParams = [
    dateFrom ? `&from=${dateFrom}` : '',
    dateTo ? `&to=${dateTo}` : '',
  ].join('');

  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch } =
    useApi<ProvenanceSummary>(`${apiBase}${dateParams}`);

  const { data: trends } =
    useApi<{ period: string; points: TrendPoint[] }>(
      `${apiBase.replace('/provenance', '/provenance/trends')}&period=weekly&limit=12`,
    );

  const { data: fileDetail, isLoading: fileDetailLoading } =
    useApi<{ file: FileListItem; lines: FileLine[] }>(
      selectedFile
        ? `${apiBase.replace('/provenance', '/provenance/files')}&path=${encodeURIComponent(selectedFile)}`
        : null,
    );

  // Filtered blame lines
  const filteredLines = useMemo(() => {
    if (!fileDetail?.lines) return [];
    if (confidenceFilter === 'all') return fileDetail.lines;
    return fileDetail.lines.filter((l) => l.confidence === confidenceFilter);
  }, [fileDetail?.lines, confidenceFilter]);

  // File list with pagination
  const filteredFiles = useMemo(() => {
    if (!summary?.topAiFiles) return [];
    let files = summary.topAiFiles;
    if (fileSearch) {
      files = files.filter((f) => f.path.toLowerCase().includes(fileSearch.toLowerCase()));
    }
    return files.slice(0, fileLimit);
  }, [summary?.topAiFiles, fileSearch, fileLimit]);

  const hasMoreFiles = (summary?.topAiFiles?.length ?? 0) > fileLimit;

  // Keyboard navigation for blame view
  useEffect(() => {
    if (!selectedFile || !filteredLines.length) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedLine((prev) => Math.min(prev + 1, filteredLines.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedLine((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        setSelectedFile(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'c' && focusedLine >= 0) {
        const line = filteredLines[focusedLine];
        if (line) {
          const json = JSON.stringify({
            line: line.line,
            content: line.content,
            author: line.authorEmail || line.authorName,
            agent: line.agent,
            model: line.agentModel,
            date: line.commitDate,
            confidence: line.confidence,
            commit: line.commitHash,
          }, null, 2);
          navigator.clipboard?.writeText(json);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedFile, filteredLines, focusedLine]);

  // Scroll focused line into view
  useEffect(() => {
    if (!blameRef.current) return;
    const row = blameRef.current.querySelector(`[data-line-idx="${focusedLine}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [focusedLine]);

  // Export handler with loading state
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const exportUrl = `${apiBase.replace('/provenance', '/provenance/export')}&format=${format}`;
      const res = await fetch(exportUrl);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `provenance-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [apiBase]);

  // ── Loading ──────────────────────────────────────────────────────────
  if (summaryLoading) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CardSkeleton /><CardSkeleton />
        </div>
        <TableSkeleton />
      </div>
    );
  }

  // ── Empty / Error state ──────────────────────────────────────────────
  if (summaryError || !summary) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="rounded-card bg-sg-bg1 border border-sg-border p-12 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-lg font-semibold text-sg-text0 mb-2">No provenance data yet</h2>
          <p className="text-sm text-sg-text2 mb-6 max-w-md mx-auto">
            Provenance tracks which AI agent wrote each line of your code.
            Initialize tracking to start building your audit trail.
          </p>
          <div className="space-y-3 text-left max-w-sm mx-auto">
            <Step n={1} text="Install the pre-commit hook" code="shipgate provenance init" />
            <Step n={2} text="Make commits with your AI tool" code="# Commits are auto-tagged with AI-Tool trailers" />
            <Step n={3} text="View your audit trail" code="shipgate provenance" />
          </div>
          {summaryError && (
            <button onClick={refetch} className="mt-6 px-4 py-2 rounded-lg text-xs font-medium bg-sg-accent text-white hover:opacity-90 transition-opacity">
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (summary.totalLines === 0) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="rounded-card bg-sg-bg1 border border-sg-border p-12 text-center">
          <div className="text-4xl mb-4">📭</div>
          <h2 className="text-lg font-semibold text-sg-text0 mb-2">No files found</h2>
          <p className="text-sm text-sg-text2 max-w-md mx-auto">
            No tracked source files were found. Make sure your project is a git repository with committed files.
          </p>
        </div>
      </div>
    );
  }

  // ── Pie data ─────────────────────────────────────────────────────────
  const pieData = [
    { name: 'Human', value: summary.humanAuthored, color: '#00e68a' },
    { name: 'AI-Assisted', value: summary.aiAuthored, color: '#8b5cf6' },
    ...(summary.unknown > 0 ? [{ name: 'Unknown', value: summary.unknown, color: '#555566' }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header with date filter + export */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader />
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-sg-bg2 text-sg-text1 border border-sg-border text-[11px] focus:border-sg-accent focus:outline-none"
              placeholder="From"
            />
            <span className="text-sg-text3">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-sg-bg2 text-sg-text1 border border-sg-border text-[11px] focus:border-sg-accent focus:outline-none"
            />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-[10px] text-sg-text3 hover:text-sg-text1">
                Clear
              </button>
            )}
          </div>

          <span className="text-sg-text3 text-[10px]">
            {summary.repository.replace(/\.git$/, '').split('/').pop()} &middot; {summary.branch}
          </span>

          {/* Export dropdown */}
          <div className="flex gap-1">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sg-bg2 text-sg-text1 hover:bg-sg-bg3 border border-sg-border transition-colors disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'CSV'}
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={exporting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sg-bg2 text-sg-text1 hover:bg-sg-bg3 border border-sg-border transition-colors disabled:opacity-50"
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Lines" value={summary.totalLines.toLocaleString()} />
        <StatCard
          label="AI-Assisted"
          value={`${summary.aiPercentage}%`}
          subtitle={`${summary.aiAuthored.toLocaleString()} lines`}
          accent="purple"
        />
        <StatCard
          label="Human-Authored"
          value={`${summary.totalLines > 0 ? Math.round((summary.humanAuthored / summary.totalLines) * 100) : 0}%`}
          subtitle={`${summary.humanAuthored.toLocaleString()} lines`}
          accent="green"
        />
        <StatCard label="Files Scanned" value={summary.fileCount.toLocaleString()} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie */}
        <div className="rounded-card bg-sg-bg1 border border-sg-border p-5">
          <h2 className="text-sm font-semibold text-sg-text0 mb-4">Attribution Breakdown</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => value.toLocaleString()}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs text-sg-text1">{entry.name}</span>
                  <span className="text-xs text-sg-text3 ml-auto">{entry.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Agent bar chart */}
        <div className="rounded-card bg-sg-bg1 border border-sg-border p-5">
          <h2 className="text-sm font-semibold text-sg-text0 mb-4">By AI Agent</h2>
          {summary.byAgent.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={summary.byAgent} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
                <XAxis type="number" tick={{ fill: '#8888a0', fontSize: 11 }} />
                <YAxis type="category" dataKey="displayName" width={120} tick={{ fill: '#c0c0d0', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => value.toLocaleString()}
                />
                <Bar dataKey="lines" radius={[0, 4, 4, 0]}>
                  {summary.byAgent.map((entry, i) => <Cell key={i} fill={getAgentColor(entry.tool)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-sg-text3 text-center py-8">No AI agents detected</p>
          )}
        </div>
      </div>

      {/* Trend */}
      {trends && trends.points.length > 0 && (
        <div className="rounded-card bg-sg-bg1 border border-sg-border p-5">
          <h2 className="text-sm font-semibold text-sg-text0 mb-4">AI Adoption Trend (Weekly)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trends.points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
              <XAxis dataKey="date" tick={{ fill: '#8888a0', fontSize: 10 }} />
              <YAxis tick={{ fill: '#8888a0', fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 12 }}
                formatter={(value: number) => `${value}%`}
              />
              <Area type="monotone" dataKey="aiPercentage" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} name="AI %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Contributors */}
      {summary.topContributors.length > 0 && (
        <div className="rounded-card bg-sg-bg1 border border-sg-border p-5">
          <h2 className="text-sm font-semibold text-sg-text0 mb-4">By Operator</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-sg-border">
                  <th className="pb-2 text-sg-text3 font-medium">Operator</th>
                  <th className="pb-2 text-sg-text3 font-medium text-right">Lines</th>
                  <th className="pb-2 text-sg-text3 font-medium text-right">AI %</th>
                  <th className="pb-2 text-sg-text3 font-medium" style={{ width: 200 }}>AI Usage</th>
                </tr>
              </thead>
              <tbody>
                {summary.topContributors.map((c) => (
                  <tr key={c.email} className="border-b border-sg-border/50">
                    <td className="py-2.5">
                      <span className="text-sg-text1">{c.name}</span>
                      <span className="text-sg-text3 ml-2">{c.email}</span>
                    </td>
                    <td className="py-2.5 text-right text-sg-text1">{c.lines.toLocaleString()}</td>
                    <td className="py-2.5 text-right text-sg-text1">{c.aiPercentage}%</td>
                    <td className="py-2.5">
                      <div className="flex-1 h-2 rounded-full bg-sg-bg3 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${c.aiPercentage}%`,
                            backgroundColor: c.aiPercentage > 70 ? '#8b5cf6' : c.aiPercentage > 30 ? '#3b82f6' : '#00e68a',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* File Browser with pagination */}
      <div className="rounded-card bg-sg-bg1 border border-sg-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-sg-text0">
            Files by AI Attribution
            <span className="text-sg-text3 font-normal ml-2">({summary.topAiFiles.length} total)</span>
          </h2>
          <input
            type="text"
            placeholder="Search files..."
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs bg-sg-bg2 text-sg-text1 border border-sg-border focus:border-sg-accent focus:outline-none w-64"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-sg-border">
                <th className="pb-2 text-sg-text3 font-medium">File</th>
                <th className="pb-2 text-sg-text3 font-medium text-right">Lines</th>
                <th className="pb-2 text-sg-text3 font-medium text-right">AI %</th>
                <th className="pb-2 text-sg-text3 font-medium">Primary Agent</th>
                <th className="pb-2 text-sg-text3 font-medium" style={{ width: 160 }}>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((f) => (
                <tr
                  key={f.path}
                  className={`border-b border-sg-border/50 cursor-pointer transition-colors ${
                    selectedFile === f.path ? 'bg-sg-bg2' : 'hover:bg-sg-bg2/50'
                  }`}
                  onClick={() => { setSelectedFile(selectedFile === f.path ? null : f.path); setFocusedLine(0); }}
                >
                  <td className="py-2.5">
                    <span className="text-sg-text1 font-mono text-[11px]">{f.path}</span>
                  </td>
                  <td className="py-2.5 text-right text-sg-text1">{f.totalLines}</td>
                  <td className="py-2.5 text-right">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        backgroundColor: f.aiPercentage > 70 ? '#8b5cf620' : f.aiPercentage > 30 ? '#3b82f620' : '#00e68a20',
                        color: f.aiPercentage > 70 ? '#8b5cf6' : f.aiPercentage > 30 ? '#3b82f6' : '#00e68a',
                      }}
                    >
                      {f.aiPercentage}%
                    </span>
                  </td>
                  <td className="py-2.5">
                    {f.topAgent && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                        style={{
                          borderColor: `${getAgentColor(f.topAgent)}40`,
                          color: getAgentColor(f.topAgent),
                          backgroundColor: `${getAgentColor(f.topAgent)}10`,
                        }}
                      >
                        {getAgentLabel(f.topAgent)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <div className="flex h-2 rounded-full overflow-hidden bg-sg-bg3">
                      <div className="h-full" style={{ width: `${f.aiPercentage}%`, backgroundColor: '#8b5cf6' }} />
                      <div className="h-full" style={{ width: `${100 - f.aiPercentage}%`, backgroundColor: '#00e68a' }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasMoreFiles && (
          <button
            onClick={() => setFileLimit((prev) => prev + 50)}
            className="mt-3 w-full py-2 rounded-lg text-xs font-medium bg-sg-bg2 text-sg-text2 hover:text-sg-text0 hover:bg-sg-bg3 border border-sg-border transition-colors"
          >
            Load more files ({summary.topAiFiles.length - fileLimit} remaining)
          </button>
        )}
      </div>

      {/* Blame View with keyboard nav + confidence filter */}
      {selectedFile && (
        <div className="rounded-card bg-sg-bg1 border border-sg-border p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-sg-text0">
              <span className="font-mono text-sg-accent">{selectedFile}</span>
              {' '}&mdash; Line Attribution
            </h2>
            <div className="flex items-center gap-3">
              {/* Confidence filter */}
              <div className="flex items-center gap-1">
                {(['all', 'high', 'medium', 'low'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setConfidenceFilter(level)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      confidenceFilter === level
                        ? 'bg-sg-bg3 text-sg-text0'
                        : 'text-sg-text3 hover:text-sg-text1'
                    }`}
                  >
                    {level === 'all' ? 'All' : (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS[level] }} />
                        {level}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <span className="text-[10px] text-sg-text3">
                j/k to navigate &middot; Ctrl+C to copy &middot; Esc to close
              </span>

              <button
                onClick={() => setSelectedFile(null)}
                className="text-xs text-sg-text3 hover:text-sg-text1 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {fileDetailLoading ? (
            <TableSkeleton />
          ) : filteredLines.length > 0 ? (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto" ref={blameRef}>
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="sticky top-0 bg-sg-bg1 z-10">
                  <tr className="border-b border-sg-border">
                    <th className="pb-2 pr-3 text-sg-text3 font-medium text-right w-12">#</th>
                    <th className="pb-2 pr-3 text-sg-text3 font-medium">Code</th>
                    <th className="pb-2 pr-3 text-sg-text3 font-medium w-40">Author</th>
                    <th className="pb-2 pr-3 text-sg-text3 font-medium w-24">Date</th>
                    <th className="pb-2 pr-3 text-sg-text3 font-medium w-28">Agent</th>
                    <th className="pb-2 text-sg-text3 font-medium w-20">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((l, idx) => (
                    <tr
                      key={`${l.line}-${idx}`}
                      data-line-idx={idx}
                      className={`border-b border-sg-border/30 transition-colors ${
                        l.agent ? 'bg-purple-500/[0.03]' : ''
                      } ${idx === focusedLine ? 'ring-1 ring-sg-accent/50 bg-sg-bg2/50' : ''}`}
                      onClick={() => setFocusedLine(idx)}
                    >
                      <td className="py-1 pr-3 text-right text-sg-text3">{l.line}</td>
                      <td className="py-1 pr-3 text-sg-text1 whitespace-pre overflow-hidden max-w-[500px] truncate">
                        {l.content}
                      </td>
                      <td className="py-1 pr-3 text-sg-text2 truncate">{l.authorEmail || l.authorName}</td>
                      <td className="py-1 pr-3 text-sg-text3">{l.commitDate.slice(0, 10)}</td>
                      <td className="py-1 pr-3">
                        {l.agent ? (
                          <span
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
                            style={{ color: getAgentColor(l.agent), backgroundColor: `${getAgentColor(l.agent)}15` }}
                          >
                            {getAgentLabel(l.agent)}
                          </span>
                        ) : (
                          <span className="text-sg-text3">Human</span>
                        )}
                      </td>
                      <td className="py-1">
                        <span
                          className="group relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold cursor-help"
                          style={{ color: CONFIDENCE_COLORS[l.confidence] ?? '#6b7280', backgroundColor: `${CONFIDENCE_COLORS[l.confidence] ?? '#6b7280'}15` }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CONFIDENCE_COLORS[l.confidence] ?? '#6b7280' }} />
                          {l.confidence}
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-sg-bg0 text-sg-text1 text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity border border-sg-border shadow-lg z-20">
                            {CONFIDENCE_LABELS[l.confidence] ?? l.detectionMethod ?? 'Unknown method'}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-sg-text3 text-center py-8">
              {confidenceFilter !== 'all'
                ? `No lines with ${confidenceFilter} confidence`
                : 'Select a file to view line-level attribution'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Code Provenance</h1>
      <p className="text-sg-text2 text-sm">Every line attributed to its AI agent, operator, and timestamp</p>
    </div>
  );
}

function StatCard({ label, value, subtitle, accent }: {
  label: string; value: string; subtitle?: string; accent?: 'green' | 'purple';
}) {
  const accentColor = accent === 'green' ? '#00e68a' : accent === 'purple' ? '#8b5cf6' : undefined;
  return (
    <div className="rounded-card bg-sg-bg1 border border-sg-border p-4">
      <p className="text-xs text-sg-text3 mb-1">{label}</p>
      <p className="text-2xl font-bold text-sg-text0" style={accentColor ? { color: accentColor } : undefined}>{value}</p>
      {subtitle && <p className="text-xs text-sg-text3 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Step({ n, text, code }: { n: number; text: string; code: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sg-accent/20 text-sg-accent text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <div>
        <p className="text-sm text-sg-text1">{text}</p>
        <code className="text-[11px] text-sg-text3 font-mono mt-1 block">{code}</code>
      </div>
    </div>
  );
}
