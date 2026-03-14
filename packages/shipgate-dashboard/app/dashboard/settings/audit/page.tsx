'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/hooks/use-data';
import { Skeleton } from '@/components/shared/skeleton';
import { FileDown, ArrowLeft } from 'lucide-react';

export default function AuditExportPage() {
  const router = useRouter();
  const { data: profile, isLoading } = useProfile();
  const [orgId, setOrgId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminOrgs = profile?.orgs?.filter((o) => o.role === 'admin') ?? [];

  async function handleExport() {
    if (!orgId) {
      setError('Select an organization');
      return;
    }
    setError(null);
    setExporting(true);
    try {
      const params = new URLSearchParams({ orgId, format });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/v1/audit/export?${params.toString()}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Export failed');
        return;
      }
      const blob = await res.blob();
      const ext = format === 'csv' ? 'csv' : 'json';
      const filename = `audit-log-${orgId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed');
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-sg-text0 mb-6">Audit Log Export</h1>
        <Skeleton className="h-32 w-full rounded-lg mb-4" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="text-xs text-sg-text3 hover:text-sg-text1 mb-4 transition-colors flex items-center gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Settings
      </button>

      <h1 className="text-xl font-bold text-sg-text0 mb-2">Audit Log Export</h1>
      <p className="text-sm text-sg-text3 mb-6">
        Export organization audit trail for compliance. Admin only.
      </p>

      <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-sg-text2 mb-1">
            Organization
          </label>
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50"
          >
            <option value="">Select organization...</option>
            {adminOrgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-sg-text2 mb-1">From (optional)</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-sg-text2 mb-1">To (optional)</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-sg-text2 mb-1">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
            className="w-full px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm focus:outline-none focus:border-sg-ship/50"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </div>

        {error && (
          <p className="text-xs text-sg-noship">{error}</p>
        )}

        <button
          onClick={handleExport}
          disabled={exporting || !orgId}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sg-ship text-sg-bg0 text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileDown className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'Download Export'}
        </button>
      </div>
    </div>
  );
}
