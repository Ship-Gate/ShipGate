'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { VerdictBadge } from '@/components/VerdictBadge'
import { formatDate, formatDuration } from '@/lib/utils'
import type { VerificationResult } from '@/lib/api'

interface VerificationCardProps {
  verification: VerificationResult
  showDomain?: boolean
}

export function VerificationCard({ verification, showDomain = true }: VerificationCardProps) {
  const behaviorCoverage = (verification.coverage.behaviors / verification.coverage.totalBehaviors) * 100
  
  return (
    <Link href={`/dashboard/verifications/${verification.id}`}>
      <Card className="transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              {showDomain && (
                <CardTitle className="text-lg">{verification.domainName}</CardTitle>
              )}
              <p className="text-sm text-muted-foreground">
                {formatDate(verification.timestamp)}
              </p>
            </div>
            <VerdictBadge verdict={verification.verdict} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{(verification.trustScore * 100).toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Trust Score</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {verification.coverage.behaviors}/{verification.coverage.totalBehaviors}
                </p>
                <p className="text-xs text-muted-foreground">Behaviors</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(verification.duration)}</p>
                <p className="text-xs text-muted-foreground">Duration</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Coverage</span>
                <span className="font-medium">{behaviorCoverage.toFixed(0)}%</span>
              </div>
              <Progress value={behaviorCoverage} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Preconditions</span>
                <span className="font-medium">
                  {verification.coverage.preconditions}/{verification.coverage.totalPreconditions}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Postconditions</span>
                <span className="font-medium">
                  {verification.coverage.postconditions}/{verification.coverage.totalPostconditions}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export function VerificationCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-5 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-40 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="text-center space-y-1">
                <div className="h-8 w-16 mx-auto bg-muted animate-pulse rounded" />
                <div className="h-3 w-12 mx-auto bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
          <div className="h-2 w-full bg-muted animate-pulse rounded-full" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-10 bg-muted animate-pulse rounded" />
            <div className="h-10 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
