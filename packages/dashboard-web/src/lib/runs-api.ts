/**
 * Runs API client — consumes dashboard-api /api/v1/reports and /api/v1/proof-bundles
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:3700/api/v1'

export interface FileResult {
  path: string
  verdict: 'pass' | 'warn' | 'fail'
  method: 'isl' | 'specless'
  score: number
  violations: string[]
}

export interface Coverage {
  specced: number
  total: number
  percentage: number
}

export interface VerificationReport {
  id: string
  timestamp: string
  repo: string
  branch: string
  commit: string
  pr?: number
  verdict: 'SHIP' | 'WARN' | 'NO_SHIP'
  score: number
  coverage: Coverage
  files: FileResult[]
  duration: number
  triggeredBy: 'ci' | 'cli' | 'vscode'
  proofBundle?: unknown
}

export interface ListRunsParams {
  repo?: string
  branch?: string
  verdict?: 'SHIP' | 'WARN' | 'NO_SHIP'
  q?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface PaginatedRuns {
  ok: true
  data: VerificationReport[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ReportDiff {
  current: VerificationReport
  previous: VerificationReport | null
  newFailures: FileResult[]
  resolved: FileResult[]
}

export interface IngestProofBundlePayload {
  proofBundle: unknown
  repo?: string
  branch?: string
  commit?: string
  pr?: number
  triggeredBy?: 'ci' | 'cli' | 'vscode' | 'manual'
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<T>
}

function buildParams(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') search.set(k, String(v))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export async function listRuns(params: ListRunsParams = {}): Promise<PaginatedRuns> {
  const qs = buildParams({
    repo: params.repo,
    branch: params.branch,
    verdict: params.verdict,
    q: params.q,
    from: params.from,
    to: params.to,
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  })
  return fetchJson<PaginatedRuns>(`${API_BASE}/reports${qs}`)
}

export async function getRun(id: string): Promise<VerificationReport> {
  const res = await fetchJson<{ ok: true; data: VerificationReport }>(
    `${API_BASE}/reports/${encodeURIComponent(id)}`
  )
  return res.data
}

export async function getRunDiff(id: string): Promise<ReportDiff> {
  const res = await fetchJson<{ ok: true; data: ReportDiff }>(
    `${API_BASE}/reports/${encodeURIComponent(id)}/diff`
  )
  return res.data
}

export async function ingestProofBundle(payload: IngestProofBundlePayload): Promise<VerificationReport> {
  const res = await fetchJson<{ ok: true; data: VerificationReport & { proofBundleHash: string } }>(
    `${API_BASE}/proof-bundles`,
    {
      method: 'POST',
      body: JSON.stringify({
        proofBundle: payload.proofBundle,
        repo: payload.repo ?? 'unknown',
        branch: payload.branch ?? 'main',
        commit: payload.commit ?? 'unknown',
        pr: payload.pr,
        triggeredBy: payload.triggeredBy ?? 'manual',
      }),
    }
  )
  return res.data
}
