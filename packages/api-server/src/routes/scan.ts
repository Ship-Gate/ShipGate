import { Hono } from 'hono';
import { z } from 'zod';

export const ScanRequestSchema = z.object({
  source: z.string().min(1, 'source is required'),
  language: z.string().optional().default('typescript'),
  checks: z.array(z.string()).optional(),
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;

const FindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  message: z.string(),
  category: z.string().optional(),
  source: z.string().optional(),
});

export const ScanResponseSchema = z.object({
  findings: z.array(FindingSchema),
  summary: z.object({
    total: z.number(),
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
});

const app = new Hono();

app.post('/api/v1/scan', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ScanRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        400,
      );
    }

    const { source, language, checks } = parsed.data;

    const allFindings: Array<{
      id: string;
      title: string;
      severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
      message: string;
      category?: string;
      source?: string;
    }> = [];

    const enabledChecks = checks ?? ['security', 'taint', 'hallucination'];

    if (enabledChecks.includes('security')) {
      try {
        const { scanSource } = await import('@isl-lang/security-scanner');
        const supportedLangs = ['typescript', 'python', 'go', 'java'] as const;
        type SupportedLang = (typeof supportedLangs)[number];
        const lang: SupportedLang = (supportedLangs as readonly string[]).includes(language)
          ? (language as SupportedLang)
          : 'typescript';

        const findings = scanSource(source, lang);
        for (const f of findings) {
          allFindings.push({
            id: f.id,
            title: f.title,
            severity: f.severity,
            message: f.message,
            category: f.category,
            source: 'security-scanner',
          });
        }
      } catch {
        /* scanner not available */
      }
    }

    if (enabledChecks.includes('taint')) {
      try {
        const { TaintAnalyzer } = await import('@isl-lang/taint-tracker');
        const analyzer = new TaintAnalyzer();
        const taintFindings = analyzer.analyze(source);
        for (const f of taintFindings) {
          allFindings.push({
            id: `TAINT-${f.sinkCategory}`,
            title: `Taint flow: ${f.sourceCategory} → ${f.sinkCategory}`,
            severity: f.severity,
            message: `Unsanitized data flows from ${f.sourceCategory} source to ${f.sinkCategory} sink`,
            category: 'taint-analysis',
            source: 'taint-tracker',
          });
        }
      } catch {
        /* taint tracker not available */
      }
    }

    if (enabledChecks.includes('hallucination')) {
      try {
        const { HallucinationDetector, toFindings } = await import(
          '@isl-lang/hallucination-scanner'
        );
        const detector = new HallucinationDetector();
        const halResult = detector.scan(source);
        const halFindings = toFindings(halResult);
        for (const f of halFindings) {
          allFindings.push({
            id: f.id ?? 'HAL-UNKNOWN',
            title: f.title ?? 'Hallucination detected',
            severity: f.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
            message: f.message,
            category: f.category ?? 'hallucination',
            source: 'hallucination-scanner',
          });
        }
      } catch {
        /* hallucination scanner not available */
      }
    }

    const summary = {
      total: allFindings.length,
      critical: allFindings.filter((f) => f.severity === 'critical').length,
      high: allFindings.filter((f) => f.severity === 'high').length,
      medium: allFindings.filter((f) => f.severity === 'medium').length,
      low: allFindings.filter((f) => f.severity === 'low').length,
    };

    return c.json({ findings: allFindings, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return c.json({ error: message }, 500);
  }
});

export default app;
