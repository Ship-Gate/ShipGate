/**
 * HallucinationDetector tests with real AI-generated hallucinated code samples
 *
 * These samples are based on common hallucinations from Cursor, Copilot, and Claude.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { HallucinationDetector, toFindings } from '../src/ts/hallucination-detector.js';

const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');
const HALLUCINATION_FIXTURES = path.join(FIXTURES, 'hallucination');

async function ensureFixtures() {
  try {
    await fs.mkdir(HALLUCINATION_FIXTURES, { recursive: true });
  } catch {
    // exists
  }
}

describe('HallucinationDetector', () => {
  describe('Phantom API Hallucinations', () => {
    it('detects prisma.user.findByEmail() — Prisma has no findByEmail', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'prisma-hallucination.ts');
      await fs.writeFile(
        file,
        `import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const user = await prisma.user.findByEmail('test@example.com');
`,
        'utf-8'
      );

      const detector = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
        readFile: (p) => fs.readFile(p, 'utf-8'),
        fileExists: async (p) => {
          try {
            await fs.access(p);
            return true;
          } catch {
            return false;
          }
        },
      });

      const result = await detector.scan();
      const phantomFindings = result.findings.filter((f) => f.category === 'phantom_api');
      expect(phantomFindings.length).toBeGreaterThanOrEqual(1);
      expect(phantomFindings.some((f) => f.message.includes('findByEmail'))).toBe(true);
    });

    it('detects stripe.charges.create() — deprecated', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'stripe-hallucination.ts');
      await fs.writeFile(
        file,
        `import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_KEY!);
const charge = await stripe.charges.create({ amount: 1000, currency: 'usd' });
`,
        'utf-8'
      );

      const detector = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
      });

      const result = await detector.scan();
      const phantomFindings = result.findings.filter((f) => f.category === 'phantom_api');
      expect(phantomFindings.some((f) => f.message.toLowerCase().includes('charges'))).toBe(true);
    });
  });

  describe('Hallucinated Environment Variables', () => {
    it('flags process.env.UNDEFINED_VAR when not in .env', async () => {
      await ensureFixtures();
      const dir = path.join(HALLUCINATION_FIXTURES, 'env-test');
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, 'index.ts');
      await fs.writeFile(
        file,
        `const apiKey = process.env.UNDEFINED_VAR;
export default apiKey;
`,
        'utf-8'
      );
      // No .env file with UNDEFINED_VAR

      const detector = new HallucinationDetector({
        projectRoot: dir,
        entries: [file],
      });

      const result = await detector.scan();
      const envFindings = result.findings.filter((f) => f.category === 'env_var_undefined');
      expect(envFindings.some((f) => f.message.includes('UNDEFINED_VAR'))).toBe(true);
    });

    it('does not flag process.env.VAR when defined in .env.example', async () => {
      await ensureFixtures();
      const dir = path.join(HALLUCINATION_FIXTURES, 'env-defined');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, '.env.example'), 'API_KEY=your_key_here\n', 'utf-8');
      await fs.writeFile(
        path.join(dir, 'index.ts'),
        `const key = process.env.API_KEY;
`,
        'utf-8'
      );

      const detector = new HallucinationDetector({
        projectRoot: dir,
        entries: [path.join(dir, 'index.ts')],
      });

      const result = await detector.scan();
      const envFindings = result.findings.filter((f) => f.category === 'env_var_undefined');
      expect(envFindings.some((f) => f.message.includes('API_KEY'))).toBe(false);
    });
  });

  describe('Confident But Wrong Patterns', () => {
    it('detects == instead of ===', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'loose-eq.ts');
      await fs.writeFile(
        file,
        `if (x == null) return;
`,
        'utf-8'
      );

      const detector = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
      });

      const result = await detector.scan();
      expect(result.findings.some((f) => f.category === 'loose_equality')).toBe(true);
    });

    it('detects JSON.parse without try/catch', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'json-parse.ts');
      await fs.writeFile(
        file,
        `const data = JSON.parse(req.body);
`,
        'utf-8'
      );

      const detector = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
      });

      const result = await detector.scan();
      expect(result.findings.some((f) => f.category === 'json_parse_unsafe')).toBe(true);
    });

    it('detects Array.find() chained without null check', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'array-find.ts');
      await fs.writeFile(
        file,
        `const user = users.find(u => u.id === id).name;
`,
        'utf-8'
      );

      const detector = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
      });

      const result = await detector.scan();
      expect(result.findings.some((f) => f.category === 'array_find_unsafe')).toBe(true);
    });

    it('detects empty catch block', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'silent-catch.ts');
      await fs.writeFile(
        file,
        `try {
  await fetch(url);
} catch (e) {}
`,
        'utf-8'
      );

      const detector = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
      });

      const result = await detector.scan();
      expect(result.findings.some((f) => f.category === 'silent_catch')).toBe(true);
    });
  });

  describe('Copy-Paste Artifacts', () => {
    it('detects TODO placeholder', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'placeholder-todo.ts');
      await fs.writeFile(
        file,
        `// TODO: implement this
const x = 1;
`,
        'utf-8'
      );

      const detector = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
      });

      const result = await detector.scan();
      expect(result.findings.some((f) => f.category === 'placeholder_text')).toBe(true);
    });

    it('detects {{variable}} template syntax', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'template-var.ts');
      await fs.writeFile(
        file,
        `const url = 'https://api.example.com/{{userId}}';
`,
        'utf-8'
      );

      const detector = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
      });

      const result = await detector.scan();
      expect(result.findings.some((f) => f.category === 'template_variable')).toBe(true);
    });

    it('detects example.com in URL', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'example-url.ts');
      await fs.writeFile(
        file,
        `const apiUrl = 'https://example.com/api';
`,
        'utf-8'
      );

      const detector = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
      });

      const result = await detector.scan();
      expect(result.findings.some((f) => f.category === 'placeholder_text' && f.raw?.includes('example.com'))).toBe(true);
    });
  });

  describe('Stale/Deprecated Patterns', () => {
    it('detects componentDidMount in function component context', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'react-class.ts');
      await fs.writeFile(
        file,
        `function MyComponent() {
  componentDidMount() {
    console.log('mounted');
  }
  return <div />;
}
`,
        'utf-8'
      );

      const detector = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
      });

      const result = await detector.scan();
      expect(result.findings.some((f) => f.category === 'stale_pattern' || f.category === 'phantom_api')).toBe(true);
    });

    it('detects app.use(bodyParser())', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'express-bodyparser.ts');
      await fs.writeFile(
        file,
        `import express from 'express';
const app = express();
app.use(bodyParser());
`,
        'utf-8'
      );

      const detector = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
      });

      const result = await detector.scan();
      expect(result.findings.some((f) => f.message.toLowerCase().includes('bodyparser'))).toBe(true);
    });
  });

  describe('toFindings conversion', () => {
    it('converts HallucinationFinding[] to Finding[] format', () => {
      const hallucinationFindings = [
        {
          category: 'phantom_api' as const,
          severity: 'critical' as const,
          message: 'Prisma has no findByEmail',
          suggestion: 'Use findUnique',
          file: '/src/db.ts',
          line: 5,
          column: 10,
          snippet: 'prisma.user.findByEmail()',
          raw: 'findByEmail',
        },
      ];
      const findings = toFindings(hallucinationFindings);
      expect(findings).toHaveLength(1);
      expect(findings[0]).toMatchObject({
        checker: 'hallucination-detector',
        ruleId: 'phantom_api',
        severity: 'critical',
        message: 'Prisma has no findByEmail',
        file: '/src/db.ts',
        line: 5,
        column: 10,
        blocking: true,
        recommendation: 'Use findUnique',
      });
      expect(findings[0]!.id).toContain('hallucination');
    });
  });

  describe('Custom rules', () => {
    it('runs custom rules when provided', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'custom-rule-test.ts');
      await fs.writeFile(file, `const x = 1;\n`, 'utf-8');

      const customRule = {
        id: 'custom-no-magic',
        name: 'No magic numbers',
        run(ctx: { source: string; file: string }) {
          const findings: Array<{ ruleId: string; category: string; severity: 'low'; message: string; file: string; line: number; column: number }> = [];
          if (ctx.source.includes('= 1')) {
            findings.push({
              ruleId: 'custom-no-magic',
              category: 'custom',
              severity: 'low',
              message: 'Magic number 1 detected',
              file: ctx.file,
              line: 1,
              column: 1,
            });
          }
          return findings;
        },
      };

      const detector = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
        customRules: [customRule as import('../src/ts/hallucination-rules.js').HallucinationRule],
      });

      const result = await detector.scan();
      expect(result.findings.some((f) => f.message.includes('Magic number'))).toBe(true);
    });
  });

  describe('Rule sets', () => {
    it('loads only specified rule sets when ruleSets provided', async () => {
      await ensureFixtures();
      const file = path.join(HALLUCINATION_FIXTURES, 'rule-set-test.ts');
      await fs.writeFile(
        file,
        `const x = process.env.UNKNOWN_VAR;
if (x == 1) return;
`,
        'utf-8'
      );

      const detectorAll = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
      });

      const detectorEnvOnly = new HallucinationDetector({
        projectRoot: HALLUCINATION_FIXTURES,
        entries: [file],
        ruleSets: ['env-vars'],
      });

      const resultAll = await detectorAll.scan();
      const resultEnvOnly = await detectorEnvOnly.scan();

      expect(resultAll.findings.length).toBeGreaterThanOrEqual(resultEnvOnly.findings.length);
    });
  });
});
