'use client';

import { useEffect, useState } from 'react';
import { useProfile } from '@/hooks/use-data';
import { apiClient } from '@/lib/api-client';
import { Shield, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import Link from 'next/link';

interface ControlSummary {
  total: number;
  met: number;
  partial: number;
  notMet: number;
}

export default function CompliancePanel() {
  const { data: profile } = useProfile();
  const [summary, setSummary] = useState<ControlSummary | null>(null);

  const adminOrg = profile?.orgs?.find((o) => o.role === 'admin');

  useEffect(() => {
    if (!adminOrg) return;
    apiClient
      .get<{ controls: unknown[]; summary: ControlSummary }>(
        `/api/v1/compliance/controls?orgId=${adminOrg.id}`
      )
      .then((res) => {
        if (res.data?.summary) setSummary(res.data.summary);
      })
      .catch(() => {});
  }, [adminOrg]);

  if (!adminOrg) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-sg-text3" />
          <h3 className="text-sm font-semibold text-sg-text0">Compliance</h3>
        </div>
        <p className="text-xs text-sg-text3">Admin access required to view compliance status.</p>
      </div>
    );
  }

  return (
    <Link href="/dashboard/compliance" className="block">
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-5 hover:border-sg-ship/30 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-sg-text2" />
            <h3 className="text-sm font-semibold text-sg-text0">SOC 2 Compliance</h3>
          </div>
          <span className="text-[10px] text-sg-text3">View details →</span>
        </div>
        {summary ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-sg-ship" />
              <span className="text-xs text-sg-text0">{summary.met} met</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-sg-warn" />
              <span className="text-xs text-sg-text0">{summary.partial} partial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-sg-noship" />
              <span className="text-xs text-sg-text0">{summary.notMet} not met</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="h-4 w-16 bg-sg-bg2 rounded animate-pulse" />
            <div className="h-4 w-16 bg-sg-bg2 rounded animate-pulse" />
          </div>
        )}
      </div>
    </Link>
  );
}
