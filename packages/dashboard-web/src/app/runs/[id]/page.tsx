'use client'

import { useParams, useRouter } from 'next/navigation'
import { useRun, useRunDiff } from '@/hooks/useApi'
import { Button, Card, CardContent, CardHeader, CardTitle, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { RunVerdictBadge } from '@/components/RunVerdictBadge'
import { formatDistanceToNow, format } from 'date-fns'
import { ArrowLeft, Download, Copy, FileWarning, FileCheck } from 'lucide-react'
import { useCallback, useState } from 'react'

export default function RunDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params?.id === 'string' ? params.id : null
  const { data: run, loading, error } = useRun(id)
  const { data: diff } = useRunDiff(id)
  const [copied, setCopied] = useState(false)

  const copySummary = useCallback(async () => {
    if (!run) return
    const text = `Run ${run.id}
Repo: ${run.repo} | Branch: ${run.branch} | Commit: ${run.commit}
Verdict: ${run.verdict} | Score: ${run.score}
Timestamp: ${run.timestamp}
Files: ${run.files.length} total, ${run.files.filter((f) => f.verdict === 'fail').length} failed`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [run])

  const downloadProofBundle = useCallback(() => {
    if (!run || !('proofBundle' in run) || !run.proofBundle) return
    const blob = new Blob([JSON.stringify(run.proofBundle, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `proof-bundle-${run.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [run])

  if (error || (!loading && !run)) {
    return (
      <div className="container py-6">
        <Button variant="ghost" onClick={() => router.push('/runs')} className="gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Runs
        </Button>
        <p className="text-destructive">{error?.message ?? 'Run not found'}</p>
      </div>
    )
  }

  if (loading || !run) {
    return (
      <div className="container py-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  const failingFiles = run.files.filter((f) => f.verdict === 'fail' || f.verdict === 'warn')
  const proofBundle = 'proofBundle' in run ? run.proofBundle : undefined

  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push('/runs')}
          className="gap-2 self-start"
          aria-label="Back to runs"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Runs
        </Button>
        <div className="flex flex-wrap gap-2">
          {proofBundle && (
            <Button variant="outline" size="sm" onClick={downloadProofBundle} className="gap-2">
              <Download className="h-4 w-4" aria-hidden />
              Download Proof Bundle
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={copySummary} className="gap-2">
            <Copy className="h-4 w-4" aria-hidden />
            {copied ? 'Copied' : 'Copy Summary'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <CardTitle className="text-xl">{run.repo}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {run.pr ? `PR #${run.pr}` : run.branch} · {run.commit.slice(0, 7)} ·{' '}
                {format(new Date(run.timestamp), 'PPp')}
              </p>
            </div>
            <RunVerdictBadge verdict={run.verdict} />
            <div className="text-2xl font-bold">{run.score}</div>
            {run.duration > 0 && (
              <span className="text-sm text-muted-foreground">{run.duration}ms</span>
            )}
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4 space-y-4">
          {diff && (diff.newFailures.length > 0 || diff.resolved.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Diff vs previous run</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-destructive mb-2">
                        New failures ({diff.newFailures.length})
                      </p>
                      <ul className="text-sm space-y-1">
                        {diff.newFailures.map((f) => (
                          <li key={f.path} className="flex items-center gap-2">
                            <FileWarning className="h-4 w-4 text-destructive shrink-0" />
                            <span className="font-mono truncate">{f.path}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-600 mb-2">
                        Resolved ({diff.resolved.length})
                      </p>
                      <ul className="text-sm space-y-1">
                        {diff.resolved.map((f) => (
                          <li key={f.path} className="flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="font-mono truncate">{f.path}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Findings by file</CardTitle>
              <p className="text-sm text-muted-foreground">
                {run.files.length} files · {run.coverage.specced}/{run.coverage.total} specced
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {run.files.map((f) => (
                  <li
                    key={f.path}
                    className="flex items-center justify-between gap-4 py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {f.verdict === 'fail' || f.verdict === 'warn' ? (
                        <FileWarning className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <FileCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                      <span className="font-mono text-sm truncate">{f.path}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          f.verdict === 'fail'
                            ? 'bg-red-100 text-red-800'
                            : f.verdict === 'warn'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {f.verdict}
                      </span>
                      {f.violations.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {f.violations.length} violation{f.violations.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="evidence" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Proof bundle (raw JSON)</CardTitle>
            </CardHeader>
            <CardContent>
              {proofBundle ? (
                <pre className="p-4 bg-muted rounded-lg text-xs overflow-auto max-h-[500px] font-mono">
                  {JSON.stringify(proofBundle, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No proof bundle stored. This run was ingested via the legacy reports API.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
