import { Hono } from 'hono';
import { z } from 'zod';

export const GateRequestSchema = z.object({
  files: z.array(
    z.object({
      path: z.string().min(1),
      content: z.string(),
    }),
  ).min(1, 'At least one file is required'),
  projectRoot: z.string().optional(),
});

export type GateRequest = z.infer<typeof GateRequestSchema>;

export const SignalSchema = z.object({
  source: z.string(),
  check: z.string(),
  result: z.enum(['pass', 'fail', 'warn', 'skip']),
  confidence: z.number(),
  details: z.string(),
});

export const GateResponseSchema = z.object({
  verdict: z.enum(['SHIP', 'WARN', 'NO_SHIP']),
  score: z.number().min(0).max(100),
  signals: z.array(SignalSchema),
  evidence: z.array(
    z.object({
      source: z.string(),
      check: z.string(),
      result: z.enum(['pass', 'fail', 'warn', 'skip']),
      confidence: z.number(),
      details: z.string(),
    }),
  ),
});

const app = new Hono();

app.post('/api/v1/gate', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = GateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        400,
      );
    }

    const { files, projectRoot } = parsed.data;

    const { runSpeclessChecks } = await import('@isl-lang/gate');

    const context = {
      projectRoot: projectRoot ?? '/tmp/shipgate-api',
      implementation: files.map((f) => f.content).join('\n'),
      specOptional: true,
    };

    const allEvidence: Array<{
      source: string;
      check: string;
      result: 'pass' | 'fail' | 'warn' | 'skip';
      confidence: number;
      details: string;
    }> = [];

    for (const file of files) {
      try {
        const evidence = await runSpeclessChecks(file.path, context);
        allEvidence.push(...evidence);
      } catch {
        allEvidence.push({
          source: 'specless-scanner',
          check: file.path,
          result: 'skip',
          confidence: 0,
          details: `Skipped: scanner error for ${file.path}`,
        });
      }
    }

    const failures = allEvidence.filter((e) => e.result === 'fail');
    const warnings = allEvidence.filter((e) => e.result === 'warn');
    const passes = allEvidence.filter((e) => e.result === 'pass');

    const total = allEvidence.filter((e) => e.result !== 'skip').length;
    const score = total === 0
      ? 100
      : Math.round(((passes.length + warnings.length * 0.5) / total) * 100);

    let verdict: 'SHIP' | 'WARN' | 'NO_SHIP';
    if (failures.length > 0) {
      verdict = 'NO_SHIP';
    } else if (warnings.length > 0 || score < 80) {
      verdict = 'WARN';
    } else {
      verdict = 'SHIP';
    }

    return c.json({
      verdict,
      score,
      signals: allEvidence.map((e) => ({
        source: e.source,
        check: e.check,
        result: e.result,
        confidence: e.confidence,
        details: e.details,
      })),
      evidence: allEvidence.map((e) => ({
        source: e.source,
        check: e.check,
        result: e.result,
        confidence: e.confidence,
        details: e.details,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

export default app;
