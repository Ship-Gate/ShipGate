/**
 * Ship Audit Route
 *
 * POST /api/v1/ship-audit   — run the full specless gate pipeline and return
 *                             a structured SHIP / WARN / NO_SHIP verdict
 *                             with categorised findings.
 */

import { Hono } from 'hono';

const shipAuditRoutes = new Hono();

shipAuditRoutes.post('/api/v1/ship-audit', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Request body required' }, 422);

  const projectPath: string = body.projectPath ?? process.cwd();
  const threshold: number = typeof body.threshold === 'number' ? body.threshold : 70;

  try {
    const { gate } = await import('@isl-lang/gate');

    const gateResult = await gate({
      path: projectPath,
      mode: 'specless',
      threshold,
    });

    const violations: Array<{ category: string; severity: string; message: string }> =
      (gateResult.violations ?? []).map((v: string) => {
        const category = v.includes('security') || v.includes('auth') || v.includes('secret')
          ? 'security'
          : v.includes('phantom') || v.includes('hallucin')
          ? 'hallucination'
          : v.includes('mock') || v.includes('fake')
          ? 'fake_feature'
          : 'general';

        const severity = v.startsWith('critical') || v.startsWith('security_violation')
          ? 'critical'
          : v.startsWith('warn')
          ? 'warning'
          : 'error';

        return { category, severity, message: v };
      });

    const byCategory: Record<string, number> = {};
    for (const v of violations) {
      byCategory[v.category] = (byCategory[v.category] ?? 0) + 1;
    }

    return c.json({
      success: true,
      verdict: gateResult.verdict ?? 'NO_SHIP',
      score: gateResult.score ?? 0,
      threshold,
      violations,
      violationsByCategory: byCategory,
      safeToShip: (gateResult.verdict ?? 'NO_SHIP') === 'SHIP',
    });
  } catch (err) {
    return c.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});

export default shipAuditRoutes;
