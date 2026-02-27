/**
 * Audit V2 Tests
 *
 * Tests for the audit engine against fixtures/workspace1.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  auditWorkspaceV2,
  getAuditSummaryTextV2,
  detectRoutes,
  detectAuth,
  detectDatabase,
  detectWebhooks,
} from '../index.js';
import type { AuditReportV2, DetectedCandidate, RiskFlag } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_PATH = path.resolve(__dirname, '../fixtures/workspace1');

describe('Audit V2 Engine', () => {
  let report: AuditReportV2;

  beforeAll(async () => {
    report = await auditWorkspaceV2({
      workspacePath: FIXTURES_PATH,
      minConfidence: 0.4,
      includeSnippets: true,
    });
  });

  describe('Report Structure', () => {
    it('should have correct version', () => {
      expect(report.version).toBe('2.0');
    });

    it('should have a valid reportId', () => {
      expect(report.reportId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should have correct workspace path', () => {
      expect(report.workspacePath).toBe(FIXTURES_PATH);
    });

    it('should have valid timestamp', () => {
      const date = new Date(report.auditedAt);
      expect(date.getTime()).not.toBeNaN();
    });

    it('should have positive duration', () => {
      expect(report.durationMs).toBeGreaterThan(0);
    });
  });

  describe('Candidate Detection', () => {
    it('should detect candidates', () => {
      expect(report.candidates.length).toBeGreaterThan(0);
    });

    it('should detect route candidates', () => {
      const routes = report.candidates.filter(c => c.category === 'route');
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should detect auth candidates', () => {
      const auth = report.candidates.filter(c => c.category === 'auth');
      expect(auth.length).toBeGreaterThan(0);
    });

    it('should detect database candidates', () => {
      const db = report.candidates.filter(c => c.category === 'database');
      expect(db.length).toBeGreaterThan(0);
    });

    it('should detect webhook candidates', () => {
      const webhooks = report.candidates.filter(c => c.category === 'webhook');
      expect(webhooks.length).toBeGreaterThan(0);
    });

    it('should detect Next.js App Router routes', () => {
      const nextRoutes = report.candidates.filter(
        c => c.category === 'route' && c.framework === 'nextjs-app'
      );
      expect(nextRoutes.length).toBeGreaterThan(0);

      // Check specific methods
      const methods = nextRoutes.map(r => r.httpMethod);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
    });

    it('should include file paths for all candidates', () => {
      for (const candidate of report.candidates) {
        expect(candidate.filePath).toBeTruthy();
        expect(candidate.line).toBeGreaterThan(0);
      }
    });

    it('should include snippets when enabled', () => {
      const candidatesWithSnippets = report.candidates.filter(c => c.snippet);
      expect(candidatesWithSnippets.length).toBeGreaterThan(0);
    });
  });

  describe('Risk Flags', () => {
    it('should detect risk flags', () => {
      expect(report.riskFlags.length).toBeGreaterThan(0);
    });

    it('should detect route-without-auth risks', () => {
      const noAuthRisks = report.riskFlags.filter(
        r => r.category === 'route-without-auth'
      );
      expect(noAuthRisks.length).toBeGreaterThan(0);
    });

    it('should detect auth-without-rate-limit risks', () => {
      const noRateLimitRisks = report.riskFlags.filter(
        r => r.category === 'auth-without-rate-limit'
      );
      expect(noRateLimitRisks.length).toBeGreaterThan(0);
    });

    it('should detect hardcoded-secret risks', () => {
      const secretRisks = report.riskFlags.filter(
        r => r.category === 'hardcoded-secret'
      );
      expect(secretRisks.length).toBeGreaterThan(0);
    });

    it('should detect webhook-without-signature for GitHub webhook', () => {
      const webhookRisks = report.riskFlags.filter(
        r =>
          r.category === 'webhook-without-signature' &&
          r.filePath.includes('github')
      );
      expect(webhookRisks.length).toBeGreaterThan(0);
    });

    it('should NOT flag Stripe webhook with signature verification', () => {
      const stripeWebhookRisks = report.riskFlags.filter(
        r =>
          r.category === 'webhook-without-signature' &&
          r.filePath.includes('stripe')
      );
      expect(stripeWebhookRisks.length).toBe(0);
    });

    it('should include suggestions for all risk flags', () => {
      for (const risk of report.riskFlags) {
        expect(risk.suggestion).toBeTruthy();
      }
    });
  });

  describe('Behavior Mappings', () => {
    it('should create behavior mappings', () => {
      expect(report.behaviorMappings.length).toBeGreaterThan(0);
    });

    it('should group candidates by behavior', () => {
      for (const mapping of report.behaviorMappings) {
        expect(mapping.candidates.length).toBeGreaterThan(0);
        expect(mapping.behaviorName).toBeTruthy();
        expect(mapping.status).toBe('found');
      }
    });
  });

  describe('Summary', () => {
    it('should have correct total candidates', () => {
      expect(report.summary.totalCandidates).toBe(report.candidates.length);
    });

    it('should have correct total risk flags', () => {
      expect(report.summary.totalRiskFlags).toBe(report.riskFlags.length);
    });

    it('should have valid health score', () => {
      expect(report.summary.healthScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.healthScore).toBeLessThanOrEqual(100);
    });

    it('should detect frameworks', () => {
      expect(report.summary.detectedFrameworks).toContain('nextjs-app');
    });

    it('should count candidates by category', () => {
      const categorySum = Object.values(
        report.summary.candidatesByCategory
      ).reduce((sum, count) => sum + count, 0);
      expect(categorySum).toBe(report.summary.totalCandidates);
    });

    it('should count risks by severity', () => {
      const severitySum = Object.values(report.summary.risksBySeverity).reduce(
        (sum, count) => sum + count,
        0
      );
      expect(severitySum).toBe(report.summary.totalRiskFlags);
    });
  });

  describe('Text Summary', () => {
    it('should generate readable summary', () => {
      const summary = getAuditSummaryTextV2(report);
      expect(summary).toContain('ISL AUDIT REPORT V2');
      expect(summary).toContain('Health Score');
      expect(summary).toContain('Routes');
      expect(summary).toContain('Auth');
      expect(summary).toContain('Database');
    });
  });

  describe('Stability', () => {
    it('should produce stable results on repeated runs', async () => {
      const report2 = await auditWorkspaceV2({
        workspacePath: FIXTURES_PATH,
        minConfidence: 0.4,
        includeSnippets: true,
      });

      // Same number of candidates
      expect(report2.candidates.length).toBe(report.candidates.length);

      // Same number of risk flags
      expect(report2.riskFlags.length).toBe(report.riskFlags.length);

      // Same categories detected
      expect(report2.summary.candidatesByCategory).toEqual(
        report.summary.candidatesByCategory
      );
    });
  });
});

describe('Individual Detectors', () => {
  describe('Route Detector', () => {
    it('should detect Next.js App Router exports', () => {
      const content = `
export async function GET(request: Request) {
  return Response.json({ hello: 'world' });
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json({ received: body });
}
      `;

      const result = detectRoutes(content, 'app/api/test/route.ts', {});

      expect(result.candidates.length).toBe(2);
      expect(result.candidates[0]?.httpMethod).toBe('GET');
      expect(result.candidates[1]?.httpMethod).toBe('POST');
      expect(result.frameworkHints).toContain('nextjs-app');
    });

    it('should detect Express routes', () => {
      const content = `
import express from 'express';
const router = express.Router();

router.get('/users', (req, res) => {
  res.json({ users: [] });
});

router.post('/users', (req, res) => {
  res.json({ created: true });
});
      `;

      const result = detectRoutes(content, 'routes/users.ts', {});

      expect(result.candidates.length).toBe(2);
      expect(result.frameworkHints).toContain('express');
    });
  });

  describe('Auth Detector', () => {
    it('should detect JWT verification', () => {
      const content = `
import { verify } from 'jsonwebtoken';

export function verifyToken(token: string) {
  return verify(token, process.env.JWT_SECRET);
}
      `;

      const result = detectAuth(content, 'lib/auth.ts', {});

      expect(result.candidates.length).toBeGreaterThan(0);
      const jwtCandidate = result.candidates.find(
        c => c.metadata?.subCategory === 'jwt'
      );
      expect(jwtCandidate).toBeTruthy();
    });

    it('should flag auth without rate limit', () => {
      const content = `
export async function login(email: string, password: string) {
  const user = await findUser(email);
  if (!user) return null;
  
  const valid = await comparePassword(password, user.hash);
  return valid ? createToken(user) : null;
}
      `;

      const result = detectAuth(content, 'lib/auth.ts', {});

      const rateLimitRisk = result.riskFlags.find(
        r => r.category === 'auth-without-rate-limit'
      );
      expect(rateLimitRisk).toBeTruthy();
    });
  });

  describe('Database Detector', () => {
    it('should detect Prisma operations', () => {
      const content = `
const users = await prisma.user.findMany();
const user = await prisma.user.create({ data: { name: 'Test' } });
await prisma.user.delete({ where: { id: '123' } });
      `;

      const result = detectDatabase(content, 'services/userService.ts', {});

      expect(result.candidates.length).toBe(3);
      expect(result.candidates.every(c => c.metadata?.orm === 'prisma')).toBe(
        true
      );
    });

    it('should flag multiple operations without transaction', () => {
      const content = `
async function transfer() {
  await prisma.account.update({ where: { id: 'a' }, data: { balance: { decrement: 100 } } });
  await prisma.account.update({ where: { id: 'b' }, data: { balance: { increment: 100 } } });
}
      `;

      const result = detectDatabase(content, 'services/payment.ts', {});

      const noTxRisk = result.riskFlags.find(
        r => r.category === 'db-without-transaction'
      );
      expect(noTxRisk).toBeTruthy();
    });
  });

  describe('Webhook Detector', () => {
    it('should detect Stripe webhooks with signature', () => {
      const content = `
const event = stripe.webhooks.constructEvent(body, signature, secret);
      `;

      const result = detectWebhooks(content, 'api/webhooks/stripe.ts', {});

      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates[0]?.metadata?.provider).toBe('stripe');

      // Should NOT have signature risk since constructEvent is present
      const sigRisk = result.riskFlags.find(
        r => r.category === 'webhook-without-signature'
      );
      expect(sigRisk).toBeFalsy();
    });

    it('should flag webhooks without signature verification', () => {
      const content = `
export async function handleWebhook(request: Request) {
  const body = await request.json();
  // Process webhook without verifying signature
  processEvent(body);
}
      `;

      const result = detectWebhooks(content, 'api/webhooks/github.ts', {});

      const sigRisk = result.riskFlags.find(
        r => r.category === 'webhook-without-signature'
      );
      expect(sigRisk).toBeTruthy();
    });
  });
});
