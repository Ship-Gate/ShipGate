'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuditStatistics } from '@/hooks/useAuditLog';
import { cn, formatNumber, formatDuration, formatPercentage } from '@/lib/utils';

export default function AnalyticsPage() {
  const { statistics, loading } = useAuditStatistics();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="h-16 border-b flex items-center px-6 bg-background">
        <h1 className="text-xl font-semibold">Analytics</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {loading ? (
            <AnalyticsSkeleton />
          ) : statistics ? (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard
                  label="Total Events"
                  value={formatNumber(statistics.totalEvents)}
                />
                <StatCard
                  label="Average Score"
                  value={Math.round(statistics.averageScore).toString()}
                  color={statistics.averageScore >= 90 ? 'green' : statistics.averageScore >= 70 ? 'yellow' : 'red'}
                />
                <StatCard
                  label="Average Duration"
                  value={formatDuration(statistics.averageDuration)}
                />
                <StatCard
                  label="Success Rate"
                  value={formatPercentage((statistics.byVerdict.verified / statistics.totalEvents) * 100)}
                  color={statistics.byVerdict.verified / statistics.totalEvents >= 0.9 ? 'green' : 'yellow'}
                />
              </div>

              {/* Verdict Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Verdict Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <VerdictBar
                      label="Verified"
                      count={statistics.byVerdict.verified}
                      total={statistics.totalEvents}
                      color="bg-green-500"
                    />
                    <VerdictBar
                      label="Risky"
                      count={statistics.byVerdict.risky}
                      total={statistics.totalEvents}
                      color="bg-yellow-500"
                    />
                    <VerdictBar
                      label="Unsafe"
                      count={statistics.byVerdict.unsafe}
                      total={statistics.totalEvents}
                      color="bg-red-500"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Domain Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Events by Domain</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(statistics.byDomain).map(([domain, count]) => (
                      <div key={domain} className="flex items-center justify-between">
                        <span className="font-medium">{domain}</span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{
                                width: `${(count / statistics.totalEvents) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-16 text-right">
                            {formatNumber(count)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              No analytics data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: 'green' | 'yellow' | 'red';
}) {
  const colorClasses = {
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className={cn('text-3xl font-bold mt-1', color && colorClasses[color])}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function VerdictBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {formatNumber(count)} ({formatPercentage(percentage)})
        </span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-24 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-48" />
    </div>
  );
}
