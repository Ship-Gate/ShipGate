'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { VerdictBadge } from '@/components/shared/VerdictBadge'
import { formatDate, formatDuration, formatPercentage } from '@/lib/utils'
import type { VerificationResult } from '@/lib/api'

interface VerificationCardProps {
  verification: VerificationResult
  showDomain?: boolean
}

export function VerificationCard({ verification, showDomain = true }: VerificationCardProps) {
  if (!verification || !verification.coverage) {
    return (
      <Card className="bg-sg-bg1 border-sg-border">
        <CardContent className="p-4">
          <div className="text-sg-text3">Loading verification data...</div>
        </CardContent>
      </Card>
    );
  }
  
  const behaviorCoverage = (verification.coverage.behaviors / verification.coverage.totalBehaviors) * 100
  
  return (
    <Link href={`/dashboard/verifications/${verification.id}`}>
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-6 transition-all hover:shadow-md hover:border-sg-ship/50 cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            {showDomain && (
              <div className="text-lg font-semibold text-sg-text0">{verification.domainName}</div>
            )}
            <div className="flex items-center gap-2 text-sm text-sg-text3">
              <span>{formatDate(verification.timestamp)}</span>
              <span>•</span>
              <span>{formatDuration(verification.duration)}</span>
            </div>
          </div>
          <VerdictBadge verdict={verification.verdict} size="sm" />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-sg-text2">Behavior Coverage</span>
              <span className="font-medium text-sg-text0">{behaviorCoverage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-sg-bg3 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  behaviorCoverage >= 80 ? 'bg-sg-ship' :
                  behaviorCoverage >= 60 ? 'bg-sg-warn' : 'bg-sg-noship'
                }`}
                style={{ width: `${behaviorCoverage}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-sg-text2">Trust Score</span>
            <span className="font-medium text-sg-text0">{formatPercentage(verification.trustScore)}</span>
          </div>
        </div>
      </div>
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
