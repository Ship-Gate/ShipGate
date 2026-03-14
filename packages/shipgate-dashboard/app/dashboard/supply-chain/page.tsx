'use client';

import { useMemo } from 'react';
import { useRuns, useRun } from '@/hooks/use-data';
import type { FindingItem } from '@/hooks/use-data';
import { CardSkeleton, TableSkeleton } from '@/components/shared/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';

interface VulnEntry {
  packageName: string;
  version: string;
  cveId: string;
  severity: string;
  description: string;
}

interface TyposquatEntry {
  packageName: string;
  similarTo: string;
}

function isSupplyChainFinding(f: FindingItem): boolean {
  const meta = f.metaJson as Record<string, unknown> | null;
  if (meta?.engine === 'supply-chain') return true;
  const cat = f.category?.toLowerCase() ?? '';
  return (
    cat.includes('supply-chain') ||
    cat.includes('cve') ||
    cat.includes('typosquat') ||
    cat.includes('lockfile') ||
    cat.includes('vulnerability')
  );
}

function extractVuln(f: FindingItem): VulnEntry | null {
  const meta = f.metaJson as Record<string, unknown> | null;
  const cat = f.category?.toLowerCase() ?? '';
  if (cat.includes('typosquat')) return null;
  return {
    packageName: String(meta?.packageName ?? meta?.package ?? f.title),
    version: String(meta?.version ?? '-'),
    cveId: String(meta?.cveId ?? meta?.osvId ?? meta?.advisoryId ?? '-'),
    severity: f.severity,
    description: f.message,
  };
}

function extractTyposquat(f: FindingItem): TyposquatEntry | null {
  const meta = f.metaJson as Record<string, unknown> | null;
  const cat = f.category?.toLowerCase() ?? '';
  if (!cat.includes('typosquat') && !meta?.isTyposquat) return null;
  return {
    packageName: String(meta?.packageName ?? meta?.package ?? f.title),
    similarTo: String(meta?.similarTo ?? meta?.legitimatePackage ?? '-'),
  };
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

export default function SupplyChainPage() {
  const { data: runs, isLoading: runsLoading, error: runsError, refetch } = useRuns(undefined, 10);

  const latestRunId = runs?.[0]?.id ?? null;
  const { data: run, isLoading: runLoading, error: runError } = useRun(latestRunId);

  const isLoading = runsLoading || (latestRunId != null && runLoading);
  const error = runsError || runError;

  const scFindings = useMemo(() => {
    if (!run) return [];
    return run.findings.filter(isSupplyChainFinding);
  }, [run]);

  const vulns = useMemo(
    () => scFindings.map(extractVuln).filter(Boolean) as VulnEntry[],
    [scFindings]
  );

  const typosquats = useMemo(
    () => scFindings.map(extractTyposquat).filter(Boolean) as TyposquatEntry[],
    [scFindings]
  );

  const runMeta = run?.metaJson as Record<string, unknown> | null;
  const lockfileValid = runMeta?.lockfileValid as boolean | undefined;
  const totalPackages = (runMeta?.totalPackages as number) ?? vulns.length;
  const criticalCount = vulns.filter((v) => v.severity?.toLowerCase() === 'critical').length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Supply Chain</h1>
          <p className="text-sg-text2 text-sm">
            Package vulnerabilities, integrity, and typosquat detection
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Supply Chain</h1>
          <p className="text-sg-text2 text-sm">
            Package vulnerabilities, integrity, and typosquat detection
          </p>
        </div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!run || scFindings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Supply Chain</h1>
          <p className="text-sg-text2 text-sm">
            Package vulnerabilities, integrity, and typosquat detection
          </p>
        </div>
        <EmptyState
          title="No supply chain data"
          description="Run a scan with supply-chain analysis enabled to see results here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Supply Chain</h1>
        <p className="text-sg-text2 text-sm">
          Package vulnerabilities, integrity, and typosquat detection
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-2">
            Total Packages
          </p>
          <p className="text-2xl font-bold text-sg-text0">{totalPackages}</p>
        </div>
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-2">
            Vulnerable
          </p>
          <p className={`text-2xl font-bold ${vulns.length > 0 ? 'text-sg-noship' : 'text-sg-ship'}`}>
            {vulns.length}
          </p>
        </div>
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-2">
            Critical CVEs
          </p>
          <p className={`text-2xl font-bold ${criticalCount > 0 ? 'text-sg-noship' : 'text-sg-ship'}`}>
            {criticalCount}
          </p>
        </div>
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-2">
            Typosquat Warnings
          </p>
          <p className={`text-2xl font-bold ${typosquats.length > 0 ? 'text-sg-warn' : 'text-sg-ship'}`}>
            {typosquats.length}
          </p>
        </div>
      </div>

      {/* Lockfile Integrity */}
      {lockfileValid !== undefined && (
        <div
          className={`rounded-xl border p-4 flex items-center gap-3 ${
            lockfileValid
              ? 'border-sg-ship/20 bg-sg-ship/5'
              : 'border-sg-noship/20 bg-sg-noship/5'
          }`}
        >
          <span
            className={`text-sm font-medium ${
              lockfileValid ? 'text-sg-ship' : 'text-sg-noship'
            }`}
          >
            {lockfileValid
              ? '\u2713 Lockfile integrity verified'
              : '\u2717 Lockfile integrity check failed'}
          </span>
        </div>
      )}

      {/* Vulnerability Table */}
      {vulns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-sg-text0 mb-4">Vulnerabilities</h2>
          <div className="overflow-x-auto rounded-xl border border-sg-border bg-sg-bg1">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sg-border">
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Package
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Version
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    CVE / OSV ID
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Severity
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {vulns.map((v, i) => (
                  <tr
                    key={i}
                    className="border-b border-sg-border last:border-0 hover:bg-sg-bg2/50"
                  >
                    <td className="p-4 font-mono text-sm text-sg-text0">{v.packageName}</td>
                    <td className="p-4 font-mono text-sm text-sg-text2">{v.version}</td>
                    <td className="p-4 font-mono text-xs text-sg-accent">{v.cveId}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex text-xs font-medium capitalize px-2 py-0.5 rounded ${severityColor(v.severity)} ${severityBg(v.severity)}`}
                      >
                        {v.severity}
                      </span>
                    </td>
                    <td className="p-4 text-sg-text2 text-sm max-w-[320px]">
                      {v.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Typosquat Warnings */}
      {typosquats.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-sg-text0 mb-4">Typosquat Warnings</h2>
          <div className="overflow-x-auto rounded-xl border border-sg-border bg-sg-bg1">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sg-border">
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Suspicious Package
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Similar To (Legitimate)
                  </th>
                </tr>
              </thead>
              <tbody>
                {typosquats.map((t, i) => (
                  <tr
                    key={i}
                    className="border-b border-sg-border last:border-0 hover:bg-sg-bg2/50"
                  >
                    <td className="p-4 font-mono text-sm text-sg-warn">{t.packageName}</td>
                    <td className="p-4 font-mono text-sm text-sg-text1">{t.similarTo}</td>
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
