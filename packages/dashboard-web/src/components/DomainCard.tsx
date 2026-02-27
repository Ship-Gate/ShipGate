'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { VerdictBadge, VerdictDot } from '@/components/VerdictBadge'
import { formatDate, formatPercentage } from '@/lib/utils'
import type { Domain } from '@/lib/api'

interface DomainCardProps {
  domain: Domain
}

export function DomainCard({ domain }: DomainCardProps) {
  const statusToVerdict = {
    verified: 'pass',
    failing: 'fail',
    pending: 'pending',
    unknown: 'unknown',
  } as const

  return (
    <Link href={`/dashboard/domains/${domain.id}`}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <VerdictDot verdict={statusToVerdict[domain.status]} />
                {domain.name}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {domain.description}
              </CardDescription>
            </div>
            <VerdictBadge verdict={statusToVerdict[domain.status]} size="sm" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Behaviors</span>
              <span className="font-medium">{domain.behaviorCount}</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trust Score</span>
                <span className="font-medium">{formatPercentage(domain.trustScore)}</span>
              </div>
              <Progress value={domain.trustScore * 100} className="h-2" />
            </div>

            {domain.lastVerified && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Verified</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(domain.lastVerified)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
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
