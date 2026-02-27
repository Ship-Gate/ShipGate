'use client';

import { motion } from 'framer-motion';
import { mockProvenance } from '@/lib/mock-data-new';

export default function ProvenancePanel() {
  const total = mockProvenance.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
      <h2 className="text-lg font-semibold text-sg-text0 mb-4">AI Provenance</h2>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {mockProvenance.map((tool, index) => (
          <motion.div
            key={tool.tool}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="text-center"
          >
            <div 
              className="text-[16px] font-mono font-bold"
              style={{ color: tool.color }}
            >
              {tool.count}%
            </div>
            <div className="text-[9px] text-sg-text3 mt-1">
              {tool.tool}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="relative h-6 bg-sg-bg2 rounded-full overflow-hidden">
        <div className="absolute inset-0 flex">
          {mockProvenance.map((tool, index) => {
            const width = (tool.count / total) * 100;
            const leftOffset = mockProvenance
              .slice(0, index)
              .reduce((sum, p) => sum + (p.count / total) * 100, 0);
            
            return (
              <motion.div
                key={tool.tool}
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="h-full relative"
                style={{
                  backgroundColor: tool.color,
                  left: `${leftOffset}%`
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
