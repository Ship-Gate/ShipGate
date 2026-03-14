'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRun } from '@/hooks/use-data';
import type { FindingItem, ProofItem, ArtifactItem } from '@/hooks/use-data';
import { CardSkeleton, TableSkeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { RingChart } from '@/components/shared/ring-chart';

function formatDuration(ms: number | null): string {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function verdictConfig(verdict: string | null) {
  switch (verdict) {
    case 'SHIP':
      return {
        color: '#00e68a',
        bg: 'rgba(0,230,138,0.08)',
        border: 'rgba(0,230,138,0.2)',
        text: 'text-sg-ship',
        label: 'SHIP',
      };
    case 'WARN':
      return {
        color: '#ffb547',
        bg: 'rgba(255,181,71,0.08)',
        border: 'rgba(255,181,71,0.2)',
        text: 'text-sg-warn',
        label: 'WARN',
      };
    case 'NO_SHIP':
      return {
        color: '#ff5c6a',
        bg: 'rgba(255,92,106,0.08)',
        border: 'rgba(255,92,106,0.2)',
        text: 'text-sg-noship',
        label: 'NO_SHIP',
      };
    default:
      return {
        color: '#555566',
        bg: 'rgba(85,85,102,0.08)',
        border: 'rgba(85,85,102,0.2)',
        text: 'text-sg-text3',
        label: '—',
      };
  }
}

function severityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'text-sg-noship';
    case 'high':
      return 'text-sg-warn';
    case 'medium':
      return 'text-sg-accent';
    default:
      return 'text-sg-text2';
  }
}

function severityBg(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'bg-sg-noship-bg';
    case 'high':
      return 'bg-sg-warn-bg';
    case 'medium':
      return 'bg-sg-accent-bg';
    default:
      return 'bg-sg-bg2';
  }
}

function proofStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'proven':
    case 'verified':
      return 'text-sg-ship';
    case 'failed':
    case 'disproven':
      return 'text-sg-noship';
    default:
      return 'text-sg-text2';
  }
}

const ENGINE_META: Record<string, { label: string; color: string; bg: string }> = {
  taint: { label: 'Taint Analysis', color: '#e879f9', bg: 'rgba(232,121,249,0.08)' },
  'supply-chain': { label: 'Supply Chain', color: '#38bdf8', bg: 'rgba(56,189,248,0.08)' },
  semgrep: { label: 'Semgrep', color: '#fb923c', bg: 'rgba(251,146,60,0.08)' },
  security: { label: 'Security', color: '#f87171', bg: 'rgba(248,113,113,0.08)' },
  hallucination: { label: 'Hallucination', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
  mock: { label: 'Mock Detector', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
  firewall: { label: 'Firewall', color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
  'phantom-deps': { label: 'Phantom Deps', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
  'auth-drift': { label: 'Auth Drift', color: '#f472b6', bg: 'rgba(244,114,182,0.08)' },
  'fake-success': { label: 'Fake Success', color: '#facc15', bg: 'rgba(250,204,21,0.08)' },
  other: { label: 'Other', color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
};

function getEngine(finding: FindingItem): string {
  const meta = finding.metaJson as Record<string, unknown> | null;
  if (meta?.engine && typeof meta.engine === 'string') return meta.engine;
  const cat = finding.category?.toLowerCase() ?? '';
  if (cat.includes('taint')) return 'taint';
  if (cat.includes('supply-chain') || cat.includes('cve') || cat.includes('typosquat') || cat.includes('lockfile')) return 'supply-chain';
  if (cat.includes('semgrep')) return 'semgrep';
  if (cat.includes('hallucin')) return 'hallucination';
  if (cat.includes('fake-success')) return 'fake-success';
  if (cat.includes('mock-detect')) return 'mock';
  if (cat.includes('firewall')) return 'firewall';
  if (cat.includes('phantom-dep')) return 'phantom-deps';
  if (cat.includes('auth-drift')) return 'auth-drift';
  if (cat.includes('xss') || cat.includes('sqli') || cat.includes('ssrf') || cat.includes('secret') || cat.includes('security')) return 'security';
  return 'other';
}

function groupFindingsByEngine(findings: FindingItem[]): Map<string, FindingItem[]> {
  const groups = new Map<string, FindingItem[]>();
  for (const f of findings) {
    const engine = getEngine(f);
    if (!groups.has(engine)) groups.set(engine, []);
    groups.get(engine)!.push(f);
  }
  return groups;
}

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.id as string;
  const { data: run, isLoading, error, refetch } = useRun(runId);
  const [collapsedEngines, setCollapsedEngines] = useState<Set<string>>(new Set());

  function toggleEngine(engine: string) {
    setCollapsedEngines((prev) => {
      const next = new Set(prev);
      if (next.has(engine)) next.delete(engine);
      else next.add(engine);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <BackLink />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <BackLink />
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          title="Run not found"
          description="This verification run doesn't exist or you don't have access to it."
        />
      </div>
    );
  }

  const vc = verdictConfig(run.verdict);
  const score = run.score != null ? Math.round(run.score * 100) : null;
  const criticalCount = run.findings.filter(
    (f) => f.severity?.toLowerCase() === 'critical'
  ).length;
  const highCount = run.findings.filter(
    (f) => f.severity?.toLowerCase() === 'high'
  ).length;
  const mediumCount = run.findings.filter(
    (f) => f.severity?.toLowerCase() === 'medium'
  ).length;
  const lowCount = run.findings.filter(
    (f) =>
      f.severity?.toLowerCase() === 'low' ||
      f.severity?.toLowerCase() === 'info'
  ).length;

  const engineGroups = groupFindingsByEngine(run.findings);

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">
            {run.projectName}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            {run.branch && (
              <span className="text-sm text-sg-text2 font-mono bg-sg-bg2 px-2 py-0.5 rounded">
                {run.branch}
              </span>
            )}
            {run.commitSha && (
              <span className="text-xs text-sg-text3 font-mono">
                {run.commitSha.slice(0, 7)}
              </span>
            )}
            <span className="text-xs text-sg-text3 capitalize">{run.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <ShareButton runId={runId} />
          <span
            className="inline-flex text-xs font-mono font-semibold px-3 py-1.5 rounded-badge border"
            style={{
              backgroundColor: vc.bg,
              borderColor: vc.border,
              color: vc.color,
            }}
          >
            {vc.label}
          </span>
        </div>
      </div>

      {/* Score + Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Score ring */}
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5 flex items-center gap-4">
          <RingChart
            value={score ?? 0}
            size={64}
            stroke={5}
            color={vc.color}
          >
            <span className={`text-sm font-bold ${vc.text}`}>
              {score != null ? `${score}` : '-'}
            </span>
          </RingChart>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-sg-text2">
              Ship Score
            </p>
            <p className="text-lg font-bold text-sg-text0">
              {score != null ? `${score}%` : '-'}
            </p>
          </div>
        </div>

        {/* Findings summary */}
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-2">
            Findings
          </p>
          <p className="text-2xl font-bold text-sg-text0 mb-2">
            {run.findings.length}
          </p>
          <div className="flex gap-3 text-xs">
            {criticalCount > 0 && (
              <span className="text-sg-noship">{criticalCount} critical</span>
            )}
            {highCount > 0 && (
              <span className="text-sg-warn">{highCount} high</span>
            )}
            {mediumCount > 0 && (
              <span className="text-sg-accent">{mediumCount} med</span>
            )}
            {lowCount > 0 && (
              <span className="text-sg-text2">{lowCount} low</span>
            )}
            {run.findings.length === 0 && (
              <span className="text-sg-ship">Clean</span>
            )}
          </div>
        </div>

        {/* Duration */}
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-2">
            Duration
          </p>
          <p className="text-2xl font-bold text-sg-text0">
            {formatDuration(run.durationMs)}
          </p>
          <p className="text-xs text-sg-text3 mt-1">
            {formatDate(run.startedAt)}
          </p>
        </div>

        {/* Agent + Proofs */}
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-2">
            Agent
          </p>
          <p className="text-sm font-medium text-sg-text0 capitalize">
            {run.agentType}
          </p>
          {run.agentVersion && (
            <p className="text-xs text-sg-text3 font-mono mt-0.5">
              v{run.agentVersion}
            </p>
          )}
          <p className="text-xs text-sg-text2 mt-2">
            {run.proofs.length} proof bundle{run.proofs.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Run metadata */}
      {(run.userName || run.projectRepoUrl) && (
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {run.userName && (
            <div className="flex items-center gap-2">
              {run.userAvatar && (
                <img
                  src={run.userAvatar}
                  alt=""
                  className="w-5 h-5 rounded-full"
                />
              )}
              <span className="text-sg-text2">Triggered by</span>
              <span className="text-sg-text0 font-medium">{run.userName}</span>
            </div>
          )}
          {run.projectRepoUrl && (
            <div className="flex items-center gap-2">
              <span className="text-sg-text2">Repo</span>
              <a
                href={run.projectRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sg-accent hover:underline font-mono text-xs"
              >
                {run.projectRepoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
              </a>
            </div>
          )}
          {run.finishedAt && (
            <div className="flex items-center gap-2">
              <span className="text-sg-text2">Finished</span>
              <span className="text-sg-text1">{formatDate(run.finishedAt)}</span>
            </div>
          )}
        </div>
      )}

      {/* Findings by Engine */}
      <div>
        <h2 className="text-lg font-semibold text-sg-text0 mb-4">Findings</h2>
        {run.findings.length === 0 ? (
          <EmptyState
            title="No findings"
            description="This run completed without any issues."
          />
        ) : (
          <div className="space-y-3">
            {Array.from(engineGroups.entries()).map(([engine, findings]) => {
              const meta = ENGINE_META[engine] ?? ENGINE_META.other;
              const isCollapsed = collapsedEngines.has(engine);
              const eCritical = findings.filter((f) => f.severity?.toLowerCase() === 'critical').length;
              const eHigh = findings.filter((f) => f.severity?.toLowerCase() === 'high').length;
              const eMedium = findings.filter((f) => f.severity?.toLowerCase() === 'medium').length;
              const eLow = findings.filter(
                (f) => f.severity?.toLowerCase() === 'low' || f.severity?.toLowerCase() === 'info'
              ).length;

              return (
                <div key={engine} className="rounded-xl border border-sg-border bg-sg-bg1 overflow-hidden">
                  <button
                    onClick={() => toggleEngine(engine)}
                    className="w-full flex items-center justify-between p-4 hover:bg-sg-bg2/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-md"
                        style={{
                          color: meta.color,
                          backgroundColor: meta.bg,
                          border: `1px solid ${meta.color}33`,
                        }}
                      >
                        {meta.label}
                      </span>
                      <span className="text-sm text-sg-text1 font-medium">
                        {findings.length} finding{findings.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-2 text-xs">
                        {eCritical > 0 && <span className="text-sg-noship">{eCritical} critical</span>}
                        {eHigh > 0 && <span className="text-sg-warn">{eHigh} high</span>}
                        {eMedium > 0 && <span className="text-sg-accent">{eMedium} med</span>}
                        {eLow > 0 && <span className="text-sg-text2">{eLow} low</span>}
                      </div>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className={`shrink-0 text-sg-text3 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                      >
                        <path
                          d="M4 6L8 10L12 6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="border-t border-sg-border overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-sg-border">
                            <th className="text-left p-3 text-xs font-medium uppercase tracking-wider text-sg-text2">Severity</th>
                            <th className="text-left p-3 text-xs font-medium uppercase tracking-wider text-sg-text2">Category</th>
                            <th className="text-left p-3 text-xs font-medium uppercase tracking-wider text-sg-text2">File</th>
                            <th className="text-left p-3 text-xs font-medium uppercase tracking-wider text-sg-text2">Line</th>
                            <th className="text-left p-3 text-xs font-medium uppercase tracking-wider text-sg-text2">Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {findings.map((f) => (
                            <tr key={f.id} className="border-b border-sg-border last:border-0 hover:bg-sg-bg2/50">
                              <td className="p-3">
                                <span
                                  className={`inline-flex text-xs font-medium capitalize px-2 py-0.5 rounded ${severityColor(f.severity)} ${severityBg(f.severity)}`}
                                >
                                  {f.severity}
                                </span>
                              </td>
                              <td className="p-3 text-sg-text1 text-sm">{f.category}</td>
                              <td className="p-3">
                                {f.filePath ? (
                                  <span className="font-mono text-xs text-sg-text2">{f.filePath}</span>
                                ) : (
                                  <span className="text-sg-text3">-</span>
                                )}
                              </td>
                              <td className="p-3 font-mono text-xs text-sg-text3">
                                {f.lineStart != null ? f.lineStart : '-'}
                              </td>
                              <td className="p-3 text-sg-text2 text-sm max-w-[320px]">{f.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Proof Bundles */}
      {run.proofs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-sg-text0 mb-4">
            Proof Bundles
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {run.proofs.map((proof) => (
              <ProofCard key={proof.id} proof={proof} />
            ))}
          </div>
        </div>
      )}

      {/* Artifacts */}
      {run.artifacts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-sg-text0 mb-4">
            Artifacts
          </h2>
          <div className="overflow-x-auto rounded-xl border border-sg-border bg-sg-bg1">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sg-border">
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Kind
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Path
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Size
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    SHA-256
                  </th>
                </tr>
              </thead>
              <tbody>
                {run.artifacts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-sg-border last:border-0 hover:bg-sg-bg2/50"
                  >
                    <td className="p-4 text-sm text-sg-text0 capitalize">
                      {a.kind}
                    </td>
                    <td className="p-4 font-mono text-xs text-sg-text2">
                      {a.path}
                    </td>
                    <td className="p-4 text-sm text-sg-text1">
                      {a.sizeBytes != null
                        ? a.sizeBytes > 1024
                          ? `${(a.sizeBytes / 1024).toFixed(1)} KB`
                          : `${a.sizeBytes} B`
                        : '-'}
                    </td>
                    <td className="p-4 font-mono text-xs text-sg-text3 truncate max-w-[200px]">
                      {a.sha256 ? a.sha256.slice(0, 16) + '...' : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareButton({ runId }: { runId: string }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/runs/${runId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ expiresInHours: 72 }),
      });
      if (res.ok) {
        const data = await res.json();
        setShareUrl(data.data?.shareUrl);
        await navigator.clipboard.writeText(data.data?.shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // share failed
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-badge border border-sg-border bg-sg-bg2 text-sg-text1 hover:text-sg-text0 hover:bg-sg-bg3 transition-colors disabled:opacity-50"
      title={shareUrl ? 'Copy link' : 'Generate shareable link'}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M4.5 3H9V7.5M9 3L3 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {copied ? 'Copied!' : loading ? 'Generating...' : shareUrl ? 'Copy link' : 'Share'}
    </button>
  );
}

function ExplainButton({ findingId }: { findingId: string }) {
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleExplain() {
    if (explanation) {
      setOpen(!open);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/findings/${findingId}/explain`, {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = await res.json();
        setExplanation(data.data?.explanation);
      }
    } catch {
      // failed silently
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleExplain}
        className="text-xs text-sg-accent hover:text-sg-accent/80 transition-colors whitespace-nowrap"
      >
        {open ? 'Hide' : 'Explain'}
      </button>
      {open && (
        <div className="mt-2 p-3 rounded-lg bg-sg-bg2 border border-sg-border text-xs space-y-2 max-w-sm">
          {loading ? (
            <p className="text-sg-text3 animate-pulse">Analyzing finding...</p>
          ) : explanation ? (
            <>
              <div>
                <p className="font-medium text-sg-text0 mb-0.5">What it means</p>
                <p className="text-sg-text2">{explanation.whatItMeans}</p>
              </div>
              <div>
                <p className="font-medium text-sg-text0 mb-0.5">Why it matters</p>
                <p className="text-sg-text2">{explanation.whyItMatters}</p>
              </div>
              <div>
                <p className="font-medium text-sg-text0 mb-0.5">How to fix</p>
                <p className="text-sg-text2">{explanation.howToFix}</p>
              </div>
              <div>
                <p className="font-medium text-sg-text0 mb-0.5">Urgency</p>
                <p className="text-sg-text2">{explanation.urgency}</p>
              </div>
            </>
          ) : (
            <p className="text-sg-text3">Could not load explanation.</p>
          )}
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard/runs"
      className="inline-flex items-center gap-1.5 text-sm text-sg-text2 hover:text-sg-text0 transition-colors"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="shrink-0"
      >
        <path
          d="M10 12L6 8L10 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Back to Runs
    </Link>
  );
}

function ProofCard({ proof }: { proof: ProofItem }) {
  const summary =
    proof.summaryJson && typeof proof.summaryJson === 'object'
      ? (proof.summaryJson as Record<string, unknown>)
      : null;

  return (
    <div className="rounded-xl border border-sg-border bg-sg-bg1 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-sg-text0 capitalize">
          {proof.kind.replace(/[-_]/g, ' ')}
        </span>
        <span
          className={`text-xs font-mono font-semibold ${proofStatusColor(proof.status)}`}
        >
          {proof.status}
        </span>
      </div>
      {summary && (
        <div className="space-y-1">
          {Object.entries(summary)
            .slice(0, 4)
            .map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between text-xs"
              >
                <span className="text-sg-text2 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className="text-sg-text1 font-mono">
                  {typeof value === 'number'
                    ? value % 1 !== 0
                      ? `${(value * 100).toFixed(0)}%`
                      : String(value)
                    : String(value ?? '-')}
                </span>
              </div>
            ))}
        </div>
      )}
      {proof.artifactUrl && (
        <a
          href={proof.artifactUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-xs text-sg-accent hover:underline"
        >
          View artifact
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M4.5 3H9V7.5M9 3L3 9"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      )}
      <p className="text-[10px] text-sg-text3 mt-2">
        {new Date(proof.createdAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
    </div>
  );
}
