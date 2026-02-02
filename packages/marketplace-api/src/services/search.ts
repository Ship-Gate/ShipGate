/**
 * Search Service
 * 
 * Full-text search and discovery for intent packages.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');
import {
  IntentCategory,
  IntentPackageWithRelations,
  IntentVersion,
  TrustMetrics,
} from '../types.js';

const prisma = new PrismaClient();

export interface SearchResult {
  name: string;
  displayName: string;
  description: string;
  author: string;
  category: IntentCategory;
  version: string;
  downloads: number;
  stars: number;
  trustScore: number;
  isVerified: boolean;
  matchScore: number; // Relevance score
  matchedOn: string[]; // Which fields matched
}

export interface SearchOptions {
  query: string;
  category?: IntentCategory;
  minTrustScore?: number;
  verified?: boolean;
  limit?: number;
  offset?: number;
}

export interface TrendingOptions {
  period?: 'day' | 'week' | 'month' | 'all';
  category?: IntentCategory;
  limit?: number;
}

/**
 * Search for intent packages
 */
export async function searchPackages(options: SearchOptions): Promise<{
  results: SearchResult[];
  total: number;
  query: string;
}> {
  const {
    query,
    category,
    minTrustScore,
    verified,
    limit = 20,
    offset = 0,
  } = options;

  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/);

  // Fetch all non-deprecated packages with their metadata
  const packages = await prisma.intentPackage.findMany({
    where: {
      isDeprecated: false,
      ...(category && { category }),
      ...(verified !== undefined && { isVerified: verified }),
    },
    include: {
      versions: {
        where: { isLatest: true },
        take: 1,
      },
      trustMetrics: true,
    },
  });

  // Define the package type returned by Prisma query
  type PackageWithVersionsAndMetrics = IntentPackageWithRelations & {
    versions: IntentVersion[];
    trustMetrics: TrustMetrics | null;
  };

  // Score and filter packages
  const scored = packages
    .map((pkg: PackageWithVersionsAndMetrics) => {
      const matchedOn: string[] = [];
      let matchScore = 0;

      // Name matching (highest weight)
      const nameLower = pkg.name.toLowerCase();
      if (nameLower === queryLower) {
        matchScore += 100;
        matchedOn.push('name:exact');
      } else if (nameLower.includes(queryLower)) {
        matchScore += 50;
        matchedOn.push('name:partial');
      } else if (queryWords.some(w => nameLower.includes(w))) {
        matchScore += 25;
        matchedOn.push('name:word');
      }

      // Display name matching
      const displayLower = pkg.displayName.toLowerCase();
      if (displayLower.includes(queryLower)) {
        matchScore += 30;
        matchedOn.push('displayName');
      }

      // Description matching
      const descLower = pkg.description.toLowerCase();
      if (descLower.includes(queryLower)) {
        matchScore += 20;
        matchedOn.push('description');
      } else if (queryWords.some(w => w.length > 2 && descLower.includes(w))) {
        matchScore += 10;
        matchedOn.push('description:word');
      }

      // Keywords matching
      try {
        const keywords = JSON.parse(pkg.keywords) as string[];
        const keywordsLower = keywords.map(k => k.toLowerCase());
        if (keywordsLower.includes(queryLower)) {
          matchScore += 40;
          matchedOn.push('keyword:exact');
        } else if (keywordsLower.some(k => k.includes(queryLower))) {
          matchScore += 20;
          matchedOn.push('keyword:partial');
        }
      } catch {
        // Ignore invalid JSON
      }

      // Author matching
      if (pkg.author.toLowerCase().includes(queryLower)) {
        matchScore += 15;
        matchedOn.push('author');
      }

      // Boost verified packages
      if (pkg.isVerified) {
        matchScore *= 1.2;
      }

      // Boost by popularity (log scale)
      const popularityBoost = Math.log10(pkg.downloads + 10) * 2;
      matchScore += popularityBoost;

      const trustScore = pkg.trustMetrics?.trustScore ?? 0;

      return {
        name: pkg.name,
        displayName: pkg.displayName,
        description: pkg.description,
        author: pkg.author,
        category: pkg.category,
        version: pkg.versions[0]?.version ?? '0.0.0',
        downloads: pkg.downloads,
        stars: pkg.stars,
        trustScore,
        isVerified: pkg.isVerified,
        matchScore,
        matchedOn,
      };
    })
    .filter((r: SearchResult) => r.matchScore > 0)
    .filter((r: SearchResult) => minTrustScore === undefined || r.trustScore >= minTrustScore)
    .sort((a: SearchResult, b: SearchResult) => b.matchScore - a.matchScore);

  return {
    results: scored.slice(offset, offset + limit),
    total: scored.length,
    query,
  };
}

/**
 * Get trending packages
 */
export async function getTrendingPackages(options: TrendingOptions = {}): Promise<SearchResult[]> {
  const { period = 'week', category, limit = 10 } = options;

  // Calculate date range
  const now = new Date();
  let since: Date;
  switch (period) {
    case 'day':
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
    default:
      since = new Date(0);
  }

  // Get deployment counts for trending calculation
  const deployments = await prisma.deployment.groupBy({
    by: ['packageName'],
    _count: { id: true },
    where: { deployedAt: { gte: since } },
    orderBy: { _count: { id: 'desc' } },
    take: limit * 2, // Get more to filter
  });

  const packageNames = deployments.map((d: { packageName: string; _count: { id: number } }) => d.packageName);

  // Fetch package details
  const packages = await prisma.intentPackage.findMany({
    where: {
      name: { in: packageNames },
      isDeprecated: false,
      ...(category && { category }),
    },
    include: {
      versions: {
        where: { isLatest: true },
        take: 1,
      },
      trustMetrics: true,
    },
  });

  // Score by recent activity
  const trendingScores = new Map(
    deployments.map((d: { packageName: string; _count: { id: number } }) => [d.packageName, d._count.id])
  );

  type TrendingPackage = IntentPackageWithRelations & {
    versions: IntentVersion[];
    trustMetrics: TrustMetrics | null;
  };

  return packages
    .map((pkg: TrendingPackage) => ({
      name: pkg.name,
      displayName: pkg.displayName,
      description: pkg.description,
      author: pkg.author,
      category: pkg.category,
      version: pkg.versions[0]?.version ?? '0.0.0',
      downloads: pkg.downloads,
      stars: pkg.stars,
      trustScore: pkg.trustMetrics?.trustScore ?? 0,
      isVerified: pkg.isVerified,
      matchScore: trendingScores.get(pkg.name) ?? 0,
      matchedOn: ['trending'],
    }))
    .sort((a: SearchResult, b: SearchResult) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

/**
 * Get packages by category
 */
export async function getPackagesByCategory(category: IntentCategory, limit = 10): Promise<SearchResult[]> {
  const packages = await prisma.intentPackage.findMany({
    where: {
      category,
      isDeprecated: false,
    },
    include: {
      versions: {
        where: { isLatest: true },
        take: 1,
      },
      trustMetrics: true,
    },
    orderBy: { downloads: 'desc' },
    take: limit,
  });

  type CategoryPackage = IntentPackageWithRelations & {
    versions: IntentVersion[];
    trustMetrics: TrustMetrics | null;
  };

  return packages.map((pkg: CategoryPackage) => ({
    name: pkg.name,
    displayName: pkg.displayName,
    description: pkg.description,
    author: pkg.author,
    category: pkg.category,
    version: pkg.versions[0]?.version ?? '0.0.0',
    downloads: pkg.downloads,
    stars: pkg.stars,
    trustScore: pkg.trustMetrics?.trustScore ?? 0,
    isVerified: pkg.isVerified,
    matchScore: pkg.downloads,
    matchedOn: ['category'],
  }));
}

/**
 * Get related packages (by keywords and category)
 */
export async function getRelatedPackages(packageName: string, limit = 5): Promise<SearchResult[]> {
  const pkg = await prisma.intentPackage.findUnique({
    where: { name: packageName },
  });

  if (!pkg) return [];

  let keywords: string[] = [];
  try {
    keywords = JSON.parse(pkg.keywords) as string[];
  } catch {
    // Ignore
  }

  // Find packages with similar keywords or same category
  const packages = await prisma.intentPackage.findMany({
    where: {
      name: { not: packageName },
      isDeprecated: false,
      OR: [
        { category: pkg.category },
        ...keywords.map(k => ({ keywords: { contains: k } })),
      ],
    },
    include: {
      versions: {
        where: { isLatest: true },
        take: 1,
      },
      trustMetrics: true,
    },
    orderBy: { downloads: 'desc' },
    take: limit * 2,
  });

  type RelatedPackage = IntentPackageWithRelations & {
    versions: IntentVersion[];
    trustMetrics: TrustMetrics | null;
  };

  // Score by similarity
  return packages
    .map((related: RelatedPackage) => {
      let score = 0;
      
      // Same category
      if (related.category === pkg.category) score += 20;

      // Keyword overlap
      try {
        const relatedKeywords = JSON.parse(related.keywords) as string[];
        const overlap = keywords.filter(k => relatedKeywords.includes(k)).length;
        score += overlap * 10;
      } catch {
        // Ignore
      }

      // Same author
      if (related.author === pkg.author) score += 5;

      return {
        name: related.name,
        displayName: related.displayName,
        description: related.description,
        author: related.author,
        category: related.category,
        version: related.versions[0]?.version ?? '0.0.0',
        downloads: related.downloads,
        stars: related.stars,
        trustScore: related.trustMetrics?.trustScore ?? 0,
        isVerified: related.isVerified,
        matchScore: score,
        matchedOn: ['related'],
      };
    })
    .sort((a: SearchResult, b: SearchResult) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

/**
 * Suggest package names for autocomplete
 */
export async function suggestPackages(prefix: string, limit = 10): Promise<string[]> {
  const packages = await prisma.intentPackage.findMany({
    where: {
      name: { startsWith: prefix.toLowerCase() },
      isDeprecated: false,
    },
    select: { name: true },
    orderBy: { downloads: 'desc' },
    take: limit,
  });

  return packages.map((p: { name: string }) => p.name);
}
