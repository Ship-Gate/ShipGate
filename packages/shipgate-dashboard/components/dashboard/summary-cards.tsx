'use client';

import { useOverview } from '@/hooks/use-data';
import { CardSkeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';

const CARDS = [
  { key: 'projectCount' as const, label: 'VERIFIED PROJECTS', suffix: '', subtitle: 'shipping safely', color: '#00e68a' },
  { key: 'totalRuns' as const, label: 'TOTAL RUNS', suffix: '', subtitle: 'across all projects', color: '#6366f1' },
  { key: 'totalFindings' as const, label: 'OPEN FINDINGS', suffix: '', subtitle: 'need attention', color: '#ff5c6a' },
  { key: 'shipRate' as const, label: 'SHIP RATE', suffix: '%', subtitle: 'compliant', color: '#00e68a' },
] as const;

export default function SummaryCards() {
  const { data, isLoading, error, refetch } = useOverview();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {CARDS.map((card) => (
        <div
          key={card.label}
          className="bg-sg-bg1 border border-sg-border rounded-card p-5 relative overflow-hidden"
        >
          <div
            className="absolute -top-12 -right-12 w-20 h-20 rounded-full opacity-12"
            style={{ background: card.color, filter: 'blur(25px)' }}
          />
          <div className="relative z-10">
            <div className="text-[10px] text-sg-text3 uppercase tracking-wider mb-2">
              {card.label}
            </div>
            <div className="text-[28px] font-bold text-sg-text0 font-mono tracking-tight mb-1">
              {data[card.key]}
              {card.suffix}
            </div>
            <div className="text-[11px]" style={{ color: card.color }}>
              {card.subtitle}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
