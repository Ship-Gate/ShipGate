'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VerificationCard, VerificationCardSkeleton } from '@/components/shared/VerificationCard';
import { Shield, CheckCircle, XCircle, Activity, Clock, Target } from 'lucide-react';

// Mock data for verifications
const mockVerifications = [
  {
    id: '1',
    domainName: 'acme-api',
    status: 'passing' as const,
    trustScore: 0.95,
    timestamp: '2024-02-14T10:30:00Z',
    duration: 2340,
    violations: 0,
    warnings: 2
  },
  {
    id: '2',
    domainName: 'user-service',
    status: 'failing' as const,
    trustScore: 0.67,
    timestamp: '2024-02-14T09:15:00Z',
    duration: 3120,
    violations: 3,
    warnings: 1
  },
  {
    id: '3',
    domainName: 'payment-gateway',
    status: 'passing' as const,
    trustScore: 0.91,
    timestamp: '2024-02-14T11:45:00Z',
    duration: 1890,
    violations: 0,
    warnings: 1
  },
  {
    id: '4',
    domainName: 'notification-service',
    status: 'pending' as const,
    trustScore: 0.78,
    timestamp: '2024-02-14T08:30:00Z',
    duration: 1560,
    violations: 0,
    warnings: 3
  },
  {
    id: '5',
    domainName: 'analytics-engine',
    status: 'passing' as const,
    trustScore: 0.88,
    timestamp: '2024-02-14T07:20:00Z',
    duration: 2670,
    violations: 0,
    warnings: 2
  },
  {
    id: '6',
    domainName: 'file-storage',
    status: 'failing' as const,
    trustScore: 0.45,
    timestamp: '2024-02-14T06:45:00Z',
    duration: 4230,
    violations: 5,
    warnings: 2
  }
];

export default function VerificationsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-sg-text0">Verifications</h1>
        <p className="text-sg-text2">
          Recent verification runs and their results
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Verifications"
          value={mockVerifications.length}
          icon={<Shield className="h-4 w-4 text-sg-text3" />}
        />
        <StatsCard
          title="Passing"
          value={mockVerifications.filter(v => v.status === 'passing').length}
          icon={<CheckCircle className="h-4 w-4 text-sg-ship" />}
        />
        <StatsCard
          title="Failing"
          value={mockVerifications.filter(v => v.status === 'failing').length}
          icon={<XCircle className="h-4 w-4 text-sg-noship" />}
        />
        <StatsCard
          title="Avg Duration"
          value={`${Math.round(mockVerifications.reduce((sum, v) => sum + v.duration, 0) / mockVerifications.length / 1000)}s`}
          icon={<Clock className="h-4 w-4 text-sg-text3" />}
        />
      </div>

      {/* Status Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatusSummaryCard
          title="Passing"
          count={mockVerifications.filter(v => v.status === 'passing').length}
          total={mockVerifications.length}
          variant="success"
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <StatusSummaryCard
          title="Failing"
          count={mockVerifications.filter(v => v.status === 'failing').length}
          total={mockVerifications.length}
          variant="destructive"
          icon={<XCircle className="h-5 w-5" />}
        />
        <StatusSummaryCard
          title="Pending"
          count={mockVerifications.filter(v => v.status === 'pending').length}
          total={mockVerifications.length}
          variant="warning"
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Recent Verifications */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4 text-sg-text0">Recent Verifications</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockVerifications.map(verification => (
            <VerificationCard key={verification.id} verification={verification} />
          ))}
        </div>
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
