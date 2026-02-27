'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/shared/badge';
import { StatusDot } from '@/components/shared/status-dot';
import { workflowRuns } from '@/lib/mock-data';
import { verdictColor, verdictBg } from '@/lib/verdict-helpers';
import type { WorkflowRun } from '@/lib/types';

export function CicdPanel() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeCount = workflowRuns.filter((r) => r.status === 'running').length;

  return (
    <SectionCard
      title="CI/CD Pipeline"
      subtitle="GitHub Actions"
      extra={
        <div className="flex gap-1.5">
          <Badge text={`${workflowRuns.length} runs`} color="#8888a0" bg="#1a1a24" />
          {activeCount > 0 && (
            <Badge text={`${activeCount} active`} color="#38bdf8" bg="rgba(56,189,248,0.08)" />
          )}
        </div>
      }
    >
      {workflowRuns.map((run) => (
        <RunRow
          key={run.id}
          run={run}
          expanded={expandedId === run.id}
          onToggle={() => setExpandedId(expandedId === run.id ? null : run.id)}
        />
      ))}
    </SectionCard>
  );
}

function RunRow({
  run,
  expanded,
  onToggle,
}: {
  run: WorkflowRun;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-sg-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 py-2.5 px-[18px] cursor-pointer text-left transition-colors hover:bg-[rgba(255,255,255,0.015)]"
        style={{
          background: expanded ? 'rgba(255,255,255,0.015)' : 'transparent',
        }}
      >
        <StatusDot status={run.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-sg-text0 truncate">
              {run.commitMsg}
            </span>
            <span className="text-[10px] text-sg-accent font-mono shrink-0">
              {run.pr}
            </span>
          </div>
          <div className="flex gap-2 text-[10px] text-sg-text3 mt-0.5">
            <span>{run.branch}</span>
            <span>•</span>
            <span>{run.author}</span>
            <span>•</span>
            <span>{run.time}</span>
          </div>
        </div>
        {run.verdict && (
          <Badge
            text={run.verdict}
            color={verdictColor(run.verdict)}
            bg={verdictBg(run.verdict)}
          />
        )}
        {run.score != null && (
          <span className="text-xs font-semibold text-sg-text0 font-mono w-6 text-right">
            {run.score}
          </span>
        )}
        <span className="text-[10px] text-sg-text3 font-mono w-[50px] text-right">
          {run.duration}
        </span>
        <span
          className="text-[10px] text-sg-text3 transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : '' }}
        >
          ▾
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-1 pb-3.5 px-[18px] pl-9">
              {/* Job pipeline */}
              <div className="flex items-center gap-1 flex-wrap mb-2.5">
                {run.jobs.map((job, ji) => (
                  <motion.div
                    key={ji}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: ji * 0.03 }}
                    className="flex items-center gap-1.5"
                  >
                    <div
                      className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-[5px] border border-sg-border"
                      style={{ background: '#1a1a24' }}
                    >
                      <StatusDot status={job.status} size={6} />
                      <span
                        className={`text-[10px] ${
                          job.status === 'pending' ? 'text-sg-text3' : 'text-sg-text1'
                        }`}
                      >
                        {job.name}
                      </span>
                      <span className="text-[9px] text-sg-text3 font-mono">
                        {job.duration}
                      </span>
                    </div>
                    {ji < run.jobs.length - 1 && (
                      <span className="text-[10px] text-sg-text3">→</span>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Blockers */}
              {run.blockers && run.blockers.length > 0 && (
                <div
                  className="py-2 px-3 rounded-[6px] mt-1 border"
                  style={{
                    background: 'rgba(255,92,106,0.08)',
                    borderColor: 'rgba(255,92,106,0.15)',
                  }}
                >
                  <div className="text-[10px] font-semibold text-sg-noship uppercase tracking-wider mb-1">
                    Blockers
                  </div>
                  {run.blockers.map((b, bi) => (
                    <div
                      key={bi}
                      className="text-[11px] text-sg-noship opacity-80 flex gap-1.5 mt-0.5"
                    >
                      <span>✗</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick actions */}
              <div className="flex gap-1.5 mt-2.5">
                <ActionButton>View Logs</ActionButton>
                <ActionButton>View Proof Bundle</ActionButton>
                <ActionButton>Re-run</ActionButton>
                {run.verdict === 'NO_SHIP' && (
                  <button
                    type="button"
                    className="py-1 px-2.5 rounded border text-[10px] font-semibold cursor-pointer transition-opacity hover:opacity-90"
                    style={{
                      borderColor: 'rgba(0,230,138,0.3)',
                      background: 'rgba(0,230,138,0.08)',
                      color: '#00e68a',
                    }}
                  >
                    Auto-fix →
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="py-1 px-2.5 rounded border border-sg-border bg-transparent text-[10px] text-sg-text2 cursor-pointer hover:text-sg-text1 transition-colors"
    >
      {children}
    </button>
  );
}
