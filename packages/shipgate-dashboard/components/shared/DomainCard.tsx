'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { VerdictBadge, VerdictDot } from '@/components/shared/VerdictBadge'
import { formatDate, formatPercentage } from '@/lib/utils'
import type { Domain } from '@/lib/api'

interface DomainCardProps {
  domain: Domain
}

export function DomainCard({ domain }: DomainCardProps) {
  if (!domain) {
    return (
      <Card className="bg-sg-bg1 border-sg-border">
        <CardContent className="p-4">
          <div className="text-sg-text3">Loading domain data...</div>
        </CardContent>
      </Card>
    );
  }

  const statusToVerdict = {
    verified: 'pass',
    failing: 'fail',
    pending: 'partial',
    unknown: 'error'
  } as const

  return (
    <Link href={`/dashboard/domains/${domain.id}`}>
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-6 transition-all hover:shadow-md hover:border-sg-ship/50 cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            <div className="text-lg font-semibold text-sg-text0 flex items-center gap-2">
              <VerdictDot verdict={statusToVerdict[domain.status]} />
              {domain.name}
            </div>
            <div className="text-sm text-sg-text2 line-clamp-2">
              {domain.description}
            </div>
          </div>
          <VerdictBadge verdict={statusToVerdict[domain.status]} size="sm" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-sg-text2">Behaviors</span>
            <span className="font-medium text-sg-text0">{domain.behaviorCount}</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-sg-text2">Trust Score</span>
              <span className="font-medium text-sg-text0">{formatPercentage(domain.trustScore)}</span>
            </div>
            <div className="w-full bg-sg-bg3 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  domain.trustScore >= 0.8 ? 'bg-sg-ship' :
                  domain.trustScore >= 0.6 ? 'bg-sg-warn' : 'bg-sg-noship'
                }`}
                style={{ width: `${domain.trustScore * 100}%` }}
              />
            </div>
          </div>

          {domain.lastVerified && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-sg-text2">Last Verified</span>
              <span className="text-xs text-sg-text3">
                {formatDate(domain.lastVerified)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export function DomainCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-48 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            <div className="h-4 w-8 bg-muted animate-pulse rounded" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-4 w-12 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-2 w-full bg-muted animate-pulse rounded-full" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
