// API client for verification dashboard

export interface Domain {
  id: string
  name: string
  description: string
  behaviorCount: number
  lastVerified: string | null
  trustScore: number
  status: 'verified' | 'failing' | 'pending' | 'unknown'
}

export interface Behavior {
  id: string
  name: string
  description: string
  domainId: string
  preconditions: string[]
  postconditions: string[]
  testCount: number
}

export interface VerificationResult {
  id: string
  domainId: string
  domainName: string
  timestamp: string
  duration: number
  verdict: 'pass' | 'fail' | 'partial' | 'error'
  trustScore: number
  coverage: {
    behaviors: number
    totalBehaviors: number
    preconditions: number
    totalPreconditions: number
    postconditions: number
    totalPostconditions: number
  }
  results: BehaviorResult[]
}

export interface BehaviorResult {
  behaviorId: string
  behaviorName: string
  verdict: 'pass' | 'fail' | 'partial' | 'skip' | 'error'
  duration: number
  tests: TestResult[]
}

export interface TestResult {
  name: string
  verdict: 'pass' | 'fail' | 'skip' | 'error'
  duration: number
  message?: string
  preconditionResults: ConditionResult[]
  postconditionResults: ConditionResult[]
}

export interface ConditionResult {
  condition: string
  passed: boolean
  actual?: string
  expected?: string
}

export interface DashboardStats {
  totalDomains: number
  totalBehaviors: number
  totalVerifications: number
  averageTrustScore: number
  passingDomains: number
  failingDomains: number
  recentVerifications: VerificationResult[]
  trustScoreHistory: { date: string; score: number }[]
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    return response.json() as Promise<T>
  }

  async getDashboardStats(): Promise<DashboardStats> {
    return this.fetch<DashboardStats>('/dashboard/stats')
  }

  async getDomains(): Promise<Domain[]> {
    return this.fetch<Domain[]>('/domains')
  }

  async getDomain(id: string): Promise<Domain> {
    return this.fetch<Domain>(`/domains/${id}`)
  }

  async getDomainBehaviors(domainId: string): Promise<Behavior[]> {
    return this.fetch<Behavior[]>(`/domains/${domainId}/behaviors`)
  }

  async getDomainVerifications(domainId: string): Promise<VerificationResult[]> {
    return this.fetch<VerificationResult[]>(`/domains/${domainId}/verifications`)
  }

  async getVerifications(): Promise<VerificationResult[]> {
    return this.fetch<VerificationResult[]>('/verifications')
  }

  async getVerification(id: string): Promise<VerificationResult> {
    return this.fetch<VerificationResult>(`/verifications/${id}`)
  }

  async triggerVerification(domainId: string): Promise<{ jobId: string }> {
    return this.fetch<{ jobId: string }>(`/domains/${domainId}/verify`, {
      method: 'POST',
    })
  }
}

export const api = new ApiClient()
