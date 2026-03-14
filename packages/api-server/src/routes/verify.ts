import { Hono } from 'hono';
import { z } from 'zod';

export const VerifyRequestSchema = z.object({
  source: z.string().min(1, 'source is required'),
  language: z.string().min(1, 'language is required'),
  spec: z.string().optional(),
});

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

export const VerifyResponseSchema = z.object({
  verdict: z.enum(['SHIP', 'NO_SHIP']),
  score: z.number().min(0).max(100),
  findings: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
      message: z.string(),
      category: z.string().optional(),
    }),
  ),
  proofMethod: z.string().optional(),
});

const app = new Hono();

app.post('/api/v1/verify', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = VerifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        400,
      );
    }

    const { source, language, spec } = parsed.data;

    const { scanSource } = await import('@isl-lang/security-scanner');

    const supportedLangs = ['typescript', 'python', 'go', 'java'] as const;
    type SupportedLang = (typeof supportedLangs)[number];
    const lang: SupportedLang = (supportedLangs as readonly string[]).includes(language)
      ? (language as SupportedLang)
      : 'typescript';

    const securityFindings = scanSource(source, lang);

    let specResult: { success: boolean; domain?: { name: string } } | undefined;
    if (spec) {
      const { parseISL } = await import('@shipgate/sdk');
      specResult = parseISL(spec);
    }

    const findings = securityFindings.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      message: f.message,
      category: f.category,
    }));

    const criticalCount = findings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high',
    ).length;

    const score = Math.max(0, 100 - criticalCount * 20 - (findings.length - criticalCount) * 5);

    const verdict = score >= 80 && criticalCount === 0 ? 'SHIP' : 'NO_SHIP';

    return c.json({
      verdict,
      score,
      findings,
      proofMethod: specResult?.success ? 'isl-spec-verified' : 'static-analysis',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

export default app;
