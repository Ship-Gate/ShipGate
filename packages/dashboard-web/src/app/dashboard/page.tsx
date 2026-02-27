'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DomainCard, DomainCardSkeleton } from '@/components/DomainCard'
import { VerificationCard, VerificationCardSkeleton } from '@/components/VerificationCard'
import { TrustScoreChart, DomainStatusChart } from '@/components/CoverageChart'
import { useDashboardStats, useDomains } from '@/hooks/useApi'
import { Shield, CheckCircle, XCircle, Activity, Clock, Target } from 'lucide-react'
export default function DashboardPage() {
  const { data: stats, loading: statsLoading } = useDashboardStats()
  const { data: domains, loading: domainsLoading } = useDomains()

  return (
    <div className="container py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of verification status across all domains
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Domains"
          value={stats?.totalDomains ?? '-'}
          icon={<Shield className="h-4 w-4 text-muted-foreground" />}
          loading={statsLoading}
        />
        <StatsCard
          title="Total Behaviors"
          value={stats?.totalBehaviors ?? '-'}
          icon={<Target className="h-4 w-4 text-muted-foreground" />}
          loading={statsLoading}
        />
        <StatsCard
          title="Verifications"
          value={stats?.totalVerifications ?? '-'}
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          loading={statsLoading}
        />
        <StatsCard
          title="Avg Trust Score"
          value={stats ? `${(stats.averageTrustScore * 100).toFixed(0)}%` : '-'}
          icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
          loading={statsLoading}
          highlight
        />
      </div>

      {/* Status Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatusSummaryCard
          title="Passing"
          count={stats?.passingDomains ?? 0}
          total={stats?.totalDomains ?? 0}
          variant="success"
          icon={<CheckCircle className="h-5 w-5" />}
          loading={statsLoading}
        />
        <StatusSummaryCard
          title="Failing"
          count={stats?.failingDomains ?? 0}
          total={stats?.totalDomains ?? 0}
          variant="destructive"
          icon={<XCircle className="h-5 w-5" />}
          loading={statsLoading}
        />
        <StatusSummaryCard
          title="Pending"
          count={(stats?.totalDomains ?? 0) - (stats?.passingDomains ?? 0) - (stats?.failingDomains ?? 0)}
          total={stats?.totalDomains ?? 0}
          variant="warning"
          icon={<Clock className="h-5 w-5" />}
          loading={statsLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {stats && <TrustScoreChart data={stats.trustScoreHistory} />}
        {stats && (
          <DomainStatusChart
            passing={stats.passingDomains}
            failing={stats.failingDomains}
            pending={stats.totalDomains - stats.passingDomains - stats.failingDomains}
          />
        )}
      </div>

      {/* Domains Grid */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Domains</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {domainsLoading
            ? [...Array(6)].map((_, i) => <DomainCardSkeleton key={i} />)
            : domains?.map(domain => (
                <DomainCard key={domain.id} domain={domain} />
              ))
          }
        </div>
      </div>

      {/* Recent Verifications */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Recent Verifications</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {statsLoading
            ? [...Array(3)].map((_, i) => <VerificationCardSkeleton key={i} />)
            : stats?.recentVerifications.slice(0, 3).map(verification => (
                <VerificationCard key={verification.id} verification={verification} />
              ))
          }
        </div>
      </div>
    </div>
  )
}

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  loading?: boolean
  highlight?: boolean
}

function StatsCard({ title, value, icon, loading, highlight }: StatsCardProps) {
  return (
    <Card className={highlight ? 'border-primary' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-20 bg-muted animate-pulse rounded" />
        ) : (
          <div className={`text-2xl font-bold ${highlight ? 'text-primary' : ''}`}>
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface StatusSummaryCardProps {
  title: string
  count: number
  total: number
  variant: 'success' | 'destructive' | 'warning'
  icon: React.ReactNode
  loading?: boolean
}

function StatusSummaryCard({ title, count, total, variant, icon, loading }: StatusSummaryCardProps) {
  const percentage = total > 0 ? ((count / total) * 100).toFixed(0) : 0

  const variantClasses = {
    success: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/50 dark:border-green-800',
    destructive: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-800',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/50 dark:border-yellow-800',
  }

  return (
    <Card className={variantClasses[variant]}>
      <CardContent className="pt-6">
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-20 bg-muted/30 animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted/30 animate-pulse rounded" />
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-full bg-white/50 dark:bg-white/10">
              {icon}
            </div>
            <div>
              <div className="text-3xl font-bold">{count}</div>
              <p className="text-sm opacity-80">
                {title} ({percentage}% of {total})
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
