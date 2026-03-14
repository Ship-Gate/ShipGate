'use client';

import { useEffect, useState } from 'react';
import { useProfile } from '@/hooks/use-data';
import { apiClient } from '@/lib/api-client';
import { motion } from 'framer-motion';

interface ProofBundle {
  id: string;
  kind: string;
  status: string;
  createdAt: string;
  runId: string;
}

interface LatestRun {
  id: string;
  projectName: string;
  verdict: string | null;
  score: number | null;
  proofs: ProofBundle[];
}

export default function ProofPreview() {
  const { data: profile } = useProfile();
  const [run, setRun] = useState<LatestRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.orgs?.length) return;
    const orgId = profile.orgs[0].id;
    apiClient
      .get<{ data: Array<{ id: string; projectName: string }> }>(`/api/v1/runs?orgId=${orgId}&limit=1`)
      .then(async (res) => {
        const runs = (res as unknown as { data: Array<{ id: string; projectName: string }> }).data;
        if (!runs?.length) return;
        const latest = runs[0];
        const detail = await apiClient.get<LatestRun>(`/api/v1/runs/${latest.id}`);
        if (detail.data) setRun(detail.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile]);

  if (loading) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
        <h2 className="text-lg font-semibold text-sg-text0 mb-4 font-sans">Latest Proof Bundle</h2>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-5 bg-sg-bg2 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!run || !run.proofs?.length) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
        <h2 className="text-lg font-semibold text-sg-text0 mb-2 font-sans">Latest Proof Bundle</h2>
        <p className="text-xs text-sg-text3">No proof bundles yet. Run a verification to generate one.</p>
      </div>
    );
  }

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-6 font-mono text-[11px] overflow-hidden">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-sg-text0 mb-2 font-sans">Latest Proof Bundle</h2>
      </div>
      <div className="space-y-1 overflow-hidden">
        <div className="text-sg-text3 opacity-60 break-all">
          # {run.projectName} — {new Date(run.proofs[0].createdAt).toISOString()} — {run.verdict ?? 'Pending'}
        </div>
        {run.proofs.map((proof, i) => {
          const isPass = proof.status === 'uploaded' || proof.status === 'verified';
          return (
            <motion.div
              key={proof.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 * (i + 1) }}
              className="flex items-center gap-2 min-w-0"
            >
              <span className={`flex-shrink-0 ${isPass ? 'text-sg-ship' : 'text-sg-warn'}`}>
                {isPass ? '✓' : '◐'}
              </span>
              <span className="text-sg-text2 flex-1 min-w-0 truncate">{proof.kind}</span>
              <span className={`font-semibold flex-shrink-0 ${isPass ? 'text-sg-ship' : 'text-sg-warn'}`}>
                {proof.status.toUpperCase()}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
