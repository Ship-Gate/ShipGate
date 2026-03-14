'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/hooks/use-data';
import { apiClient } from '@/lib/api-client';
import { Skeleton } from '@/components/shared/skeleton';
import { Shield, FileDown, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

interface ControlStatus {
  id: string;
  name: string;
  category: string;
  status: 'met' | 'partial' | 'not_met';
  evidence: string[];
  lastVerified: string;
}

interface ControlsData {
  controls: ControlStatus[];
  summary: { total: number; met: number; partial: number; notMet: number };
}

interface EvidenceData {
  period: { from: string; to: string };
  cc6_logical_access: {
    totalMembers: number;
    roleBreakdown: Record<string, number>;
    ssoEnabled: boolean;
    ssoEnforced: boolean;
  };
  cc7_system_operations: {
    auditLogCount: number;
    auditExportAvailable: boolean;
  };
  cc8_change_management: {
    proofBundleCount: number;
  };
  cc5_control_activities: {
    runCount: number;
    verdictBreakdown: Record<string, number>;
  };
}

interface Snapshot {
  id: string;
  period: string;
  framework: string;
  createdAt: string;
}

const STATUS_CONFIG = {
  met: { icon: CheckCircle2, label: 'Met', className: 'text-sg-ship' },
  partial: { icon: AlertTriangle, label: 'Partial', className: 'text-sg-warn' },
  not_met: { icon: XCircle, label: 'Not Met', className: 'text-sg-noship' },
};

export default function CompliancePage() {
  const { data: profile, isLoading: profileLoading } = useProfile();

  const [orgId, setOrgId] = useState('');
  const [controls, setControls] = useState<ControlsData | null>(null);
  const [evidence, setEvidence] = useState<EvidenceData | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminOrgs = profile?.orgs?.filter((o) => o.role === 'admin') ?? [];

  const loadData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [ctrlRes, evRes, snapRes] = await Promise.all([
        apiClient.get<ControlsData>(`/api/v1/compliance/controls?orgId=${id}`),
        apiClient.get<EvidenceData>(`/api/v1/compliance/evidence?orgId=${id}`),
        apiClient.get<Snapshot[]>(`/api/v1/compliance/snapshots?orgId=${id}`),
      ]);
      setControls(ctrlRes.data ?? null);
      setEvidence(evRes.data ?? null);
      setSnapshots((snapRes.data as unknown as Snapshot[]) ?? []);
    } catch {
      setError('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orgId) loadData(orgId);
  }, [orgId, loadData]);

  useEffect(() => {
    if (adminOrgs.length === 1 && !orgId) setOrgId(adminOrgs[0].id);
  }, [adminOrgs, orgId]);

  async function handleSnapshot() {
    if (!orgId) return;
    setSnapshotting(true);
    try {
      await apiClient.post('/api/v1/compliance/snapshots', { orgId });
      await loadData(orgId);
    } catch {
      setError('Failed to create snapshot');
    } finally {
      setSnapshotting(false);
    }
  }

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-sg-text0">Compliance</h1>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-sg-text0">SOC 2 Compliance</h1>
          <p className="text-sm text-sg-text3 mt-1">Control status and evidence collection</p>
        </div>
        <div className="flex items-center gap-3">
          {adminOrgs.length > 1 && (
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-sg-bg2 border border-sg-border text-sg-text0 text-sm"
            >
              <option value="">Select org...</option>
              {adminOrgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleSnapshot}
            disabled={snapshotting || !orgId}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sg-ship text-sg-bg0 text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
          >
            <FileDown className="w-4 h-4" />
            {snapshotting ? 'Creating...' : 'Generate Snapshot'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-sg-noship/10 border border-sg-noship/30 text-sg-noship text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : controls && evidence ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-sg-bg1 border border-sg-border rounded-xl p-4">
              <div className="text-2xl font-bold text-sg-ship">{controls.summary.met}</div>
              <div className="text-xs text-sg-text3 mt-1">Controls Met</div>
            </div>
            <div className="bg-sg-bg1 border border-sg-border rounded-xl p-4">
              <div className="text-2xl font-bold text-sg-warn">{controls.summary.partial}</div>
              <div className="text-xs text-sg-text3 mt-1">Partial</div>
            </div>
            <div className="bg-sg-bg1 border border-sg-border rounded-xl p-4">
              <div className="text-2xl font-bold text-sg-noship">{controls.summary.notMet}</div>
              <div className="text-xs text-sg-text3 mt-1">Not Met</div>
            </div>
            <div className="bg-sg-bg1 border border-sg-border rounded-xl p-4">
              <div className="text-2xl font-bold text-sg-text0">{controls.summary.total}</div>
              <div className="text-xs text-sg-text3 mt-1">Total Controls</div>
            </div>
          </div>

          {/* Evidence summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-sg-bg1 border border-sg-border rounded-xl p-4">
              <div className="text-lg font-bold text-sg-text0">{evidence.cc6_logical_access.totalMembers}</div>
              <div className="text-xs text-sg-text3">Members (RBAC)</div>
            </div>
            <div className="bg-sg-bg1 border border-sg-border rounded-xl p-4">
              <div className="text-lg font-bold text-sg-text0">{evidence.cc7_system_operations.auditLogCount}</div>
              <div className="text-xs text-sg-text3">Audit Events (90d)</div>
            </div>
            <div className="bg-sg-bg1 border border-sg-border rounded-xl p-4">
              <div className="text-lg font-bold text-sg-text0">{evidence.cc8_change_management.proofBundleCount}</div>
              <div className="text-xs text-sg-text3">Proof Bundles (90d)</div>
            </div>
            <div className="bg-sg-bg1 border border-sg-border rounded-xl p-4">
              <div className="text-lg font-bold text-sg-text0">{evidence.cc5_control_activities.runCount}</div>
              <div className="text-xs text-sg-text3">Runs (90d)</div>
            </div>
          </div>

          {/* Controls table */}
          <div className="bg-sg-bg1 border border-sg-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-sg-border flex items-center gap-2">
              <Shield className="w-4 h-4 text-sg-text2" />
              <h2 className="text-sm font-semibold text-sg-text0">SOC 2 Control Checklist</h2>
            </div>
            <div className="divide-y divide-sg-border">
              {controls.controls.map((ctrl) => {
                const cfg = STATUS_CONFIG[ctrl.status];
                const StatusIcon = cfg.icon;
                return (
                  <div key={ctrl.id} className="px-6 py-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-xs font-mono text-sg-text3 mr-2">{ctrl.id}</span>
                        <span className="text-sm font-medium text-sg-text0">{ctrl.name}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.className}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </div>
                    </div>
                    <ul className="space-y-0.5">
                      {ctrl.evidence.map((e, i) => (
                        <li key={i} className="text-xs text-sg-text3 pl-4">
                          • {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Snapshots */}
          {snapshots.length > 0 && (
            <div className="bg-sg-bg1 border border-sg-border rounded-xl p-6">
              <h2 className="text-sm font-semibold text-sg-text0 mb-4">Evidence Snapshots</h2>
              <div className="space-y-2">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-sg-bg2"
                  >
                    <div>
                      <span className="text-sm text-sg-text0 font-medium">{snap.period}</span>
                      <span className="text-xs text-sg-text3 ml-2">{snap.framework.toUpperCase()}</span>
                    </div>
                    <span className="text-xs text-sg-text3">
                      {new Date(snap.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : orgId ? (
        <div className="bg-sg-bg1 border border-sg-border rounded-xl p-8 text-center">
          <Shield className="w-8 h-8 text-sg-text3 mx-auto mb-3" />
          <p className="text-sm text-sg-text3">No compliance data available for this organization.</p>
        </div>
      ) : null}
    </div>
  );
}
