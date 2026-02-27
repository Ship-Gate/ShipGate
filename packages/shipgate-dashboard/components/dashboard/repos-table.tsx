'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkline } from '@/components/shared/sparkline';
import { VerdictBadge } from '@/components/shared/verdict-badge';
import { mockRepos } from '@/lib/mock-data-new';
import type { Repo } from '@/types';

export default function ReposTable() {
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-sg-text0">Repositories</h2>
        <button className="text-sm text-sg-ship hover:text-sg-ship/80 transition-colors">
          + Add repo
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-sg-border">
              <th className="text-left pb-3">
                <span className="text-[10px] text-sg-text3 uppercase tracking-wider">Repository</span>
              </th>
              <th className="text-left pb-3">
                <span className="text-[10px] text-sg-text3 uppercase tracking-wider">Verdict</span>
              </th>
              <th className="text-left pb-3">
                <span className="text-[10px] text-sg-text3 uppercase tracking-wider">Score</span>
              </th>
              <th className="text-left pb-3">
                <span className="text-[10px] text-sg-text3 uppercase tracking-wider">Issues</span>
              </th>
              <th className="text-left pb-3">
                <span className="text-[10px] text-sg-text3 uppercase tracking-wider">Trend</span>
              </th>
              <th className="text-left pb-3">
                <span className="text-[10px] text-sg-text3 uppercase tracking-wider">Scanned</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {mockRepos.map((repo, index) => (
              <motion.tr
                key={repo.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: index * 0.02 }}
                className={`border-b border-sg-border/50 cursor-pointer transition-all ${
                  selectedRepo === repo.id 
                    ? 'bg-sg-ship/5 border-l-2 border-l-sg-ship' 
                    : 'hover:bg-sg-bg2'
                }`}
                onClick={() => setSelectedRepo(repo.id === selectedRepo ? null : repo.id)}
              >
                <td className="py-3">
                  <div className="text-[13px] text-sg-text0 font-medium">
                    {repo.name}
                  </div>
                </td>
                <td className="py-3">
                  <VerdictBadge verdict={repo.verdict} size="sm" />
                </td>
                <td className="py-3">
                  <div className="text-[13px] font-mono font-semibold text-sg-text0">
                    {repo.score}
                  </div>
                </td>
                <td className="py-3">
                  <div 
                    className={`text-[13px] font-mono ${
                      repo.issues > 10 ? 'text-sg-noship' : 
                      repo.issues > 5 ? 'text-sg-warn' : 
                      'text-sg-text2'
                    }`}
                  >
                    {repo.issues}
                  </div>
                </td>
                <td className="py-3">
                  <Sparkline 
                    data={repo.trend} 
                    color={
                      repo.verdict === 'SHIP' ? '#00e68a' :
                      repo.verdict === 'WARN' ? '#ffb547' :
                      '#ff5c6a'
                    }
                    width={60}
                    height={16}
                  />
                </td>
                <td className="py-3">
                  <div className="text-[11px] text-sg-text3">
                    {repo.lastScan}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
