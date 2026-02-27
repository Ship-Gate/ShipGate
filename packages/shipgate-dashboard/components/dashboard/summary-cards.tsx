'use client';

import { motion } from 'framer-motion';
import { Counter } from '@/components/shared/counter';
import { mockDashboardData } from '@/lib/mock-data-new';

export default function SummaryCards() {
  const { summary } = mockDashboardData;

  const cards = [
    {
      label: 'VERIFIED REPOS',
      value: summary.verifiedRepos,
      suffix: '',
      subtitle: 'shipping safely',
      color: '#00e68a'
    },
    {
      label: 'TOTAL CLAIMS',
      value: summary.totalClaims,
      suffix: '',
      subtitle: 'across all repos',
      color: '#6366f1'
    },
    {
      label: 'OPEN ISSUES',
      value: summary.openIssues,
      suffix: '',
      subtitle: 'need attention',
      color: '#ff5c6a'
    },
    {
      label: 'SOC 2',
      value: summary.soc2Coverage,
      suffix: '%',
      subtitle: 'compliant',
      color: '#00e68a'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.05 }}
          className="bg-sg-bg1 border border-sg-border rounded-card p-5 relative overflow-hidden"
        >
          {/* Glow effect */}
          <div
            className="absolute -top-12 -right-12 w-20 h-20 rounded-full opacity-12"
            style={{
              background: card.color,
              filter: 'blur(25px)'
            }}
          />
          
          <div className="relative z-10">
            <div className="text-[10px] text-sg-text3 uppercase tracking-wider mb-2">
              {card.label}
            </div>
            <div className="text-[28px] font-bold text-sg-text0 font-mono tracking-tight mb-1">
              <Counter end={card.value} suffix={card.suffix} />
            </div>
            <div className="text-[11px]" style={{ color: card.color }}>
              {card.subtitle}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
