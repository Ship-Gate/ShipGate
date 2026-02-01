import { prisma } from '../db/client';
import { DomainStatus, Prisma } from '@prisma/client';

export interface CreateDomainInput {
  name: string;
  description?: string;
  contractPath: string;
}

export interface UpdateDomainInput {
  name?: string;
  description?: string;
  contractPath?: string;
  status?: DomainStatus;
  trustScore?: number;
}

export interface ListDomainsOptions {
  status?: DomainStatus;
  search?: string;
  skip?: number;
  take?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name' | 'trustScore';
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const domainService = {
  /**
   * Create a new domain.
   */
  async create(input: CreateDomainInput) {
    return prisma.domain.create({
      data: {
        name: input.name,
        description: input.description,
        contractPath: input.contractPath,
        status: 'PENDING',
      },
    });
  },

  /**
   * Get a domain by ID.
   */
  async getById(id: string) {
    return prisma.domain.findUnique({
      where: { id },
      include: {
        verifications: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: { verifications: true },
        },
      },
    });
  },

  /**
   * List domains with pagination and filtering.
   */
  async list(options: ListDomainsOptions = {}): Promise<PaginatedResult<Prisma.DomainGetPayload<{ include: { _count: { select: { verifications: true } } } }>>> {
    const {
      status,
      search,
      skip = 0,
      take = 20,
      orderBy = 'createdAt',
      order = 'desc',
    } = options;

    const where: Prisma.DomainWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { contractPath: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.domain.findMany({
        where,
        skip,
        take,
        orderBy: { [orderBy]: order },
        include: {
          _count: {
            select: { verifications: true },
          },
        },
      }),
      prisma.domain.count({ where }),
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
   * Update a domain.
   */
  async update(id: string, input: UpdateDomainInput) {
    return prisma.domain.update({
      where: { id },
      data: input,
    });
  },

  /**
   * Delete a domain.
   */
  async delete(id: string) {
    return prisma.domain.delete({
      where: { id },
    });
  },

  /**
   * Update domain status based on latest verification.
   */
  async updateStatusFromVerification(domainId: string) {
    const latestVerification = await prisma.verification.findFirst({
      where: { domainId },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestVerification) {
      return prisma.domain.update({
        where: { id: domainId },
        data: { status: 'PENDING', trustScore: null },
      });
    }

    let status: DomainStatus;
    let trustScore: number | null = null;

    switch (latestVerification.status) {
      case 'PASSED':
        status = 'VERIFIED';
        trustScore = latestVerification.totalTests > 0
          ? (latestVerification.passedTests / latestVerification.totalTests) * 100
          : 100;
        break;
      case 'FAILED':
        status = 'FAILED';
        trustScore = latestVerification.totalTests > 0
          ? (latestVerification.passedTests / latestVerification.totalTests) * 100
          : 0;
        break;
      case 'RUNNING':
      case 'PENDING':
      default:
        status = 'PENDING';
    }

    return prisma.domain.update({
      where: { id: domainId },
      data: { status, trustScore },
    });
  },

  /**
   * Get verifications for a domain.
   */
  async getVerifications(domainId: string, options: { skip?: number; take?: number } = {}) {
    const { skip = 0, take = 20 } = options;

    const [data, total] = await Promise.all([
      prisma.verification.findMany({
        where: { domainId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { results: true },
          },
        },
      }),
      prisma.verification.count({ where: { domainId } }),
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
