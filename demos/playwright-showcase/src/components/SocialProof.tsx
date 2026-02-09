import { motion } from 'framer-motion';
import { Shield, GitBranch, Zap, Users } from 'lucide-react';

const STATS = [
  { icon: Shield, value: '25+', label: 'Built-in rules' },
  { icon: GitBranch, value: '100%', label: 'Local-first' },
  { icon: Zap, value: '<2s', label: 'Scan time' },
  { icon: Users, value: 'MIT', label: 'Licensed' },
];

export default function SocialProof() {
  return (
    <motion.section
      id="social-proof"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      className="mt-32 max-w-4xl mx-auto px-4 scroll-mt-28"
    >
      <div className="text-center mb-12">
        <p className="text-white/50 text-sm uppercase tracking-widest font-medium mb-3">
          Trusted by builders shipping weekly
        </p>
        <div className="flex items-center justify-center gap-2">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/20" />
          <span className="text-white/30 text-xs">open source</span>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/20" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map(({ icon: Icon, value, label }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.08 * i }}
            className="soft-card p-5 text-center"
          >
            <div className="relative z-10 w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center soft-card__icon-pill">
              <Icon className="w-5 h-5 text-cyan-400" strokeWidth={2} />
            </div>
            <div className="relative z-10 text-2xl font-bold text-white mb-1">{value}</div>
            <div className="relative z-10 text-xs text-white/60 uppercase tracking-wider">{label}</div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
