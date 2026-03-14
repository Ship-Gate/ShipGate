import { Router, Request, Response } from 'express';
import { generateBadgeSVG, BADGE_COLORS } from '../badge-svg.js';

export interface BadgeData {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  updatedAt: string;
}

const badgeStore = new Map<string, BadgeData>();

function repoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

function colorForVerdict(verdict: string): string {
  switch (verdict) {
    case 'SHIP':
      return BADGE_COLORS.green;
    case 'NO_SHIP':
      return BADGE_COLORS.red;
    default:
      return BADGE_COLORS.gray;
  }
}

function messageForData(data: BadgeData | undefined): string {
  if (!data) return 'not verified';
  return `${data.verdict} ${data.score}/100`;
}

export function badgeRouter(): Router {
  const router = Router();

  // GET /badge/:owner/:repo.svg
  router.get('/:owner/:repoFile', (req: Request, res: Response) => {
    const { owner, repoFile } = req.params;

    if (!repoFile) {
      res.status(400).json({ error: 'Missing repo parameter' });
      return;
    }

    const isSvg = repoFile.endsWith('.svg');
    const isJson = repoFile.endsWith('.json');

    if (!isSvg && !isJson) {
      res.status(400).json({ error: 'Use .svg or .json extension' });
      return;
    }

    const repo = repoFile.replace(/\.(svg|json)$/, '');
    const key = repoKey(owner!, repo);
    const data = badgeStore.get(key);

    if (isJson) {
      const verdict = data?.verdict ?? 'unknown';
      const message = messageForData(data);

      res.json({
        schemaVersion: 1,
        label: 'ShipGate',
        message,
        color: verdict === 'SHIP' ? 'brightgreen' : verdict === 'NO_SHIP' ? 'red' : 'lightgrey',
        isError: verdict === 'NO_SHIP',
      });
      return;
    }

    const verdict = data?.verdict ?? 'unknown';
    const svg = generateBadgeSVG({
      label: 'ShipGate',
      message: messageForData(data),
      color: colorForVerdict(verdict),
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(svg);
  });

  return router;
}

/**
 * Authenticated POST route for updating badge data.
 * Mount at /api/v1/badge on the main app.
 */
export function badgeUpdateRouter(authMiddleware: (req: Request, res: Response, next: () => void) => void): Router {
  const router = Router();

  router.post('/:owner/:repo', authMiddleware, (req: Request, res: Response) => {
    const { owner, repo } = req.params;
    const { verdict, score } = req.body as { verdict?: string; score?: number };

    if (!verdict || (verdict !== 'SHIP' && verdict !== 'NO_SHIP')) {
      res.status(400).json({ error: 'verdict must be "SHIP" or "NO_SHIP"' });
      return;
    }

    if (typeof score !== 'number' || score < 0 || score > 100) {
      res.status(400).json({ error: 'score must be a number between 0 and 100' });
      return;
    }

    const key = repoKey(owner!, repo!);
    const data: BadgeData = {
      verdict,
      score,
      updatedAt: new Date().toISOString(),
    };
    badgeStore.set(key, data);

    res.json({ ok: true, key, data });
  });

  return router;
}

export { badgeStore };
