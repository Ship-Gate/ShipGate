/**
 * Search Routes
 * 
 * Endpoints for searching and discovering intent packages.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IntentCategory } from '@prisma/client';
import {
  searchPackages,
  getTrendingPackages,
  getPackagesByCategory,
  getRelatedPackages,
  suggestPackages,
} from '../services/search.js';

export const searchRouter = Router();

/**
 * Handle async route errors
 */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * GET /api/search?q=...
 * Search for intent packages
 */
searchRouter.get('/', asyncHandler(async (req, res) => {
  const {
    q,
    category,
    minTrust,
    verified,
    limit = '20',
    offset = '0',
  } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Query parameter "q" is required',
    });
    return;
  }

  const result = await searchPackages({
    query: q,
    category: category as IntentCategory | undefined,
    minTrustScore: minTrust ? parseInt(minTrust as string, 10) : undefined,
    verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
    limit: Math.min(parseInt(limit as string, 10), 100),
    offset: parseInt(offset as string, 10),
  });

  res.json({
    query: result.query,
    total: result.total,
    results: result.results.map(r => ({
      name: r.name,
      displayName: r.displayName,
      description: r.description,
      author: r.author,
      category: r.category,
      version: r.version,
      downloads: r.downloads,
      stars: r.stars,
      trustScore: r.trustScore,
      isVerified: r.isVerified,
      relevance: r.matchScore,
    })),
  });
}));

/**
 * GET /api/trending
 * Get trending packages
 */
searchRouter.get('/trending', asyncHandler(async (req, res) => {
  const {
    period = 'week',
    category,
    limit = '10',
  } = req.query;

  const results = await getTrendingPackages({
    period: period as 'day' | 'week' | 'month' | 'all',
    category: category as IntentCategory | undefined,
    limit: Math.min(parseInt(limit as string, 10), 50),
  });

  res.json({
    period,
    trending: results.map(r => ({
      name: r.name,
      displayName: r.displayName,
      description: r.description,
      author: r.author,
      category: r.category,
      version: r.version,
      downloads: r.downloads,
      stars: r.stars,
      trustScore: r.trustScore,
      isVerified: r.isVerified,
      trendingScore: r.matchScore,
    })),
  });
}));

/**
 * GET /api/search/category/:category
 * Get packages by category
 */
searchRouter.get('/category/:category', asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { limit = '10' } = req.query;

  // Validate category
  const validCategories = Object.values(IntentCategory);
  if (!validCategories.includes(category as IntentCategory)) {
    res.status(400).json({
      error: 'Bad Request',
      message: `Invalid category. Valid categories: ${validCategories.join(', ')}`,
    });
    return;
  }

  const results = await getPackagesByCategory(
    category as IntentCategory,
    Math.min(parseInt(limit as string, 10), 50)
  );

  res.json({
    category,
    packages: results.map(r => ({
      name: r.name,
      displayName: r.displayName,
      description: r.description,
      author: r.author,
      version: r.version,
      downloads: r.downloads,
      stars: r.stars,
      trustScore: r.trustScore,
      isVerified: r.isVerified,
    })),
  });
}));

/**
 * GET /api/search/related/:name
 * Get related packages
 */
searchRouter.get('/related/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const { limit = '5' } = req.query;

  const results = await getRelatedPackages(
    name,
    Math.min(parseInt(limit as string, 10), 20)
  );

  res.json({
    packageName: name,
    related: results.map(r => ({
      name: r.name,
      displayName: r.displayName,
      description: r.description,
      author: r.author,
      category: r.category,
      version: r.version,
      downloads: r.downloads,
      trustScore: r.trustScore,
      isVerified: r.isVerified,
      similarity: r.matchScore,
    })),
  });
}));

/**
 * GET /api/search/suggest?prefix=...
 * Autocomplete package names
 */
searchRouter.get('/suggest', asyncHandler(async (req, res) => {
  const { prefix, limit = '10' } = req.query;

  if (!prefix || typeof prefix !== 'string') {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Query parameter "prefix" is required',
    });
    return;
  }

  const suggestions = await suggestPackages(
    prefix,
    Math.min(parseInt(limit as string, 10), 20)
  );

  res.json({
    prefix,
    suggestions,
  });
}));

/**
 * GET /api/search/categories
 * List all available categories
 */
searchRouter.get('/categories', (_req, res) => {
  res.json({
    categories: [
      { value: 'AUTH', label: 'Authentication & Authorization', description: 'User auth, sessions, permissions' },
      { value: 'PAYMENT', label: 'Financial Transactions', description: 'Payments, billing, subscriptions' },
      { value: 'DATA', label: 'Data Processing', description: 'Validation, transformation, ETL' },
      { value: 'WORKFLOW', label: 'Business Processes', description: 'Workflows, state machines, approvals' },
      { value: 'INTEGRATION', label: 'External APIs', description: 'API contracts, webhooks, integrations' },
      { value: 'SECURITY', label: 'Security', description: 'Security constraints, rate limiting, auditing' },
      { value: 'GENERAL', label: 'General Purpose', description: 'General utilities and helpers' },
    ],
  });
});
