/**
 * Intent Package Routes
 * 
 * REST endpoints for managing intent packages.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { IntentCategory } from '@prisma/client';
import {
  listPackages,
  getPackage,
  getPackageVersions,
  createPackage,
  publishVersion,
  getVersion,
  deprecatePackage,
  toggleStar,
  recordDeployment,
  createPackageSchema,
  createVersionSchema,
} from '../services/intent.js';

export const intentsRouter = Router();

/**
 * Handle async route errors
 */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Format Zod errors for API response
 */
function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.errors.map(e => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}

/**
 * GET /api/intents
 * List all intent packages with pagination and filtering
 */
intentsRouter.get('/', asyncHandler(async (req, res) => {
  const {
    limit = '20',
    offset = '0',
    category,
    author,
    verified,
    sort = 'downloads',
    order = 'desc',
  } = req.query;

  const result = await listPackages({
    limit: Math.min(parseInt(limit as string, 10), 100),
    offset: parseInt(offset as string, 10),
    category: category as IntentCategory | undefined,
    author: author as string | undefined,
    verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
    sortBy: sort as 'downloads' | 'stars' | 'createdAt' | 'updatedAt',
    sortOrder: order as 'asc' | 'desc',
  });

  res.json({
    packages: result.packages.map(pkg => ({
      name: pkg.name,
      displayName: pkg.displayName,
      description: pkg.description,
      author: pkg.author,
      category: pkg.category,
      version: pkg.latestVersion?.version ?? '0.0.0',
      downloads: pkg.downloads,
      stars: pkg.stars,
      trustScore: pkg.trustScore ?? 0,
      isVerified: pkg.isVerified,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt,
    })),
    pagination: {
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.offset + result.limit < result.total,
    },
  });
}));

/**
 * POST /api/intents
 * Create a new intent package
 */
intentsRouter.post('/', asyncHandler(async (req, res) => {
  try {
    const input = createPackageSchema.parse(req.body);
    const pkg = await createPackage(input);

    res.status(201).json({
      message: 'Package created successfully',
      package: {
        name: pkg.name,
        displayName: pkg.displayName,
        description: pkg.description,
        author: pkg.author,
        category: pkg.category,
        createdAt: pkg.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: formatZodError(error),
      });
      return;
    }
    throw error;
  }
}));

/**
 * GET /api/intents/:name
 * Get a specific intent package
 */
intentsRouter.get('/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const pkg = await getPackage(name);

  if (!pkg) {
    res.status(404).json({
      error: 'Not Found',
      message: `Package '${name}' not found`,
    });
    return;
  }

  res.json({
    name: pkg.name,
    displayName: pkg.displayName,
    description: pkg.description,
    author: pkg.author,
    repository: pkg.repository,
    license: pkg.license,
    keywords: JSON.parse(pkg.keywords),
    category: pkg.category,
    version: pkg.latestVersion?.version ?? '0.0.0',
    contract: pkg.latestVersion?.contract,
    readme: pkg.latestVersion?.readme,
    downloads: pkg.downloads,
    stars: pkg.stars,
    trustScore: pkg.trustScore ?? 0,
    isVerified: pkg.isVerified,
    isDeprecated: pkg.isDeprecated,
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  });
}));

/**
 * GET /api/intents/:name/versions
 * Get all versions of a package
 */
intentsRouter.get('/:name/versions', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const versions = await getPackageVersions(name);

  if (versions.length === 0) {
    // Check if package exists
    const pkg = await getPackage(name);
    if (!pkg) {
      res.status(404).json({
        error: 'Not Found',
        message: `Package '${name}' not found`,
      });
      return;
    }
  }

  res.json({
    packageName: name,
    versions: versions.map(v => ({
      version: v.version,
      isLatest: v.isLatest,
      publishedAt: v.publishedAt,
      downloads: v.downloads,
      changelog: v.changelog,
    })),
  });
}));

/**
 * GET /api/intents/:name/versions/:version
 * Get a specific version
 */
intentsRouter.get('/:name/versions/:version', asyncHandler(async (req, res) => {
  const { name, version } = req.params;
  const ver = await getVersion(name, version);

  if (!ver) {
    res.status(404).json({
      error: 'Not Found',
      message: `Version '${version}' of package '${name}' not found`,
    });
    return;
  }

  res.json({
    packageName: name,
    version: ver.version,
    contract: ver.contract,
    readme: ver.readme,
    changelog: ver.changelog,
    isLatest: ver.isLatest,
    publishedAt: ver.publishedAt,
    downloads: ver.downloads,
  });
}));

/**
 * POST /api/intents/:name/versions
 * Publish a new version
 */
intentsRouter.post('/:name/versions', asyncHandler(async (req, res) => {
  const { name } = req.params;

  try {
    const input = createVersionSchema.parse(req.body);
    const version = await publishVersion(name, input);

    res.status(201).json({
      message: 'Version published successfully',
      version: {
        version: version.version,
        isLatest: version.isLatest,
        publishedAt: version.publishedAt,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: formatZodError(error),
      });
      return;
    }
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    if (error instanceof Error && error.message.includes('must be greater')) {
      res.status(400).json({
        error: 'Version Error',
        message: error.message,
      });
      return;
    }
    throw error;
  }
}));

/**
 * POST /api/intents/:name/deprecate
 * Deprecate a package
 */
intentsRouter.post('/:name/deprecate', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const { reason } = req.body;

  try {
    await deprecatePackage(name, reason);
    res.json({
      message: `Package '${name}' has been deprecated`,
    });
  } catch {
    res.status(404).json({
      error: 'Not Found',
      message: `Package '${name}' not found`,
    });
  }
}));

/**
 * POST /api/intents/:name/star
 * Star a package
 */
intentsRouter.post('/:name/star', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const { star = true } = req.body;

  try {
    const pkg = await toggleStar(name, star);
    res.json({
      message: star ? 'Package starred' : 'Star removed',
      stars: pkg.stars,
    });
  } catch {
    res.status(404).json({
      error: 'Not Found',
      message: `Package '${name}' not found`,
    });
  }
}));

/**
 * POST /api/intents/:name/deploy
 * Record a deployment (for analytics/trust)
 */
intentsRouter.post('/:name/deploy', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const { version, environment, platform } = req.body;

  const deploySchema = z.object({
    version: z.string(),
    environment: z.enum(['production', 'staging', 'development']),
    platform: z.string().optional(),
  });

  try {
    const input = deploySchema.parse({ version, environment, platform });
    await recordDeployment(name, input.version, input.environment, input.platform);
    
    res.json({
      message: 'Deployment recorded',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        details: formatZodError(error),
      });
      return;
    }
    throw error;
  }
}));
