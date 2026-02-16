import { Router, type Request, type Response } from 'express';
import type { Queries } from '../db/queries.js';
import type { VerificationReport } from '../types.js';

/**
 * Dashboard routes — aggregated views consumed by dashboard-web.
 *
 * GET /dashboard/stats
 * GET /domains
 * GET /domains/:id
 * GET /domains/:id/behaviors
 * GET /domains/:id/verifications
 * GET /verifications
 * GET /verifications/:id
 */
export function dashboardRouter(queries: Queries): Router {
  const router = Router();

  // ── GET /dashboard/stats ──────────────────────────────────────────────
  router.get('/dashboard/stats', (_req: Request, res: Response) => {
    const { reports, total } = queries.listReports({ page: 1, limit: 1000 });

    const repos = new Set(reports.map(r => r.repo));
    const totalDomains = repos.size;

    // Count behaviors: distinct file paths across all reports
    const allFiles = new Set<string>();
    for (const r of reports) {
      for (const f of r.files) allFiles.add(f.path);
    }
    const totalBehaviors = allFiles.size;

    const avgScore = reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + r.score, 0) / reports.length)
      : 0;

    // Passing/failing domains based on latest report per repo
    const latestByRepo = new Map<string, VerificationReport>();
    for (const r of reports) {
      const existing = latestByRepo.get(r.repo);
      if (!existing || r.timestamp > existing.timestamp) {
        latestByRepo.set(r.repo, r);
      }
    }

    let passingDomains = 0;
    let failingDomains = 0;
    for (const r of latestByRepo.values()) {
      if (r.verdict === 'SHIP') passingDomains++;
      else failingDomains++;
    }

    // Recent verifications (last 5)
    const recent = reports.slice(0, 5).map(reportToVerification);

    // Score history — average score per day (last 7 days)
    const dayScores = new Map<string, { sum: number; count: number }>();
    for (const r of reports) {
      const day = r.timestamp.slice(0, 10);
      const entry = dayScores.get(day) || { sum: 0, count: 0 };
      entry.sum += r.score;
      entry.count++;
      dayScores.set(day, entry);
    }
    const trustScoreHistory = Array.from(dayScores.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([date, { sum, count }]) => ({
        date,
        score: Math.round((sum / count / 100) * 100) / 100, // normalize to 0-1
      }));

    res.json({
      totalDomains,
      totalBehaviors,
      totalVerifications: total,
      averageTrustScore: avgScore / 100, // normalize to 0-1
      passingDomains,
      failingDomains,
      recentVerifications: recent,
      trustScoreHistory,
    });
  });

  // ── GET /domains ──────────────────────────────────────────────────────
  router.get('/domains', (_req: Request, res: Response) => {
    const { reports } = queries.listReports({ page: 1, limit: 1000 });
    const domainsMap = buildDomainsFromReports(reports);
    res.json(Array.from(domainsMap.values()));
  });

  // ── GET /domains/:id ──────────────────────────────────────────────────
  router.get('/domains/:id', (req: Request, res: Response) => {
    const { reports } = queries.listReports({ repo: req.params['id'], page: 1, limit: 1000 });
    if (reports.length === 0) {
      res.status(404).json({ ok: false, error: 'Domain not found' });
      return;
    }
    const domainsMap = buildDomainsFromReports(reports);
    const domain = domainsMap.get(req.params['id']!);
    if (!domain) {
      res.status(404).json({ ok: false, error: 'Domain not found' });
      return;
    }
    res.json(domain);
  });

  // ── GET /domains/:id/behaviors ────────────────────────────────────────
  router.get('/domains/:id/behaviors', (req: Request, res: Response) => {
    const { reports } = queries.listReports({ repo: req.params['id'], page: 1, limit: 1000 });
    if (reports.length === 0) {
      res.json([]);
      return;
    }

    // Derive behaviors from file results across reports
    const fileMap = new Map<string, { path: string; verdicts: string[]; methods: string[] }>();
    for (const r of reports) {
      for (const f of r.files) {
        const entry = fileMap.get(f.path) || { path: f.path, verdicts: [], methods: [] };
        entry.verdicts.push(f.verdict);
        entry.methods.push(f.method);
        fileMap.set(f.path, entry);
      }
    }

    const behaviors = Array.from(fileMap.entries()).map(([path, info], idx) => ({
      id: `${req.params['id']}-${idx}`,
      name: path.split('/').pop() || path,
      description: `File: ${path}`,
      domainId: req.params['id'],
      preconditions: [] as string[],
      postconditions: [] as string[],
      testCount: info.verdicts.length,
    }));

    res.json(behaviors);
  });

  // ── GET /domains/:id/verifications ────────────────────────────────────
  router.get('/domains/:id/verifications', (req: Request, res: Response) => {
    const { reports } = queries.listReports({ repo: req.params['id'], page: 1, limit: 100 });
    res.json(reports.map(reportToVerification));
  });

  // ── GET /verifications ────────────────────────────────────────────────
  router.get('/verifications', (_req: Request, res: Response) => {
    const { reports } = queries.listReports({ page: 1, limit: 100 });
    res.json(reports.map(reportToVerification));
  });

  // ── GET /verifications/:id ────────────────────────────────────────────
  router.get('/verifications/:id', (req: Request, res: Response) => {
    const report = queries.getReport(req.params['id']!);
    if (!report) {
      res.status(404).json({ ok: false, error: 'Verification not found' });
      return;
    }
    res.json(reportToVerification(report));
  });

  return router;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function reportToVerification(r: VerificationReport) {
  const passing = r.files.filter(f => f.verdict === 'pass').length;
  const total = r.files.length;

  return {
    id: r.id,
    domainId: r.repo,
    domainName: r.repo,
    timestamp: r.timestamp,
    duration: r.duration,
    verdict: mapVerdict(r.verdict),
    trustScore: r.score / 100,
    coverage: {
      behaviors: passing,
      totalBehaviors: total,
      preconditions: r.coverage.specced,
      totalPreconditions: r.coverage.total,
      postconditions: r.coverage.specced,
      totalPostconditions: r.coverage.total,
    },
    results: [],
  };
}

function mapVerdict(v: string): 'pass' | 'fail' | 'partial' | 'error' {
  switch (v) {
    case 'SHIP': return 'pass';
    case 'WARN': return 'partial';
    case 'NO_SHIP': return 'fail';
    default: return 'error';
  }
}

function buildDomainsFromReports(reports: VerificationReport[]) {
  const domainsMap = new Map<string, {
    id: string;
    name: string;
    description: string;
    behaviorCount: number;
    lastVerified: string | null;
    trustScore: number;
    status: 'verified' | 'failing' | 'pending' | 'unknown';
  }>();

  for (const r of reports) {
    const existing = domainsMap.get(r.repo);
    const isNewer = !existing || (existing.lastVerified && r.timestamp > existing.lastVerified);

    if (!existing) {
      domainsMap.set(r.repo, {
        id: r.repo,
        name: r.repo,
        description: `Repository: ${r.repo}`,
        behaviorCount: r.files.length,
        lastVerified: r.timestamp,
        trustScore: r.score / 100,
        status: r.verdict === 'SHIP' ? 'verified' : r.verdict === 'WARN' ? 'verified' : 'failing',
      });
    } else if (isNewer) {
      existing.lastVerified = r.timestamp;
      existing.trustScore = r.score / 100;
      existing.behaviorCount = Math.max(existing.behaviorCount, r.files.length);
      existing.status = r.verdict === 'SHIP' ? 'verified' : r.verdict === 'WARN' ? 'verified' : 'failing';
    }
  }

  return domainsMap;
}
