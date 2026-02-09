import { motion } from 'framer-motion';
import { FileCheck, AlertTriangle } from 'lucide-react';
import { ISL_SPEC_EXAMPLE, VIOLATION_EXAMPLE } from '../data/terminal-content';

export default function SolutionSection() {
  return (
    <motion.section
      id="solution"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5 }}
      className="relative mt-32 max-w-6xl mx-auto px-4 scroll-mt-28"
    >
      <h2 className="section-heading mx-auto mb-4 text-center">
        The Solution
      </h2>
      <p className="text-white/80 text-center mb-6 max-w-2xl mx-auto text-lg">
        ISL behavioral specs + Shipgate verification
      </p>
      <p className="text-cyan-400 text-center mb-16 max-w-2xl mx-auto text-xl font-semibold tracking-wide">
        Define intent. Verify reality.
      </p>

      {/* Side-by-side: ISL spec + violation */}
      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* Left: ISL Spec */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          <div className="rounded-2xl border border-emerald-500/30 bg-black/60 backdrop-blur-sm overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex items-center gap-2 ml-3">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-white/60 font-mono">transfer.isl</span>
              </div>
            </div>
            {/* Code content */}
            <pre className="p-5 text-sm font-mono leading-relaxed overflow-x-auto">
              <code>
                {ISL_SPEC_EXAMPLE.split('\n').map((line, i) => (
                  <span key={i} className="block">
                    <span className={getISLLineColor(line)}>{line}</span>
                  </span>
                ))}
              </code>
            </pre>
          </div>
          <div className="mt-3 text-center">
            <span className="text-xs font-medium text-emerald-400/80 uppercase tracking-wider">
              What your code should do
            </span>
          </div>
        </motion.div>

        {/* Right: Violation detected */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative"
        >
          <div className="rounded-2xl border border-red-500/30 bg-black/60 backdrop-blur-sm overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex items-center gap-2 ml-3">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-white/60 font-mono">shipgate verify</span>
              </div>
            </div>
            {/* Violation content */}
            <pre className="p-5 text-sm font-mono leading-relaxed overflow-x-auto">
              <code>
                {VIOLATION_EXAMPLE.split('\n').map((line, i) => (
                  <span key={i} className="block">
                    <span className={getViolationLineColor(line)}>{line}</span>
                  </span>
                ))}
              </code>
            </pre>
          </div>
          <div className="mt-3 text-center">
            <span className="text-xs font-medium text-red-400/80 uppercase tracking-wider">
              Violation detected
            </span>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

function getISLLineColor(line: string): string {
  if (line.startsWith('intent')) return 'text-cyan-400 font-semibold';
  if (line.includes('precondition:')) return 'text-emerald-400';
  if (line.includes('postcondition:')) return 'text-blue-400';
  if (line.includes('invariant:')) return 'text-purple-400';
  if (line.includes('}')) return 'text-cyan-400';
  return 'text-white/80';
}

function getViolationLineColor(line: string): string {
  if (line.startsWith('✗')) return 'text-red-400 font-semibold';
  if (line.includes('sender.balance')) return 'text-yellow-300';
  if (line.includes('src/')) return 'text-white/60';
  if (line.startsWith('  →')) return 'text-red-300';
  if (line.includes('NO_SHIP')) return 'text-red-500 font-bold';
  return 'text-white/70';
}
