'use client';

import { motion } from 'framer-motion';
import { VerdictBadge } from '@/components/shared/verdict-badge';
import { mockRecentScans } from '@/lib/mock-data-new';

export default function RecentScans() {
  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
      <h2 className="text-lg font-semibold text-sg-text0 mb-4">Recent Scans</h2>
      
      <div className="space-y-3">
        {mockRecentScans.map((scan, index) => (
          <motion.div
            key={scan.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-lg bg-sg-bg2/50 border border-sg-border/50"
          >
            <VerdictBadge verdict={scan.verdict} size="sm" />
            
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-sg-text0 font-medium">
                {scan.repo}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-sg-text3">
                <span className="text-sg-accent font-mono">
                  #{scan.pr}
                </span>
                <span className="font-mono opacity-60">
                  {scan.commit.slice(0, 7)}
                </span>
                <span>•</span>
                <span>{scan.author}</span>
              </div>
            </div>
            
            <div className="text-[11px] text-sg-text3 text-right">
              {scan.time}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
