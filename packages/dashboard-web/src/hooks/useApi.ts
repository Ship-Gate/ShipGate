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
        // Simulate network delay
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
    fetchData()
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
