'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRuns } from '@/hooks/useApi'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { RunVerdictBadge } from '@/components/RunVerdictBadge'
import { formatDistanceToNow, subDays, startOfDay, endOfDay } from 'date-fns'
import { Search, Upload, ChevronLeft, ChevronRight } from 'lucide-react'

export default function RunsPage() {
  const [q, setQ] = useState('')
  const [verdict, setVerdict] = useState<'' | 'SHIP' | 'WARN' | 'NO_SHIP'>('')
  const [page, setPage] = useState(1)
  const dateRange = useMemo(() => {
    const now = new Date()
    return {
      from: startOfDay(subDays(now, 30)).toISOString(),
      to: endOfDay(now).toISOString(),
    }
  }, [])
  const { data, loading, error, refetch } = useRuns({
    q: q || undefined,
    verdict: verdict || undefined,
    from: dateRange.from,
    to: dateRange.to,
    page,
    limit: 20,
  })

  const runs = data?.data ?? []
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 }

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setPage(1)
      refetch()
    },
    [refetch]
  )

  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Runs</h1>
          <p className="text-sm text-muted-foreground">
            Verification run history — evidence and auditability
          </p>
        </div>
        <Link href="/runs/upload">
          <Button variant="default" className="gap-2">
            <Upload className="h-4 w-4" aria-hidden />
            Ingest Proof Bundle
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3 pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              <Input
                placeholder="Search repo, branch, commit…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
                aria-label="Search runs"
              />
            </div>
            <select
              value={verdict}
              onChange={(e) =>
                setVerdict(e.target.value as '' | 'SHIP' | 'WARN' | 'NO_SHIP')
              }
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Filter by verdict"
            >
              <option value="">All verdicts</option>
              <option value="SHIP">Ship</option>
              <option value="WARN">Warn</option>
              <option value="NO_SHIP">No Ship</option>
            </select>
            <Button type="submit" variant="secondary">
              Apply
            </Button>
          </form>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-0">
          {error && (
            <div className="p-4 text-destructive text-sm" role="alert">
              {error.message}
            </div>
          )}
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading runs…
            </div>
          ) : runs.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <p className="text-muted-foreground">No runs yet</p>
              <p className="text-sm text-muted-foreground">
                Upload a proof bundle or connect CI to see run history.
              </p>
              <Link href="/runs/upload">
                <Button variant="default" className="gap-2">
                  <Upload className="h-4 w-4" aria-hidden />
                  Ingest Proof Bundle
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="grid">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">Repo</th>
                    <th className="text-left py-3 px-4 font-medium">Ref</th>
                    <th className="text-left py-3 px-4 font-medium">Verdict</th>
                    <th className="text-right py-3 px-4 font-medium">Score</th>
                    <th className="text-right py-3 px-4 font-medium">Duration</th>
                    <th className="text-left py-3 px-4 font-medium">Commit</th>
                    <th className="text-left py-3 px-4 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => (window.location.href = `/runs/${run.id}`)}
                      role="row"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          window.location.href = `/runs/${run.id}`
                        }
                      }}
                    >
                      <td className="py-3 px-4 font-medium">{run.repo}</td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {run.pr ? `#${run.pr}` : run.branch}
                      </td>
                      <td className="py-3 px-4">
                        <RunVerdictBadge verdict={run.verdict} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right">{run.score}</td>
                      <td className="py-3 px-4 text-right">
                        {run.duration > 0 ? `${run.duration}ms` : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs truncate max-w-[120px]">
                        {run.commit.slice(0, 7)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDistanceToNow(new Date(run.timestamp), {
                          addSuffix: true,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 p-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total}{' '}
                total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
