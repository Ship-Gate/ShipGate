'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DomainCard, DomainCardSkeleton } from '@/components/shared/DomainCard';
import { Shield, CheckCircle, XCircle, Activity, Clock, Target } from 'lucide-react';

// Mock data for domains
const mockDomains = [
  {
    id: '1',
    name: 'acme-api',
    status: 'passing' as const,
    trustScore: 0.95,
    behaviors: 12,
    lastVerification: '2024-02-14T10:30:00Z',
    description: 'Main API domain for ACME platform'
  },
  {
    id: '2',
    name: 'user-service',
    status: 'failing' as const,
    trustScore: 0.67,
    behaviors: 8,
    lastVerification: '2024-02-14T09:15:00Z',
    description: 'User authentication and management'
  },
  {
    id: '3',
    name: 'payment-gateway',
    status: 'passing' as const,
    trustScore: 0.91,
    behaviors: 15,
    lastVerification: '2024-02-14T11:45:00Z',
    description: 'Payment processing and transactions'
  },
  {
    id: '4',
    name: 'notification-service',
    status: 'pending' as const,
    trustScore: 0.78,
    behaviors: 6,
    lastVerification: '2024-02-14T08:30:00Z',
    description: 'Email and SMS notifications'
  }
];

export default function DomainsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-sg-text0">Domains</h1>
        <p className="text-sg-text2">
          Overview of verification status across all domains
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Domains"
          value={mockDomains.length}
          icon={<Shield className="h-4 w-4 text-sg-text3" />}
        />
        <StatsCard
          title="Total Behaviors"
          value={mockDomains.reduce((sum, d) => sum + d.behaviors, 0)}
          icon={<Target className="h-4 w-4 text-sg-text3" />}
        />
        <StatsCard
          title="Passing"
          value={mockDomains.filter(d => d.status === 'passing').length}
          icon={<CheckCircle className="h-4 w-4 text-sg-ship" />}
        />
        <StatsCard
          title="Avg Trust Score"
          value={`${(mockDomains.reduce((sum, d) => sum + d.trustScore, 0) / mockDomains.length * 100).toFixed(0)}%`}
          icon={<Activity className="h-4 w-4 text-sg-text3" />}
        />
      </div>

      {/* Status Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatusSummaryCard
          title="Passing"
          count={mockDomains.filter(d => d.status === 'passing').length}
          total={mockDomains.length}
          variant="success"
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <StatusSummaryCard
          title="Failing"
          count={mockDomains.filter(d => d.status === 'failing').length}
          total={mockDomains.length}
          variant="destructive"
          icon={<XCircle className="h-5 w-5" />}
        />
        <StatusSummaryCard
          title="Pending"
          count={mockDomains.filter(d => d.status === 'pending').length}
          total={mockDomains.length}
          variant="warning"
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Domains Grid */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4 text-sg-text0">All Domains</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockDomains.map(domain => (
            <DomainCard key={domain.id} domain={domain} />
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
