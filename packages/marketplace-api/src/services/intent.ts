/**
 * Intent Package Service
 * 
 * Handles CRUD operations for intent packages in the marketplace.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');
import { z } from 'zod';
import semver from 'semver';
import {
  IntentCategory,
  IntentPackage,
  IntentVersion,
  IntentPackageWithRelations,
  TrustMetrics,
} from '../types.js';

const prisma = new PrismaClient();

// Validation schemas
export const createPackageSchema = z.object({
  name: z.string()
    .min(2).max(64)
    .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, 'Name must be lowercase alphanumeric with hyphens'),
  displayName: z.string().min(2).max(128),
  description: z.string().min(10).max(1000),
  author: z.string().min(2).max(64),
  repository: z.string().url().optional(),
  license: z.string().default('MIT'),
  keywords: z.array(z.string()).default([]),
  category: z.nativeEnum(IntentCategory).default(IntentCategory.GENERAL),
});

export const createVersionSchema = z.object({
  version: z.string().refine(v => semver.valid(v) !== null, 'Invalid semver version'),
  contract: z.string().min(10), // ISL contract source
  changelog: z.string().optional(),
  readme: z.string().optional(),
});

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type CreateVersionInput = z.infer<typeof createVersionSchema>;

export interface PackageWithLatest extends IntentPackage {
  latestVersion?: IntentVersion | null;
  trustScore?: number;
}

export interface ListOptions {
  limit?: number;
  offset?: number;
  category?: IntentCategory;
  author?: string;
  verified?: boolean;
  sortBy?: 'downloads' | 'stars' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * List all intent packages with pagination and filtering
 */
export async function listPackages(options: ListOptions = {}): Promise<{
  packages: PackageWithLatest[];
  total: number;
  limit: number;
  offset: number;
}> {
  const {
    limit = 20,
    offset = 0,
    category,
    author,
    verified,
    sortBy = 'downloads',
    sortOrder = 'desc',
  } = options;

  const where = {
    isDeprecated: false,
    ...(category && { category }),
    ...(author && { author }),
    ...(verified !== undefined && { isVerified: verified }),
  };

  const [packages, total] = await Promise.all([
    prisma.intentPackage.findMany({
      where,
      include: {
        versions: {
          where: { isLatest: true },
          take: 1,
        },
        trustMetrics: true,
      },
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
    }),
    prisma.intentPackage.count({ where }),
  ]);

  return {
    packages: packages.map((pkg: IntentPackageWithRelations & { versions: IntentVersion[]; trustMetrics: TrustMetrics | null }) => ({
      ...pkg,
      latestVersion: pkg.versions[0] ?? null,
      trustScore: pkg.trustMetrics?.trustScore,
      versions: undefined,
      trustMetrics: undefined,
    })) as PackageWithLatest[],
    total,
    limit,
    offset,
  };
}

/**
 * Get a single package by name
 */
export async function getPackage(name: string): Promise<PackageWithLatest | null> {
  const pkg = await prisma.intentPackage.findUnique({
    where: { name },
    include: {
      versions: {
        where: { isLatest: true },
        take: 1,
      },
      trustMetrics: true,
    },
  });

  if (!pkg) return null;

  // Increment download counter (async, don't wait)
  prisma.intentPackage.update({
    where: { name },
    data: { downloads: { increment: 1 } },
  }).catch(() => { /* ignore */ });

  return {
    ...pkg,
    latestVersion: pkg.versions[0],
    trustScore: pkg.trustMetrics?.trustScore,
    versions: undefined,
    trustMetrics: undefined,
  } as PackageWithLatest;
}

/**
 * Get all versions of a package
 */
export async function getPackageVersions(name: string): Promise<IntentVersion[]> {
  const pkg = await prisma.intentPackage.findUnique({
    where: { name },
    include: {
      versions: {
        orderBy: { publishedAt: 'desc' },
        include: {
          verifications: {
            where: { status: 'PASSED' },
            take: 1,
            orderBy: { runAt: 'desc' },
          },
        },
      },
    },
  });

  return pkg?.versions ?? [];
}

/**
 * Create a new intent package
 */
export async function createPackage(input: CreatePackageInput): Promise<IntentPackage> {
  const validated = createPackageSchema.parse(input);

  const pkg = await prisma.intentPackage.create({
    data: {
      ...validated,
      keywords: JSON.stringify(validated.keywords),
    },
  });

  // Initialize trust metrics
  await prisma.trustMetrics.create({
    data: {
      packageId: pkg.id,
      trustScore: 0,
    },
  });

  return pkg;
}

/**
 * Publish a new version of a package
 */
export async function publishVersion(
  packageName: string,
  input: CreateVersionInput
): Promise<IntentVersion> {
  const validated = createVersionSchema.parse(input);

  const pkg = await prisma.intentPackage.findUnique({
    where: { name: packageName },
    include: {
      versions: {
        orderBy: { publishedAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!pkg) {
    throw new Error(`Package '${packageName}' not found`);
  }

  // Validate version is newer
  const latestVersion = pkg.versions[0];
  if (latestVersion && !semver.gt(validated.version, latestVersion.version)) {
    throw new Error(`Version ${validated.version} must be greater than ${latestVersion.version}`);
  }

  // Unset previous latest
  if (latestVersion) {
    await prisma.intentVersion.update({
      where: { id: latestVersion.id },
      data: { isLatest: false },
    });
  }

  // Create new version
  const version = await prisma.intentVersion.create({
    data: {
      packageId: pkg.id,
      version: validated.version,
      contract: validated.contract,
      changelog: validated.changelog,
      readme: validated.readme,
      isLatest: true,
    },
  });

  // Update package timestamp
  await prisma.intentPackage.update({
    where: { id: pkg.id },
    data: { updatedAt: new Date() },
  });

  return version;
}

/**
 * Get a specific version of a package
 */
export async function getVersion(
  packageName: string,
  version: string
): Promise<IntentVersion | null> {
  const pkg = await prisma.intentPackage.findUnique({
    where: { name: packageName },
  });

  if (!pkg) return null;

  // Handle 'latest' alias
  if (version === 'latest') {
    return prisma.intentVersion.findFirst({
      where: { packageId: pkg.id, isLatest: true },
    });
  }

  return prisma.intentVersion.findFirst({
    where: { packageId: pkg.id, version },
  });
}

/**
 * Deprecate a package
 */
export async function deprecatePackage(name: string, reason?: string): Promise<IntentPackage> {
  return prisma.intentPackage.update({
    where: { name },
    data: {
      isDeprecated: true,
      description: reason 
        ? `[DEPRECATED: ${reason}] ${(await prisma.intentPackage.findUnique({ where: { name } }))?.description}`
        : undefined,
    },
  });
}

/**
 * Star/unstar a package
 */
export async function toggleStar(name: string, star: boolean): Promise<IntentPackage> {
  return prisma.intentPackage.update({
    where: { name },
    data: {
      stars: star ? { increment: 1 } : { decrement: 1 },
    },
  });
}

/**
 * Record a deployment
 */
export async function recordDeployment(
  packageName: string,
  version: string,
  environment: string,
  platform?: string
): Promise<void> {
  await prisma.deployment.create({
    data: {
      packageName,
      version,
      environment,
      platform,
    },
  });

  // Update deployment count in trust metrics
  const pkg = await prisma.intentPackage.findUnique({
    where: { name: packageName },
    include: { trustMetrics: true },
  });

  if (pkg?.trustMetrics) {
    await prisma.trustMetrics.update({
      where: { packageId: pkg.id },
      data: { deploymentCount: { increment: 1 } },
    });
  }
}
