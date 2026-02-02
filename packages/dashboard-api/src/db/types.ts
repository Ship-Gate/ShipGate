/**
 * Local type definitions that mirror Prisma-generated types.
 * This allows the package to build without running prisma generate.
 * When Prisma client is generated, these types will be compatible.
 */

// Enums matching schema.prisma
export type DomainStatus = 'PENDING' | 'VERIFIED' | 'FAILED' | 'OUTDATED';
export type VerificationStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED';
export type TestStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED';

// Domain model
export interface Domain {
  id: string;
  name: string;
  description: string | null;
  contractPath: string;
  status: DomainStatus;
  trustScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Verification model
export interface Verification {
  id: string;
  domainId: string;
  status: VerificationStatus;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  coverage: number | null;
  duration: number | null;
  report: string | null;
  errorLog: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  domain?: Domain;
}

// TestResult model
export interface TestResult {
  id: string;
  verificationId: string;
  testName: string;
  category: string | null;
  status: TestStatus;
  duration: number | null;
  errorMessage: string | null;
  stackTrace: string | null;
  createdAt: Date;
}

// Prisma namespace types used in the codebase
export namespace Prisma {
  export interface DomainWhereInput {
    status?: DomainStatus;
    OR?: Array<{
      name?: { contains: string };
      description?: { contains: string };
      contractPath?: { contains: string };
    }>;
  }

  export interface VerificationWhereInput {
    domainId?: string;
    status?: VerificationStatus;
    createdAt?: { gte?: Date };
  }

  export type DomainGetPayload<T = unknown> = T extends unknown ? {
    id: string;
    name: string;
    description: string | null;
    contractPath: string;
    status: DomainStatus;
    trustScore: number | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { verifications: number };
  } : never;
}

// PrismaClient interface for type-checking
export interface PrismaClient {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  domain: DomainDelegate;
  verification: VerificationDelegate;
  testResult: TestResultDelegate;
}

// Delegate interfaces for Prisma operations
interface DomainDelegate {
  create(args: { data: Partial<Domain> }): Promise<Domain>;
  findUnique(args: { where: { id: string }; include?: Record<string, unknown> }): Promise<Domain | null>;
  findFirst(args: { where?: Prisma.DomainWhereInput; orderBy?: Record<string, string> }): Promise<Domain | null>;
  findMany(args?: { 
    where?: Prisma.DomainWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Record<string, string>;
    include?: Record<string, unknown>;
    select?: Record<string, unknown>;
  }): Promise<Domain[]>;
  update(args: { where: { id: string }; data: Partial<Domain> }): Promise<Domain>;
  delete(args: { where: { id: string } }): Promise<Domain>;
  count(args?: { where?: Prisma.DomainWhereInput }): Promise<number>;
  groupBy(args: { by: string[]; _count?: Record<string, boolean> }): Promise<Array<{ status: DomainStatus; _count: { status: number } }>>;
  aggregate(args: { _avg?: Record<string, boolean>; _count?: Record<string, boolean> }): Promise<{ _avg: Record<string, number | null>; _count: Record<string, number> }>;
}

interface VerificationDelegate {
  create(args: { data: Partial<Verification>; include?: Record<string, unknown> }): Promise<Verification>;
  findUnique(args: { where: { id: string }; include?: Record<string, unknown>; select?: Record<string, unknown> }): Promise<Verification | null>;
  findFirst(args: { where?: Prisma.VerificationWhereInput; orderBy?: Record<string, string> }): Promise<Verification | null>;
  findMany(args?: {
    where?: Prisma.VerificationWhereInput;
    skip?: number;
    take?: number;
    orderBy?: Record<string, string>;
    include?: Record<string, unknown>;
    select?: Record<string, unknown>;
  }): Promise<Verification[]>;
  update(args: { where: { id: string }; data: Partial<Verification>; include?: Record<string, unknown> }): Promise<Verification>;
  count(args?: { where?: Prisma.VerificationWhereInput }): Promise<number>;
  groupBy(args: { by: string[]; _count?: Record<string, boolean>; where?: Record<string, unknown> }): Promise<Array<{ status: VerificationStatus; _count: { status: number } }>>;
  aggregate(args: { where?: { domainId?: string }; _avg?: Record<string, boolean>; _count?: Record<string, boolean> }): Promise<{ _avg: Record<string, number | null>; _count: Record<string, number> }>;
}

interface TestResultDelegate {
  create(args: { data: Partial<TestResult> }): Promise<TestResult>;
  findMany(args?: {
    where?: { verificationId?: string };
    skip?: number;
    take?: number;
    orderBy?: Record<string, string>;
  }): Promise<TestResult[]>;
  count(args?: { where?: { verificationId?: string } }): Promise<number>;
  groupBy(args: { by: string[]; _count?: Record<string, boolean>; where?: Record<string, unknown> }): Promise<Array<{ status: TestStatus; _count: { status: number } }>>;
}
