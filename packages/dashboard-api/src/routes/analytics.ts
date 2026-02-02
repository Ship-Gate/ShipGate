import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client';

const router = Router();

interface OverviewStats {
  domains: {
    total: number;
    verified: number;
    failed: number;
    pending: number;
    outdated: number;
  };
  verifications: {
    total: number;
    passed: number;
    failed: number;
    running: number;
    pending: number;
    averageDuration: number | null;
    averageCoverage: number | null;
  };
  tests: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
  };
  recentActivity: Array<{
    id: string;
    type: 'verification' | 'domain';
    action: string;
    domainName: string;
    timestamp: Date;
    status: string;
  }>;
  trustScoreDistribution: {
    high: number;    // 80-100
    medium: number;  // 50-79
    low: number;     // 0-49
    unknown: number;
  };
}

/**
 * GET /api/analytics/overview
 * Get dashboard overview statistics.
 */
router.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Fetch all stats in parallel
    const [
      domainCounts,
      verificationCounts,
      verificationStats,
      testCounts,
      recentVerifications,
      recentDomains,
      trustScores,
    ] = await Promise.all([
      // Domain counts by status
      prisma.domain.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      
      // Verification counts by status
      prisma.verification.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      
      // Verification aggregate stats
      prisma.verification.aggregate({
        _avg: { duration: true, coverage: true },
        _count: { id: true },
      }),
      
      // Test result counts by status
      prisma.testResult.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      
      // Recent verifications
      prisma.verification.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { domain: { select: { name: true } } },
      }),
      
      // Recent domains
      prisma.domain.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      
      // Trust score distribution
      prisma.domain.findMany({
        select: { trustScore: true },
      }),
    ]);

    // Process domain counts
    const domainStats = {
      total: 0,
      verified: 0,
      failed: 0,
      pending: 0,
      outdated: 0,
    };
    for (const item of domainCounts) {
      const count = item._count.status;
      domainStats.total += count;
      switch (item.status) {
        case 'VERIFIED': domainStats.verified = count; break;
        case 'FAILED': domainStats.failed = count; break;
        case 'PENDING': domainStats.pending = count; break;
        case 'OUTDATED': domainStats.outdated = count; break;
      }
    }

    // Process verification counts
    const verificationStatsResult = {
      total: verificationStats._count.id ?? 0,
      passed: 0,
      failed: 0,
      running: 0,
      pending: 0,
      averageDuration: verificationStats._avg.duration ?? null,
      averageCoverage: verificationStats._avg.coverage ?? null,
    };
    for (const item of verificationCounts) {
      const count = item._count.status;
      switch (item.status) {
        case 'PASSED': verificationStatsResult.passed = count; break;
        case 'FAILED': verificationStatsResult.failed = count; break;
        case 'RUNNING': verificationStatsResult.running = count; break;
        case 'PENDING': verificationStatsResult.pending = count; break;
      }
    }

    // Process test counts
    const testStats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: 0,
    };
    for (const item of testCounts) {
      const count = item._count.status;
      testStats.total += count;
      switch (item.status) {
        case 'PASSED': testStats.passed = count; break;
        case 'FAILED': testStats.failed = count; break;
        case 'SKIPPED': testStats.skipped = count; break;
      }
    }
    testStats.passRate = testStats.total > 0 
      ? (testStats.passed / (testStats.passed + testStats.failed)) * 100 
      : 0;

    // Process recent activity
    const recentActivity: OverviewStats['recentActivity'] = [
      ...(recentVerifications as Array<{ id: string; status: string; domain?: { name: string }; updatedAt: Date }>).map((v) => ({
        id: v.id,
        type: 'verification' as const,
        action: v.status === 'RUNNING' ? 'started' : v.status === 'PASSED' || v.status === 'FAILED' ? 'completed' : 'created',
        domainName: v.domain?.name ?? 'Unknown',
        timestamp: v.updatedAt,
        status: v.status,
      })),
      ...(recentDomains as Array<{ id: string; name: string; createdAt: Date; status: string }>).map((d) => ({
        id: d.id,
        type: 'domain' as const,
        action: 'created',
        domainName: d.name,
        timestamp: d.createdAt,
        status: d.status,
      })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);

    // Process trust score distribution
    const trustScoreDistribution = {
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
    };
    for (const domain of trustScores) {
      if (domain.trustScore === null) {
        trustScoreDistribution.unknown++;
      } else if (domain.trustScore >= 80) {
        trustScoreDistribution.high++;
      } else if (domain.trustScore >= 50) {
        trustScoreDistribution.medium++;
      } else {
        trustScoreDistribution.low++;
      }
    }

    const overview: OverviewStats = {
      domains: domainStats,
      verifications: verificationStatsResult,
      tests: testStats,
      recentActivity,
      trustScoreDistribution,
    };

    res.json(overview);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/trends
 * Get verification trends over time.
 */
router.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const verifications = await prisma.verification.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        status: true,
        passedTests: true,
        failedTests: true,
        coverage: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const dailyStats: Record<string, {
      date: string;
      total: number;
      passed: number;
      failed: number;
      avgCoverage: number[];
    }> = {};

    for (const v of verifications) {
      const dateKey = v.createdAt.toISOString().split('T')[0]!;
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          date: dateKey,
          total: 0,
          passed: 0,
          failed: 0,
          avgCoverage: [],
        };
      }
      const stats = dailyStats[dateKey]!;
      stats.total++;
      if (v.status === 'PASSED') stats.passed++;
      if (v.status === 'FAILED') stats.failed++;
      if (v.coverage !== null) stats.avgCoverage.push(v.coverage);
    }

    const trends = Object.values(dailyStats).map(day => ({
      date: day.date,
      total: day.total,
      passed: day.passed,
      failed: day.failed,
      passRate: day.total > 0 ? (day.passed / day.total) * 100 : 0,
      avgCoverage: day.avgCoverage.length > 0
        ? day.avgCoverage.reduce((a, b) => a + b, 0) / day.avgCoverage.length
        : null,
    }));

    res.json({ days, trends });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/domains/:id
 * Get analytics for a specific domain.
 */
router.get('/domains/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        _count: { select: { verifications: true } },
      },
    });

    if (!domain) {
      res.status(404).json({
        error: 'Not Found',
        message: `Domain not found: ${id}`,
      });
      return;
    }

    const [verificationStats, recentVerifications, testStats] = await Promise.all([
      prisma.verification.aggregate({
        where: { domainId: id },
        _avg: { duration: true, coverage: true },
        _count: { id: true },
      }),
      prisma.verification.findMany({
        where: { domainId: id },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          passedTests: true,
          failedTests: true,
          coverage: true,
          duration: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.testResult.groupBy({
        by: ['status'],
        where: { verification: { domainId: id } },
        _count: { status: true },
      }),
    ]);

    const testCounts = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };
    for (const item of testStats) {
      const count = item._count.status;
      testCounts.total += count;
      switch (item.status) {
        case 'PASSED': testCounts.passed = count; break;
        case 'FAILED': testCounts.failed = count; break;
        case 'SKIPPED': testCounts.skipped = count; break;
      }
    }

    res.json({
      domain: {
        id: domain.id,
        name: domain.name,
        status: domain.status,
        trustScore: domain.trustScore,
        verificationCount: (domain as unknown as { _count?: { verifications: number } })._count?.verifications ?? 0,
      },
      averageDuration: verificationStats._avg.duration,
      averageCoverage: verificationStats._avg.coverage,
      totalVerifications: verificationStats._count.id,
      tests: testCounts,
      recentVerifications,
    });
  } catch (error) {
    next(error);
  }
});

export const analyticsRouter: Router = router;
