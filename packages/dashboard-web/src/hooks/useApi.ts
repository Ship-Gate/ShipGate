'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  api, 
  mockData, 
  type Domain, 
  type Behavior, 
  type VerificationResult, 
  type DashboardStats 
} from '@/lib/api'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

function useApiCall<T>(
  fetcher: () => Promise<T>,
  mockFetcher: () => T,
  deps: unknown[] = []
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (USE_MOCK) {
        await new Promise(resolve => setTimeout(resolve, 300))
        setData(mockFetcher())
      } else {
        const result = await fetcher()
        setData(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

/** Always fetches from real API (no mock). Used for runs/proof-bundles. */
function useRealApiCall<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useDashboardStats(): UseApiState<DashboardStats> {
  return useApiCall(
    () => api.getDashboardStats(),
    () => mockData.stats(),
    []
  )
}

export function useDomains(): UseApiState<Domain[]> {
  return useApiCall(
    () => api.getDomains(),
    () => mockData.domains(),
    []
  )
}

export function useDomain(id: string): UseApiState<Domain> {
  return useApiCall(
    () => api.getDomain(id),
    () => mockData.domains().find(d => d.id === id) || mockData.domains()[0],
    [id]
  )
}

export function useDomainBehaviors(domainId: string): UseApiState<Behavior[]> {
  return useApiCall(
    () => api.getDomainBehaviors(domainId),
    () => mockData.behaviors(domainId),
    [domainId]
  )
}

export function useDomainVerifications(domainId: string): UseApiState<VerificationResult[]> {
  return useApiCall(
    () => api.getDomainVerifications(domainId),
    () => mockData.verifications().filter(v => v.domainId === domainId),
    [domainId]
  )
}

export function useVerifications(): UseApiState<VerificationResult[]> {
  return useApiCall(
    () => api.getVerifications(),
    () => mockData.verifications(),
    []
  )
}

export function useVerification(id: string): UseApiState<VerificationResult> {
  return useApiCall(
    () => api.getVerification(id),
    () => mockData.verification(id),
    [id]
  )
}

// ── Runs (Shipgate dashboard) ────────────────────────────────────────────

import {
  listRuns,
  getRun,
  getRunDiff,
  ingestProofBundle,
  type ListRunsParams,
  type VerificationReport,
  type ReportDiff,
  type IngestProofBundlePayload,
} from '@/lib/runs-api'

export function useRuns(params: ListRunsParams = {}) {
  const { repo, branch, verdict, q, from, to, page = 1, limit = 20 } = params
  return useRealApiCall(
    () => listRuns({ repo, branch, verdict, q, from, to, page, limit }),
    [repo, branch, verdict, q, from, to, page, limit]
  )
}

export function useRun(id: string | null) {
  const fetcher = useCallback(() => (id ? getRun(id) : Promise.reject(new Error('No id'))), [id])
  return useRealApiCall(fetcher, [id ?? ''])
}

export function useRunDiff(id: string | null) {
  const fetcher = useCallback(() => (id ? getRunDiff(id) : Promise.reject(new Error('No id'))), [id])
  return useRealApiCall(fetcher, [id ?? ''])
}

export function useIngestProofBundle() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const ingest = useCallback(async (payload: IngestProofBundlePayload) => {
    setLoading(true)
    setError(null)
    try {
      return await ingestProofBundle(payload)
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Unknown error')
      setError(e)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return { ingest, loading, error }
}

// ── Legacy (domains / verifications) ────────────────────────────────────

export function useTriggerVerification() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const trigger = useCallback(async (domainId: string) => {
    setLoading(true)
    setError(null)
    try {
      if (USE_MOCK) {
        await new Promise(resolve => setTimeout(resolve, 500))
        return { jobId: `job-${Date.now()}` }
      }
      return await api.triggerVerification(domainId)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  return { trigger, loading, error }
}
