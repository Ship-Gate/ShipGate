'use client'

import { use } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VerdictBadge } from '@/components/VerdictBadge'
import { CoverageBreakdown } from '@/components/CoverageChart'
import { Timeline } from '@/components/Timeline'
import { useVerification } from '@/hooks/useApi'
import { formatDate, formatDuration, formatPercentage } from '@/lib/utils'
import { ArrowLeft, Shield, Target, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function VerificationDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const { data: verification, loading } = useVerification(id)

  if (loading) {
    return <VerificationDetailSkeleton />
  }

  if (!verification) {
    return (
      <div className="container py-6">
        <p>Verification not found</p>
      </div>
    )
  }

  const passedTests = verification.results.filter(r => r.verdict === 'pass').length
  const failedTests = verification.results.filter(r => r.verdict === 'fail').length
  const partialTests = verification.results.filter(r => r.verdict === 'partial').length

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Link href="/dashboard/verifications" className="hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span>Verifications</span>
          <span>/</span>
          <Link
            href={`/dashboard/domains/${verification.domainId}`}
            className="hover:text-foreground transition-colors"
          >
            {verification.domainName}
          </Link>
          <span>/</span>
          <span>{verification.id}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Verification Results
          </h1>
          <VerdictBadge verdict={verification.verdict} />
        </div>
        <p className="text-muted-foreground">
          {formatDate(verification.timestamp)} &middot; {formatDuration(verification.duration)}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" /> Trust Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatPercentage(verification.trustScore)}
            </div>
            <Progress value={verification.trustScore * 100} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" /> Behaviors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {verification.coverage.behaviors}/{verification.coverage.totalBehaviors}
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Passed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{passedTests}</div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{failedTests}</div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Partial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{partialTests}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="results" className="space-y-4">
        <TabsList>
          <TabsTrigger value="results">Results Timeline</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Behavior Results</CardTitle>
              <CardDescription>
                Detailed results for each behavior verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              {verification.results.length > 0 ? (
                <Timeline results={verification.results} />
              ) : (
                <p className="text-muted-foreground">No detailed results available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coverage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <CoverageBreakdown coverage={verification.coverage} />
            <Card>
              <CardHeader>
                <CardTitle>Coverage Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CoverageRow
                  label="Behaviors"
                  covered={verification.coverage.behaviors}
                  total={verification.coverage.totalBehaviors}
                />
                <CoverageRow
                  label="Preconditions"
                  covered={verification.coverage.preconditions}
                  total={verification.coverage.totalPreconditions}
                />
                <CoverageRow
                  label="Postconditions"
                  covered={verification.coverage.postconditions}
                  total={verification.coverage.totalPostconditions}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Verification Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Verification ID</dt>
                  <dd className="font-mono text-sm">{verification.id}</dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Domain</dt>
                  <dd>
                    <Link
                      href={`/dashboard/domains/${verification.domainId}`}
                      className="text-primary hover:underline"
                    >
                      {verification.domainName}
                    </Link>
                  </dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Timestamp</dt>
                  <dd>{formatDate(verification.timestamp)}</dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd>{formatDuration(verification.duration)}</dd>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <dt className="text-muted-foreground">Verdict</dt>
                  <dd><VerdictBadge verdict={verification.verdict} /></dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-muted-foreground">Trust Score</dt>
                  <dd className="font-bold text-primary">
                    {formatPercentage(verification.trustScore)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface CoverageRowProps {
  label: string
  covered: number
  total: number
}

function CoverageRow({ label, covered, total }: CoverageRowProps) {
  const percentage = total > 0 ? (covered / total) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{covered}/{total} ({percentage.toFixed(0)}%)</span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  )
}

function VerificationDetailSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
