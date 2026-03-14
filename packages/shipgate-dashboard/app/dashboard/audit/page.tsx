'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/hooks/use-data';
import { TableSkeleton } from '@/components/shared/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';

interface AuditRecord {
  id: string;
  orgId: string;
  userId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  metaJson: unknown;
  createdAt: string;
}

interface AuditResponse {
  ok: boolean;
  data: AuditRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function actionColor(action: string): string {
  if (action.includes('delete') || action.includes('remove')) return 'text-sg-noship';
  if (action.includes('create') || action.includes('add')) return 'text-sg-ship';
  if (action.includes('update') || action.includes('change')) return 'text-sg-warn';
  return 'text-sg-accent';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function AuditLogPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [orgId, setOrgId] = useState<string>('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [pagination, setPagination] = useState<{ total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminOrgs = profile?.orgs?.filter((o) => o.role === 'admin') ?? [];

  useEffect(() => {
    if (adminOrgs.length > 0 && !orgId) {
      setOrgId(adminOrgs[0].id);
    }
  }, [adminOrgs, orgId]);

  const fetchAudit = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ orgId, page: String(page), limit: '25' });
      if (actionFilter) params.set('type', actionFilter);
      const res = await fetch(`/api/v1/audit?${params.toString()}`, { credentials: 'same-origin' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to fetch audit log');
      }
      const data: AuditResponse = await res.json();
      setRecords(data.data);
      setPagination({ total: data.pagination.total, totalPages: data.pagination.totalPages });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgId, page, actionFilter]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Audit Log</h1>
          <p className="text-sg-text2 text-sm">Organization activity and event history</p>
        </div>
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (adminOrgs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Audit Log</h1>
          <p className="text-sg-text2 text-sm">Organization activity and event history</p>
        </div>
        <EmptyState
          title="Admin access required"
          description="You need admin role in an organization to view audit logs."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Audit Log</h1>
        <p className="text-sg-text2 text-sm">Organization activity and event history</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {adminOrgs.length > 1 && (
          <div>
            <label className="text-xs text-sg-text2 block mb-1">Organization</label>
            <select
              value={orgId}
              onChange={(e) => { setOrgId(e.target.value); setPage(1); }}
              className="bg-sg-bg2 border border-sg-border rounded-lg px-3 py-2 text-sm text-sg-text0 focus:outline-none focus:ring-1 focus:ring-sg-accent"
            >
              {adminOrgs.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-sg-text2 block mb-1">Action filter</label>
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            placeholder="e.g. run.completed"
            className="bg-sg-bg2 border border-sg-border rounded-lg px-3 py-2 text-sm text-sg-text0 placeholder:text-sg-text3 focus:outline-none focus:ring-1 focus:ring-sg-accent w-48"
          />
        </div>
        {pagination && (
          <p className="text-xs text-sg-text3 self-end pb-2">
            {pagination.total} event{pagination.total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Error */}
      {error && <ErrorState message={error} onRetry={fetchAudit} />}

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : records.length === 0 ? (
        <EmptyState title="No audit events" description="Activity will appear here as actions are performed." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-sg-border bg-sg-bg1">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sg-border">
                <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">Time</th>
                <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">Action</th>
                <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">Resource</th>
                <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">IP</th>
                <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">Request ID</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-sg-border last:border-0 hover:bg-sg-bg2/50">
                  <td className="p-4 text-sm text-sg-text1 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="p-4">
                    <span className={`text-sm font-medium ${actionColor(r.action)}`}>{r.action}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-sg-text1">{r.resource ?? '-'}</span>
                    {r.resourceId && (
                      <span className="text-xs text-sg-text3 ml-1 font-mono">{r.resourceId.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="p-4 font-mono text-xs text-sg-text3">{r.ip ?? '-'}</td>
                  <td className="p-4 font-mono text-xs text-sg-text3 truncate max-w-[140px]">{r.requestId ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs rounded-lg bg-sg-bg2 border border-sg-border text-sg-text1 hover:text-sg-text0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-sg-text3">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="px-3 py-1.5 text-xs rounded-lg bg-sg-bg2 border border-sg-border text-sg-text1 hover:text-sg-text0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
