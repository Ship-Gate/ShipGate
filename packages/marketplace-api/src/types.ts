/**
 * Local type definitions for the marketplace API.
 * 
 * These types mirror the Prisma schema and allow the code to compile
 * without needing a generated Prisma client.
 */

// Enums matching schema.prisma
export enum IntentCategory {
  AUTH = 'AUTH',
  PAYMENT = 'PAYMENT',
  DATA = 'DATA',
  WORKFLOW = 'WORKFLOW',
  INTEGRATION = 'INTEGRATION',
  SECURITY = 'SECURITY',
  GENERAL = 'GENERAL',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  ERROR = 'ERROR',
}

export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum IncidentStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

// Model types matching schema.prisma
export interface IntentPackage {
  id: string;
  name: string;
  displayName: string;
  description: string;
  author: string;
  repository: string | null;
  license: string;
  keywords: string;
  category: IntentCategory;
  downloads: number;
  stars: number;
  isVerified: boolean;
  isDeprecated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntentVersion {
  id: string;
  packageId: string;
  version: string;
  contract: string;
  changelog: string | null;
  readme: string | null;
  isLatest: boolean;
  downloads: number;
  publishedAt: Date;
}

export interface Verification {
  id: string;
  versionId: string;
  verifier: string;
  status: VerificationStatus;
  trustScore: number | null;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  coverage: number | null;
  report: string | null;
  runAt: Date;
}

export interface TrustMetrics {
  id: string;
  packageId: string;
  trustScore: number;
  verificationCount: number;
  deploymentCount: number;
  incidentCount: number;
  avgTestCoverage: number | null;
  avgPassRate: number | null;
  lastVerified: Date | null;
  maintainerScore: number;
  communityScore: number;
  securityScore: number;
  updatedAt: Date;
}

export interface Deployment {
  id: string;
  packageName: string;
  version: string;
  environment: string;
  platform: string | null;
  anonymous: boolean;
  deployedAt: Date;
}

export interface Incident {
  id: string;
  packageName: string;
  version: string | null;
  severity: IncidentSeverity;
  title: string;
  description: string;
  status: IncidentStatus;
  reportedBy: string;
  resolvedAt: Date | null;
  createdAt: Date;
}

// Extended types with relations
export interface IntentPackageWithRelations extends IntentPackage {
  versions?: IntentVersionWithRelations[];
  trustMetrics?: TrustMetrics | null;
}

export interface IntentVersionWithRelations extends IntentVersion {
  verifications?: Verification[];
}

/**
 * PrismaClient placeholder type.
 * 
 * This allows the code to compile without a generated Prisma client.
 * At runtime, the actual PrismaClient from @prisma/client will be used.
 * 
 * Run `pnpm db:generate` to generate the real Prisma client with full types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaClient = any;
