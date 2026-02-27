'use client';

import { useOverview } from '@/hooks/use-data';
import { Skeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';

export function SummaryStrip() {
  const { data, isLoading, error, refetch } = useOverview();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-sg-bg1 rounded-lg py-3 px-3.5 border border-sg-border">
            <Skeleton className="h-2 w-16 mb-2" />
            <Skeleton className="h-5 w-12 mb-1" />
            <Skeleton className="h-2 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return null;

  const verdictEntries = Object.entries(data.verdictBreakdown);
  const strips = [
    { label: 'Projects', value: String(data.projectCount), color: '#6366f1', sub: 'tracked' },
    { label: 'Runs', value: String(data.totalRuns), color: '#38bdf8', sub: 'total' },
    { label: 'Findings', value: String(data.totalFindings), color: '#ff5c6a', sub: 'open' },
    { label: 'Ship Rate', value: `${data.shipRate}%`, color: '#00e68a', sub: 'passing' },
    ...verdictEntries.slice(0, 2).map(([verdict, count]) => ({
      label: verdict,
      value: String(count),
      color: verdict === 'SHIP' ? '#00e68a' : verdict === 'NO_SHIP' ? '#ff5c6a' : '#ffb547',
      sub: 'runs',
    })),
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
      {strips.map((s) => (
        <div
          key={s.label}
          className="bg-sg-bg1 rounded-lg py-3 px-3.5 border border-sg-border relative overflow-hidden"
        >
          <div
            className="absolute -top-1.5 -right-1.5 w-9 h-9 rounded-full blur-[18px] opacity-10"
            style={{ background: s.color }}
          />
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[9px] text-sg-text3 uppercase tracking-wider">
              {s.label}
            </span>
          </div>
          <div className="text-xl font-bold text-sg-text0 font-mono tracking-tight">
            {s.value}
          </div>
          <div className="text-[9px] mt-0.5" style={{ color: s.color }}>
            {s.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
