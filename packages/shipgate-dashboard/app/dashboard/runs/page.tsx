'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, CheckCircle, XCircle, Activity, Clock, Target, Play, FileText } from 'lucide-react';

// Mock data for runs
const mockRuns = [
  {
    id: '1',
    domainName: 'acme-api',
    status: 'completed' as const,
    verdict: 'passing' as const,
    trustScore: 0.95,
    timestamp: '2024-02-14T10:30:00Z',
    duration: 2340,
    behaviors: 12,
    violations: 0
  },
  {
    id: '2',
    domainName: 'user-service',
    status: 'completed' as const,
    verdict: 'failing' as const,
    trustScore: 0.67,
    timestamp: '2024-02-14T09:15:00Z',
    duration: 3120,
    behaviors: 8,
    violations: 3
  },
  {
    id: '3',
    domainName: 'payment-gateway',
    status: 'running' as const,
    verdict: 'pending' as const,
    trustScore: 0,
    timestamp: '2024-02-14T11:45:00Z',
    duration: 0,
    behaviors: 15,
    violations: 0
  },
  {
    id: '4',
    domainName: 'notification-service',
    status: 'completed' as const,
    verdict: 'passing' as const,
    trustScore: 0.78,
    timestamp: '2024-02-14T08:30:00Z',
    duration: 1560,
    behaviors: 6,
    violations: 0
  },
  {
    id: '5',
    domainName: 'analytics-engine',
    status: 'failed' as const,
    verdict: 'error' as const,
    trustScore: 0,
    timestamp: '2024-02-14T07:20:00Z',
    duration: 2670,
    behaviors: 10,
    violations: 0
  },
  {
    id: '6',
    domainName: 'file-storage',
    status: 'completed' as const,
    verdict: 'failing' as const,
    trustScore: 0.45,
    timestamp: '2024-02-14T06:45:00Z',
    duration: 4230,
    behaviors: 7,
    violations: 5
  }
];

export default function RunsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-sg-text0">Runs</h1>
        <p className="text-sg-text2">
          Verification run history and status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Runs"
          value={mockRuns.length}
          icon={<Play className="h-4 w-4 text-sg-text3" />}
        />
        <StatsCard
          title="Running"
          value={mockRuns.filter(r => r.status === 'running').length}
          icon={<Activity className="h-4 w-4 text-sg-warn" />}
        />
        <StatsCard
          title="Completed"
          value={mockRuns.filter(r => r.status === 'completed').length}
          icon={<CheckCircle className="h-4 w-4 text-sg-ship" />}
        />
        <StatsCard
          title="Failed"
          value={mockRuns.filter(r => r.status === 'failed').length}
          icon={<XCircle className="h-4 w-4 text-sg-noship" />}
        />
      </div>

      {/* Status Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatusSummaryCard
          title="Passing"
          count={mockRuns.filter(r => r.verdict === 'passing').length}
          total={mockRuns.filter(r => r.status === 'completed').length}
          variant="success"
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <StatusSummaryCard
          title="Failing"
          count={mockRuns.filter(r => r.verdict === 'failing').length}
          total={mockRuns.filter(r => r.status === 'completed').length}
          variant="destructive"
          icon={<XCircle className="h-5 w-5" />}
        />
        <StatusSummaryCard
          title="Running"
          count={mockRuns.filter(r => r.status === 'running').length}
          total={mockRuns.length}
          variant="warning"
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Runs Table */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4 text-sg-text0">Run History</h2>
        <Card className="bg-sg-bg1 border-sg-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-sg-border">
                    <th className="text-left p-4 font-medium text-sg-text2">Domain</th>
                    <th className="text-left p-4 font-medium text-sg-text2">Status</th>
                    <th className="text-left p-4 font-medium text-sg-text2">Verdict</th>
                    <th className="text-left p-4 font-medium text-sg-text2">Trust Score</th>
                    <th className="text-left p-4 font-medium text-sg-text2">Duration</th>
                    <th className="text-left p-4 font-medium text-sg-text2">Behaviors</th>
                    <th className="text-left p-4 font-medium text-sg-text2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {mockRuns.map((run) => (
                    <tr key={run.id} className="border-b border-sg-border hover:bg-sg-bg2/50">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-sg-text3" />
                          <span className="font-medium text-sg-text0">{run.domainName}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="p-4">
                        <VerdictBadge verdict={run.verdict} />
                      </td>
                      <td className="p-4">
                        {run.trustScore > 0 ? (
                          <span className="font-medium text-sg-text0">
                            {(run.trustScore * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-sg-text3">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {run.duration > 0 ? (
                          <span className="text-sg-text1">
                            {(run.duration / 1000).toFixed(1)}s
                          </span>
                        ) : (
                          <span className="text-sg-text3">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-sg-text1">{run.behaviors}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sg-text3 text-sm">
                          {new Date(run.timestamp).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
}

function StatsCard({ title, value, icon }: StatsCardProps) {
  return (
    <Card className="bg-sg-bg1 border-sg-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-sg-text2">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-sg-text0">{value}</div>
      </CardContent>
    </Card>
  );
}

interface StatusSummaryCardProps {
  title: string
  count: number
  total: number
  variant: 'success' | 'destructive' | 'warning'
  icon: React.ReactNode
}

function StatusSummaryCard({ title, count, total, variant, icon }: StatusSummaryCardProps) {
  const percentage = total > 0 ? ((count / total) * 100).toFixed(0) : 0

  const variantClasses = {
    success: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/50 dark:border-green-800',
    destructive: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-800',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/50 dark:border-yellow-800',
  }

  return (
    <Card className={`${variantClasses[variant]} bg-sg-bg1 border-sg-border`}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-full bg-white/10">
            {icon}
          </div>
          <div>
            <div className="text-3xl font-bold">{count}</div>
            <p className="text-sm opacity-80">
              {title} ({percentage}% of {total})
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    running: { color: 'text-yellow-600 bg-yellow-50', label: 'Running' },
    completed: { color: 'text-green-600 bg-green-50', label: 'Completed' },
    failed: { color: 'text-red-600 bg-red-50', label: 'Failed' }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.failed;

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const verdictConfig = {
    passing: { color: 'text-green-600 bg-green-50', label: 'Passing' },
    failing: { color: 'text-red-600 bg-red-50', label: 'Failing' },
    pending: { color: 'text-yellow-600 bg-yellow-50', label: 'Pending' },
    error: { color: 'text-red-600 bg-red-50', label: 'Error' }
  };

  const config = verdictConfig[verdict as keyof typeof verdictConfig] || verdictConfig.error;

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}
