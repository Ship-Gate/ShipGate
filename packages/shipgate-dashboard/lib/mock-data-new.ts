import type { Repo, Scan, ComplianceControl, ProvenanceData, DashboardData } from '@/types';

export const mockRepos: Repo[] = [
  {
    id: '1',
    name: 'acme-api',
    verdict: 'SHIP',
    score: 94,
    claims: 8,
    issues: 2,
    lastScan: '2m ago',
    trend: [85, 87, 84, 89, 88, 91, 94]
  },
  {
    id: '2',
    name: 'payment-service',
    verdict: 'WARN',
    score: 73,
    claims: 12,
    issues: 5,
    lastScan: '5m ago',
    trend: [78, 76, 74, 72, 73, 71, 73]
  },
  {
    id: '3',
    name: 'auth-middleware',
    verdict: 'NO_SHIP',
    score: 41,
    claims: 6,
    issues: 12,
    lastScan: '1h ago',
    trend: [65, 58, 52, 48, 45, 43, 41]
  },
  {
    id: '4',
    name: 'frontend-app',
    verdict: 'SHIP',
    score: 96,
    claims: 15,
    issues: 1,
    lastScan: '3m ago',
    trend: [92, 93, 94, 95, 95, 96, 96]
  },
  {
    id: '5',
    name: 'notification-service',
    verdict: 'SHIP',
    score: 88,
    claims: 9,
    issues: 3,
    lastScan: '10m ago',
    trend: [82, 84, 85, 86, 87, 87, 88]
  }
];

export const mockRecentScans: Scan[] = [
  {
    id: '1',
    repo: 'acme-api',
    commit: 'a1b2c3d',
    verdict: 'SHIP',
    author: 'gee',
    time: '2m ago',
    pr: '#142'
  },
  {
    id: '2',
    repo: 'payment-service',
    commit: 'd4e5f6g',
    verdict: 'WARN',
    author: 'alex',
    time: '5m ago',
    pr: '#143'
  },
  {
    id: '3',
    repo: 'frontend-app',
    commit: 'h7i8j9k',
    verdict: 'SHIP',
    author: 'sam',
    time: '3m ago',
    pr: '#144'
  },
  {
    id: '4',
    repo: 'auth-middleware',
    commit: 'l0m1n2o',
    verdict: 'NO_SHIP',
    author: 'taylor',
    time: '1h ago',
    pr: '#139'
  },
  {
    id: '5',
    repo: 'notification-service',
    commit: 'p3q4r5s',
    verdict: 'SHIP',
    author: 'morgan',
    time: '10m ago',
    pr: '#145'
  }
];

export const mockCompliance: ComplianceControl[] = [
  {
    id: 'CC6.1',
    name: 'Authentication',
    repos: 5,
    satisfied: 3,
    partial: 2
  },
  {
    id: 'CC7.1',
    name: 'Vulnerability Management',
    repos: 5,
    satisfied: 4,
    partial: 1
  },
  {
    id: 'A1.1',
    name: 'Access Control',
    repos: 5,
    satisfied: 2,
    partial: 2
  },
  {
    id: 'A2.1',
    name: 'Asset Management',
    repos: 5,
    satisfied: 5,
    partial: 0
  },
  {
    id: 'D3.1',
    name: 'Data Protection',
    repos: 5,
    satisfied: 3,
    partial: 1
  },
  {
    id: 'D4.1',
    name: 'Data Integrity',
    repos: 5,
    satisfied: 4,
    partial: 0
  }
];

export const mockProvenance: ProvenanceData[] = [
  { tool: 'Cursor', count: 67, color: '#6366f1' },
  { tool: 'Copilot', count: 17, color: '#00e68a' },
  { tool: 'Claude', count: 11, color: '#ffb547' },
  { tool: 'Human', count: 5, color: '#8888a0' }
];

export const mockDashboardData: DashboardData = {
  repos: mockRepos,
  recentScans: mockRecentScans,
  compliance: mockCompliance,
  provenance: mockProvenance,
  summary: {
    verifiedRepos: 3,
    totalClaims: 50,
    openIssues: 23,
    soc2Coverage: 83
  }
};
