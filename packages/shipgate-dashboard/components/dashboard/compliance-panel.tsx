'use client';

import { motion } from 'framer-motion';
import { mockCompliance } from '@/lib/mock-data-new';

export default function CompliancePanel() {
  const soc2Coverage = Math.round(
    (mockCompliance.reduce((sum, c) => sum + c.satisfied, 0) / 
    mockCompliance.reduce((sum, c) => sum + c.repos, 0)) * 100
  );

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-sg-text0">SOC 2 Controls</h2>
        <div className="text-sm text-sg-ship font-semibold">
          {soc2Coverage}% covered
        </div>
      </div>

      <div className="space-y-3">
        {mockCompliance.map((control, index) => (
          <motion.div
            key={control.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex items-center gap-4 p-3 rounded-lg bg-sg-bg2/30 border border-sg-border/50"
          >
            <div className="font-mono text-sg-accent text-[12px] font-semibold min-w-[42px]">
              {control.id}
            </div>
            
            <div className="flex-1">
              <div className="text-[12px] text-sg-text2">
                {control.name}
              </div>
            </div>

            <div className="flex gap-1">
              {Array.from({ length: control.repos }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: i < control.satisfied ? '#00e68a' :
                                   i < control.satisfied + control.partial ? '#ffb547' :
                                   '#222233'
                  }}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
