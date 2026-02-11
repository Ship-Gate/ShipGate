'use client'

import { use } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { VerdictBadge } from '@/components/VerdictBadge'
import { VerificationCard, VerificationCardSkeleton } from '@/components/VerificationCard'
import { VerificationTimeline } from '@/components/Timeline'
import { useDomain, useDomainBehaviors, useDomainVerifications, useTriggerVerification } from '@/hooks/useApi'
import { formatDate, formatPercentage } from '@/lib/utils'
import { ArrowLeft, Play, RefreshCw, Code, FileCheck, Clock } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function DomainDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const { data: domain, loading: domainLoading } = useDomain(id)
  const { data: behaviors, loading: behaviorsLoading } = useDomainBehaviors(id)
  const { data: verifications, loading: verificationsLoading } = useDomainVerifications(id)
  const { trigger, loading: triggerLoading } = useTriggerVerification()

  const handleVerify = async () => {
    try {
      await trigger(id)
      // In a real app, this would start polling for job status
    } catch {
      // Error handling
    }
  }

  const statusToVerdict = {
    verified: 'pass',
    failing: 'fail',
    pending: 'pending',
    unknown: 'unknown',
  } as const

  if (domainLoading) {
    return <DomainDetailSkeleton />
  }

  if (!domain) {
    return (
      <div className="container py-6">
        <p>Domain not found</p>
      </div>
    )
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span>Domains</span>
            <span>/</span>
            <span>{domain.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{domain.name}</h1>
            <VerdictBadge verdict={statusToVerdict[domain.status]} />
          </div>
          <p className="text-muted-foreground">{domain.description}</p>
        </div>
        <Button onClick={() => void handleVerify()} disabled={triggerLoading}>
          {triggerLoading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Run Verification
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trust Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(domain.trustScore)}</div>
            <Progress value={domain.trustScore * 100} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Code className="h-4 w-4" /> Behaviors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{domain.behaviorCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileCheck className="h-4 w-4" /> Verifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{verifications?.length ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Last Verified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {domain.lastVerified ? formatDate(domain.lastVerified) : 'Never'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="behaviors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="behaviors">Behaviors</TabsTrigger>
          <TabsTrigger value="verifications">Verifications</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="behaviors" className="space-y-4">
          {behaviorsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="h-20 bg-muted animate-pulse rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {behaviors?.map(behavior => (
                <Card key={behavior.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{behavior.name}</CardTitle>
                    <CardDescription>{behavior.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Preconditions</h4>
                        <ul className="space-y-1">
                          {behavior.preconditions.map((pre, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              {pre}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-2">Postconditions</h4>
                        <ul className="space-y-1">
                          {behavior.postconditions.map((post, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              {post}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
                      <span>{behavior.testCount} tests</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="verifications" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {verificationsLoading
              ? [...Array(4)].map((_, i) => <VerificationCardSkeleton key={i} />)
              : verifications?.map(verification => (
                  <VerificationCard 
                    key={verification.id} 
                    verification={verification} 
                    showDomain={false}
                  />
                ))
            }
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Verification History</CardTitle>
              <CardDescription>Timeline of all verification runs</CardDescription>
            </CardHeader>
            <CardContent>
              {verificationsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : verifications && verifications.length > 0 ? (
                <VerificationTimeline verifications={verifications} />
              ) : (
                <p className="text-muted-foreground">No verifications yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DomainDetailSkeleton() {
  return (
    <div className="container py-6 space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
        <div className="h-4 w-96 bg-muted animate-pulse rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
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
