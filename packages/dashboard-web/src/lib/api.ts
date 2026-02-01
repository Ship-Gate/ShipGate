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
  verdict: 'pass' | 'fail' | 'skip' | 'error'
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

    return response.json()
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

// Mock data for development
export const mockData = {
  stats: (): DashboardStats => ({
    totalDomains: 12,
    totalBehaviors: 87,
    totalVerifications: 234,
    averageTrustScore: 0.847,
    passingDomains: 9,
    failingDomains: 3,
    recentVerifications: mockData.verifications().slice(0, 5),
    trustScoreHistory: [
      { date: '2026-01-25', score: 0.82 },
      { date: '2026-01-26', score: 0.84 },
      { date: '2026-01-27', score: 0.81 },
      { date: '2026-01-28', score: 0.85 },
      { date: '2026-01-29', score: 0.87 },
      { date: '2026-01-30', score: 0.84 },
      { date: '2026-01-31', score: 0.85 },
    ],
  }),

  domains: (): Domain[] => [
    {
      id: 'auth',
      name: 'Authentication',
      description: 'User authentication and session management',
      behaviorCount: 12,
      lastVerified: '2026-01-31T10:30:00Z',
      trustScore: 0.95,
      status: 'verified',
    },
    {
      id: 'payments',
      name: 'Payments',
      description: 'Payment processing and billing',
      behaviorCount: 18,
      lastVerified: '2026-01-31T09:15:00Z',
      trustScore: 0.72,
      status: 'failing',
    },
    {
      id: 'inventory',
      name: 'Inventory',
      description: 'Product inventory management',
      behaviorCount: 8,
      lastVerified: '2026-01-30T16:45:00Z',
      trustScore: 0.88,
      status: 'verified',
    },
    {
      id: 'notifications',
      name: 'Notifications',
      description: 'Email and push notifications',
      behaviorCount: 6,
      lastVerified: null,
      trustScore: 0,
      status: 'pending',
    },
    {
      id: 'analytics',
      name: 'Analytics',
      description: 'User analytics and reporting',
      behaviorCount: 15,
      lastVerified: '2026-01-31T08:00:00Z',
      trustScore: 0.91,
      status: 'verified',
    },
    {
      id: 'orders',
      name: 'Orders',
      description: 'Order processing and fulfillment',
      behaviorCount: 22,
      lastVerified: '2026-01-30T22:30:00Z',
      trustScore: 0.65,
      status: 'failing',
    },
  ],

  behaviors: (domainId: string): Behavior[] => [
    {
      id: `${domainId}-1`,
      name: 'User Login',
      description: 'Authenticates user with credentials',
      domainId,
      preconditions: ['User exists', 'Password is valid'],
      postconditions: ['Session created', 'Token returned'],
      testCount: 5,
    },
    {
      id: `${domainId}-2`,
      name: 'User Logout',
      description: 'Terminates user session',
      domainId,
      preconditions: ['User is logged in'],
      postconditions: ['Session destroyed', 'Token invalidated'],
      testCount: 3,
    },
    {
      id: `${domainId}-3`,
      name: 'Password Reset',
      description: 'Initiates password reset flow',
      domainId,
      preconditions: ['User exists', 'Email is verified'],
      postconditions: ['Reset token created', 'Email sent'],
      testCount: 4,
    },
  ],

  verifications: (): VerificationResult[] => [
    {
      id: 'v1',
      domainId: 'auth',
      domainName: 'Authentication',
      timestamp: '2026-01-31T10:30:00Z',
      duration: 12500,
      verdict: 'pass',
      trustScore: 0.95,
      coverage: {
        behaviors: 12,
        totalBehaviors: 12,
        preconditions: 24,
        totalPreconditions: 24,
        postconditions: 36,
        totalPostconditions: 38,
      },
      results: [],
    },
    {
      id: 'v2',
      domainId: 'payments',
      domainName: 'Payments',
      timestamp: '2026-01-31T09:15:00Z',
      duration: 45200,
      verdict: 'fail',
      trustScore: 0.72,
      coverage: {
        behaviors: 15,
        totalBehaviors: 18,
        preconditions: 30,
        totalPreconditions: 36,
        postconditions: 42,
        totalPostconditions: 54,
      },
      results: [],
    },
    {
      id: 'v3',
      domainId: 'analytics',
      domainName: 'Analytics',
      timestamp: '2026-01-31T08:00:00Z',
      duration: 8900,
      verdict: 'pass',
      trustScore: 0.91,
      coverage: {
        behaviors: 14,
        totalBehaviors: 15,
        preconditions: 28,
        totalPreconditions: 30,
        postconditions: 45,
        totalPostconditions: 48,
      },
      results: [],
    },
    {
      id: 'v4',
      domainId: 'orders',
      domainName: 'Orders',
      timestamp: '2026-01-30T22:30:00Z',
      duration: 67800,
      verdict: 'fail',
      trustScore: 0.65,
      coverage: {
        behaviors: 18,
        totalBehaviors: 22,
        preconditions: 36,
        totalPreconditions: 44,
        postconditions: 52,
        totalPostconditions: 66,
      },
      results: [],
    },
    {
      id: 'v5',
      domainId: 'inventory',
      domainName: 'Inventory',
      timestamp: '2026-01-30T16:45:00Z',
      duration: 5600,
      verdict: 'pass',
      trustScore: 0.88,
      coverage: {
        behaviors: 7,
        totalBehaviors: 8,
        preconditions: 14,
        totalPreconditions: 16,
        postconditions: 21,
        totalPostconditions: 24,
      },
      results: [],
    },
  ],

  verification: (id: string): VerificationResult => ({
    id,
    domainId: 'auth',
    domainName: 'Authentication',
    timestamp: '2026-01-31T10:30:00Z',
    duration: 12500,
    verdict: 'pass',
    trustScore: 0.95,
    coverage: {
      behaviors: 12,
      totalBehaviors: 12,
      preconditions: 24,
      totalPreconditions: 24,
      postconditions: 36,
      totalPostconditions: 38,
    },
    results: [
      {
        behaviorId: 'auth-1',
        behaviorName: 'User Login',
        verdict: 'pass',
        duration: 2300,
        tests: [
          {
            name: 'should login with valid credentials',
            verdict: 'pass',
            duration: 450,
            preconditionResults: [
              { condition: 'User exists', passed: true },
              { condition: 'Password is valid', passed: true },
            ],
            postconditionResults: [
              { condition: 'Session created', passed: true },
              { condition: 'Token returned', passed: true },
            ],
          },
          {
            name: 'should reject invalid password',
            verdict: 'pass',
            duration: 380,
            preconditionResults: [
              { condition: 'User exists', passed: true },
              { condition: 'Password is invalid', passed: true },
            ],
            postconditionResults: [
              { condition: 'Error returned', passed: true },
              { condition: 'No session created', passed: true },
            ],
          },
        ],
      },
      {
        behaviorId: 'auth-2',
        behaviorName: 'User Logout',
        verdict: 'pass',
        duration: 1200,
        tests: [
          {
            name: 'should destroy session on logout',
            verdict: 'pass',
            duration: 320,
            preconditionResults: [
              { condition: 'User is logged in', passed: true },
            ],
            postconditionResults: [
              { condition: 'Session destroyed', passed: true },
              { condition: 'Token invalidated', passed: true },
            ],
          },
        ],
      },
      {
        behaviorId: 'auth-3',
        behaviorName: 'Password Reset',
        verdict: 'partial',
        duration: 3400,
        tests: [
          {
            name: 'should send reset email',
            verdict: 'pass',
            duration: 890,
            preconditionResults: [
              { condition: 'User exists', passed: true },
              { condition: 'Email is verified', passed: true },
            ],
            postconditionResults: [
              { condition: 'Reset token created', passed: true },
              { condition: 'Email sent', passed: true },
            ],
          },
          {
            name: 'should expire old tokens',
            verdict: 'fail',
            duration: 560,
            message: 'Expected old token to be invalidated',
            preconditionResults: [
              { condition: 'Old token exists', passed: true },
            ],
            postconditionResults: [
              { condition: 'Old token invalidated', passed: false, expected: 'true', actual: 'false' },
            ],
          },
        ],
      },
    ],
  }),
}
