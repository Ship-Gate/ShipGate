'use client';

import { motion } from 'framer-motion';

export default function ProofPreview() {
  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-6 font-mono text-[11px] overflow-hidden">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-sg-text0 mb-2 font-sans">Latest Proof Bundle</h2>
      </div>

      <div className="space-y-1 overflow-hidden">
        <div className="text-sg-text3 opacity-60 break-all">
          # acme-api — 2026-02-14T10:30:00Z — Signed
        </div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 min-w-0"
        >
          <span className="text-sg-ship flex-shrink-0">✓</span>
          <span className="text-sg-text2 flex-1 min-w-0 truncate">Import Integrity</span>
          <span className="text-sg-text3 flex-shrink-0 hidden sm:inline">....................................</span>
          <span className="text-sg-ship font-semibold flex-shrink-0">PROVEN</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 min-w-0"
        >
          <span className="text-sg-ship flex-shrink-0">✓</span>
          <span className="text-sg-text2 flex-1 min-w-0 truncate">Auth Coverage</span>
          <span className="text-sg-text3 flex-shrink-0 hidden sm:inline">......................................</span>
          <span className="text-sg-ship font-semibold flex-shrink-0">PROVEN</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2 min-w-0"
        >
          <span className="text-sg-warn flex-shrink-0">◐</span>
          <span className="text-sg-text2 flex-1 min-w-0 truncate">Input Validation</span>
          <span className="text-sg-text3 flex-shrink-0 hidden sm:inline">....................................</span>
          <span className="text-sg-warn font-semibold flex-shrink-0">78%</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-2 min-w-0"
        >
          <span className="text-sg-ship flex-shrink-0">✓</span>
          <span className="text-sg-text2 flex-1 min-w-0 truncate">SQL Injection</span>
          <span className="text-sg-text3 flex-shrink-0 hidden sm:inline">.........................................</span>
          <span className="text-sg-ship font-semibold flex-shrink-0">98%</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2 min-w-0"
        >
          <span className="text-sg-ship flex-shrink-0">✓</span>
          <span className="text-sg-text2 flex-1 min-w-0 truncate">Secret Exposure</span>
          <span className="text-sg-text3 flex-shrink-0 hidden sm:inline">......................................</span>
          <span className="text-sg-ship font-semibold flex-shrink-0">PROVEN</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="border-t border-sg-border pt-2 mt-2"
        >
          <div className="text-sg-text3 text-[10px] opacity-60">
            <div>HMAC-SHA256:</div>
            <div className="break-all font-mono">
              7a9f2e1c3b8d5f6a9e2c4b7d1e3f8a9c<br/>
              2b5d6e1f4a7c9b2e5d8f1a3c6b9e2d5f8
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
