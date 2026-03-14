'use client';

import { useState, useMemo } from 'react';
import { useRuns, useRun } from '@/hooks/use-data';
import type { ProofItem } from '@/hooks/use-data';
import { CardSkeleton, TableSkeleton } from '@/components/shared/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';

interface ClaimEntry {
  id: string;
  property: string;
  status: string;
  method: string;
  confidence: number | null;
}

const METHOD_STRENGTH: Record<string, { rank: number; label: string; color: string }> = {
  'smt-proof': { rank: 4, label: 'SMT Proof', color: '#00e68a' },
  'pbt-exhaustive': { rank: 3, label: 'PBT Exhaustive', color: '#38bdf8' },
  'static-analysis': { rank: 2, label: 'Static Analysis', color: '#a78bfa' },
  heuristic: { rank: 1, label: 'Heuristic', color: '#94a3b8' },
};

function verdictColor(verdict: string): string {
  switch (verdict?.toUpperCase()) {
    case 'PROVEN':
      return 'text-sg-ship';
    case 'VIOLATED':
      return 'text-sg-noship';
    case 'INCOMPLETE':
      return 'text-sg-warn';
    default:
      return 'text-sg-text2';
  }
}

function verdictBg(verdict: string): string {
  switch (verdict?.toUpperCase()) {
    case 'PROVEN':
      return 'bg-sg-ship/10 border-sg-ship/20';
    case 'VIOLATED':
      return 'bg-sg-noship/10 border-sg-noship/20';
    case 'INCOMPLETE':
      return 'bg-sg-warn/10 border-sg-warn/20';
    default:
      return 'bg-sg-bg2 border-sg-border';
  }
}

function claimStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'proven':
    case 'verified':
    case 'pass':
      return 'text-sg-ship';
    case 'violated':
    case 'failed':
    case 'fail':
      return 'text-sg-noship';
    case 'incomplete':
    case 'unknown':
      return 'text-sg-warn';
    default:
      return 'text-sg-text2';
  }
}

function extractClaims(proof: ProofItem): ClaimEntry[] {
  const summary = proof.summaryJson as Record<string, unknown> | null;
  if (!summary) return [];
  const claims = summary.claims as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(claims)) return [];
  return claims.map((c) => ({
    id: String(c.id ?? c.claimId ?? '-'),
    property: String(c.property ?? c.name ?? c.description ?? '-'),
    status: String(c.status ?? c.result ?? '-'),
    method: String(c.method ?? c.verificationMethod ?? '-'),
    confidence: typeof c.confidence === 'number' ? c.confidence : null,
  }));
}

function extractBundleVerdict(proof: ProofItem): string {
  const summary = proof.summaryJson as Record<string, unknown> | null;
  return String(summary?.verdict ?? proof.status ?? '-');
}

function isCertVerified(proof: ProofItem): boolean | null {
  const summary = proof.summaryJson as Record<string, unknown> | null;
  if (summary?.certificateVerified !== undefined) return Boolean(summary.certificateVerified);
  if (summary?.signatureValid !== undefined) return Boolean(summary.signatureValid);
  return null;
}

export default function ProofsPage() {
  const { data: runs, isLoading: runsLoading, error: runsError, refetch } = useRuns(undefined, 20);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const latestRunId = useMemo(() => {
    if (!runs || runs.length === 0) return null;
    return runs[0].id;
  }, [runs]);

  const activeRunId = selectedRunId ?? latestRunId;
  const { data: run, isLoading: runLoading, error: runError } = useRun(activeRunId);

  const isLoading = runsLoading || (activeRunId != null && runLoading);
  const error = runsError || runError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Proof Bundles</h1>
          <p className="text-sg-text2 text-sm">
            Formal verification proofs and attestation certificates
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CardSkeleton />
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Proof Bundles</h1>
          <p className="text-sg-text2 text-sm">
            Formal verification proofs and attestation certificates
          </p>
        </div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!run || run.proofs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Proof Bundles</h1>
          <p className="text-sg-text2 text-sm">
            Formal verification proofs and attestation certificates
          </p>
        </div>
        <EmptyState
          title="No proof bundles"
          description="Run verification with formal proofs enabled to see bundles here."
        />
      </div>
    );
  }

  const provenCount = run.proofs.filter(
    (p) => extractBundleVerdict(p).toUpperCase() === 'PROVEN'
  ).length;
  const violatedCount = run.proofs.filter(
    (p) => extractBundleVerdict(p).toUpperCase() === 'VIOLATED'
  ).length;
  const allClaims = run.proofs.flatMap(extractClaims);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Proof Bundles</h1>
          <p className="text-sg-text2 text-sm">
            Formal verification proofs and attestation certificates
          </p>
        </div>
        {runs && runs.length > 1 && (
          <select
            value={activeRunId ?? ''}
            onChange={(e) => setSelectedRunId(e.target.value || null)}
            className="px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50 transition-colors"
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.projectName} — {new Date(r.startedAt).toLocaleDateString()}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-2">
            Total Bundles
          </p>
          <p className="text-2xl font-bold text-sg-text0">{run.proofs.length}</p>
        </div>
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-2">
            Proven
          </p>
          <p className="text-2xl font-bold text-sg-ship">{provenCount}</p>
        </div>
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-2">
            Violated
          </p>
          <p
            className={`text-2xl font-bold ${violatedCount > 0 ? 'text-sg-noship' : 'text-sg-text2'}`}
          >
            {violatedCount}
          </p>
        </div>
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-2">
            Total Claims
          </p>
          <p className="text-2xl font-bold text-sg-text0">{allClaims.length}</p>
        </div>
      </div>

      {/* Proof Bundles */}
      <div className="space-y-4">
        {run.proofs.map((proof) => {
          const bundleVerdict = extractBundleVerdict(proof);
          const claims = extractClaims(proof);
          const certStatus = isCertVerified(proof);
          const summary = proof.summaryJson as Record<string, unknown> | null;

          return (
            <div
              key={proof.id}
              className="rounded-xl border border-sg-border bg-sg-bg1 overflow-hidden"
            >
              {/* Bundle Header */}
              <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex text-xs font-mono font-semibold px-2.5 py-1 rounded-md border ${verdictBg(bundleVerdict)} ${verdictColor(bundleVerdict)}`}
                  >
                    {bundleVerdict.toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-sg-text0 capitalize">
                      {proof.kind.replace(/[-_]/g, ' ')}
                    </p>
                    <p className="text-xs text-sg-text3 font-mono">{proof.id.slice(0, 12)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  {certStatus !== null && (
                    <span className={certStatus ? 'text-sg-ship' : 'text-sg-noship'}>
                      {certStatus
                        ? '\u2713 Certificate verified'
                        : '\u2717 Certificate invalid'}
                    </span>
                  )}
                  <span className="text-sg-text3">
                    {new Date(proof.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {/* Claims Table */}
              {claims.length > 0 && (
                <div className="border-t border-sg-border overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-sg-border">
                        <th className="text-left p-3 text-xs font-medium uppercase tracking-wider text-sg-text2">
                          Claim ID
                        </th>
                        <th className="text-left p-3 text-xs font-medium uppercase tracking-wider text-sg-text2">
                          Property
                        </th>
                        <th className="text-left p-3 text-xs font-medium uppercase tracking-wider text-sg-text2">
                          Status
                        </th>
                        <th className="text-left p-3 text-xs font-medium uppercase tracking-wider text-sg-text2">
                          Method
                        </th>
                        <th className="text-left p-3 text-xs font-medium uppercase tracking-wider text-sg-text2">
                          Confidence
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {claims.map((claim, i) => {
                        const methodMeta = METHOD_STRENGTH[claim.method] ?? {
                          rank: 0,
                          label: claim.method,
                          color: '#64748b',
                        };
                        return (
                          <tr
                            key={i}
                            className="border-b border-sg-border last:border-0 hover:bg-sg-bg2/50"
                          >
                            <td className="p-3 font-mono text-xs text-sg-text2">
                              {claim.id}
                            </td>
                            <td className="p-3 text-sm text-sg-text0">{claim.property}</td>
                            <td className="p-3">
                              <span
                                className={`text-xs font-medium capitalize ${claimStatusColor(claim.status)}`}
                              >
                                {claim.status}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                  {[1, 2, 3, 4].map((level) => (
                                    <div
                                      key={level}
                                      className="w-1.5 rounded-full"
                                      style={{
                                        height: `${8 + level * 3}px`,
                                        backgroundColor:
                                          level <= methodMeta.rank
                                            ? methodMeta.color
                                            : 'rgba(100,116,139,0.2)',
                                      }}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs text-sg-text1">
                                  {methodMeta.label}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-sm text-sg-text1">
                              {claim.confidence != null
                                ? `${Math.round(claim.confidence * 100)}%`
                                : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Fallback summary from summaryJson when no structured claims */}
              {summary && claims.length === 0 && (
                <div className="border-t border-sg-border p-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {Object.entries(summary)
                      .filter(
                        ([key]) =>
                          key !== 'verdict' &&
                          key !== 'claims' &&
                          key !== 'certificateVerified' &&
                          key !== 'signatureValid'
                      )
                      .slice(0, 6)
                      .map(([key, value]) => (
                        <div key={key}>
                          <p className="text-xs text-sg-text2 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                          <p className="text-sm font-medium text-sg-text0 font-mono">
                            {typeof value === 'number'
                              ? value % 1 !== 0
                                ? `${(value * 100).toFixed(0)}%`
                                : String(value)
                              : String(value ?? '-')}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {proof.artifactUrl && (
                <div className="border-t border-sg-border px-4 py-3">
                  <a
                    href={proof.artifactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sg-accent hover:underline"
                  >
                    Download proof bundle
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
