import { prisma } from '../db/client';
import { VerificationStatus, TestStatus, Prisma } from '@prisma/client';
import { domainService } from './domain';

export interface CreateVerificationInput {
  domainId: string;
}

export interface UpdateVerificationInput {
  status?: VerificationStatus;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  coverage?: number;
  duration?: number;
  report?: string;
  errorLog?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CreateTestResultInput {
  verificationId: string;
  testName: string;
  category?: string;
  status: TestStatus;
  duration?: number;
  errorMessage?: string;
  stackTrace?: string;
}

export interface ListVerificationsOptions {
  domainId?: string;
  status?: VerificationStatus;
  skip?: number;
  take?: number;
  orderBy?: 'createdAt' | 'completedAt' | 'duration';
  order?: 'asc' | 'desc';
}

export const verificationService = {
  /**
   * Create a new verification run.
   */
  async create(input: CreateVerificationInput) {
    // Verify domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: input.domainId },
    });

    if (!domain) {
      throw new Error(`Domain not found: ${input.domainId}`);
    }

    return prisma.verification.create({
      data: {
        domainId: input.domainId,
        status: 'PENDING',
      },
      include: {
        domain: true,
      },
    });
  },

  /**
   * Get a verification by ID.
   */
  async getById(id: string) {
    return prisma.verification.findUnique({
      where: { id },
      include: {
        domain: true,
        results: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { results: true },
        },
      },
    });
  },

  /**
   * List verifications with pagination and filtering.
   */
  async list(options: ListVerificationsOptions = {}) {
    const {
      domainId,
      status,
      skip = 0,
      take = 20,
      orderBy = 'createdAt',
      order = 'desc',
    } = options;

    const where: Prisma.VerificationWhereInput = {};

    if (domainId) {
      where.domainId = domainId;
    }

    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      prisma.verification.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: order },
        include: {
          domain: {
            select: { id: true, name: true },
          },
          _count: {
            select: { results: true },
          },
        },
      }),
      prisma.verification.count({ where }),
    ]);

    return {
      data,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  },

  /**
   * Update a verification.
   */
  async update(id: string, input: UpdateVerificationInput) {
    const verification = await prisma.verification.update({
      where: { id },
      data: input,
      include: {
        domain: true,
      },
    });

    // Update domain status if verification completed
    if (input.status === 'PASSED' || input.status === 'FAILED') {
      await domainService.updateStatusFromVerification(verification.domainId);
    }

    return verification;
  },

  /**
   * Start a verification run.
   */
  async start(id: string) {
    return this.update(id, {
      status: 'RUNNING',
      startedAt: new Date(),
    });
  },

  /**
   * Complete a verification run.
   */
  async complete(id: string, results: { passed: number; failed: number; coverage?: number }) {
    const status: VerificationStatus = results.failed === 0 ? 'PASSED' : 'FAILED';
    const startedVerification = await prisma.verification.findUnique({
      where: { id },
      select: { startedAt: true },
    });

    const duration = startedVerification?.startedAt
      ? Date.now() - startedVerification.startedAt.getTime()
      : undefined;

    return this.update(id, {
      status,
      totalTests: results.passed + results.failed,
      passedTests: results.passed,
      failedTests: results.failed,
      coverage: results.coverage,
      duration,
      completedAt: new Date(),
    });
  },

  /**
   * Cancel a verification run.
   */
  async cancel(id: string) {
    return this.update(id, {
      status: 'CANCELLED',
      completedAt: new Date(),
    });
  },

  /**
   * Add a test result to a verification.
   */
  async addTestResult(input: CreateTestResultInput) {
    const result = await prisma.testResult.create({
      data: input,
    });

    // Update verification counts
    const verification = await prisma.verification.findUnique({
      where: { id: input.verificationId },
    });

    if (verification) {
      const updateData: UpdateVerificationInput = {
        totalTests: (verification.totalTests || 0) + 1,
      };

      if (input.status === 'PASSED') {
        updateData.passedTests = (verification.passedTests || 0) + 1;
      } else if (input.status === 'FAILED') {
        updateData.failedTests = (verification.failedTests || 0) + 1;
      }

      await prisma.verification.update({
        where: { id: input.verificationId },
        data: updateData,
      });
    }

    return result;
  },

  /**
   * Get test results for a verification.
   */
  async getTestResults(verificationId: string, options: { skip?: number; take?: number } = {}) {
    const { skip = 0, take = 100 } = options;

    const [data, total] = await Promise.all([
      prisma.testResult.findMany({
        where: { verificationId },
        skip,
        take,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.testResult.count({ where: { verificationId } }),
    ]);

    return {
      data,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  },
};
