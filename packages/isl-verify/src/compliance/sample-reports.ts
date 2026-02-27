/**
 * Sample Compliance Reports
 * 
 * Example proof bundles and generated compliance reports for demonstration
 */

import type { ProofBundle } from '../proof/types.js';
import type { ComplianceReport } from './compliance-report-generator.js';
import { ComplianceReportGenerator } from './compliance-report-generator.js';

/**
 * Sample proof bundle with all properties proven
 */
export const SAMPLE_PROOF_BUNDLE_COMPLIANT: ProofBundle = {
  version: '2.0',
  projectName: 'acme-payment-api',
  timestamp: '2026-02-17T16:00:00.000Z',
  properties: [
    {
      property: 'auth-coverage',
      status: 'PROVEN',
      summary: 'All 23 protected endpoints enforce JWT authentication middleware',
      evidence: [
        {
          file: 'src/routes/payments.ts',
          line: 15,
          routePath: '/api/payments',
          authMethod: 'JWT via jose',
          verified: true,
          context: 'router.post("/api/payments", authMiddleware, paymentsController.create)',
        },
        {
          file: 'src/routes/users.ts',
          line: 12,
          routePath: '/api/users/me',
          authMethod: 'JWT via jose',
          verified: true,
          context: 'router.get("/api/users/me", authMiddleware, usersController.profile)',
        },
      ],
      findings: [],
      method: 'static-ast-analysis',
      confidence: 'definitive',
      duration_ms: 145,
    },
    {
      property: 'type-safety',
      status: 'PROVEN',
      summary: 'TypeScript strict mode passes. 156/156 functions typed.',
      evidence: [
        {
          file: 'src/controllers/payments.ts',
          totalFunctions: 8,
          typedFunctions: 8,
          strictMode: true,
          anyCount: 0,
          typeAssertions: 0,
        },
        {
          file: 'src/models/user.ts',
          totalFunctions: 12,
          typedFunctions: 12,
          strictMode: true,
          anyCount: 0,
          typeAssertions: 0,
        },
      ],
      findings: [],
      method: 'tsc-validation',
      confidence: 'definitive',
      duration_ms: 2340,
    },
    {
      property: 'error-handling',
      status: 'PROVEN',
      summary: 'All 23 route handlers have error boundaries. No stack traces exposed.',
      evidence: [
        {
          file: 'src/routes/payments.ts',
          line: 15,
          handler: 'paymentsController.create',
          wrapped: true,
          exposesStack: false,
          context: 'try-catch with sanitized error response',
        },
      ],
      findings: [],
      method: 'static-ast-analysis',
      confidence: 'high',
      duration_ms: 180,
    },
    {
      property: 'secret-exposure',
      status: 'PROVEN',
      summary: 'No hardcoded secrets detected. Scanned 47 files.',
      evidence: [],
      findings: [],
      method: 'pattern-matching',
      confidence: 'high',
      duration_ms: 95,
    },
    {
      property: 'sql-injection',
      status: 'PROVEN',
      summary: 'All 18 database queries use parameterized statements.',
      evidence: [],
      findings: [],
      method: 'static-ast-analysis',
      confidence: 'high',
      duration_ms: 120,
    },
    {
      property: 'input-validation',
      status: 'PROVEN',
      summary: 'All endpoints validate input with Zod schemas.',
      evidence: [],
      findings: [],
      method: 'static-ast-analysis',
      confidence: 'high',
      duration_ms: 150,
    },
    {
      property: 'import-integrity',
      status: 'PROVEN',
      summary: '134/134 imports resolve (0 hallucinated)',
      evidence: [],
      findings: [],
      method: 'static-ast-analysis',
      confidence: 'definitive',
      duration_ms: 210,
    },
  ],
  metadata: {
    bundleHash: 'abc123def456',
    signature: 'ed25519:xyz789...',
  },
};

/**
 * Sample proof bundle with partial compliance
 */
export const SAMPLE_PROOF_BUNDLE_PARTIAL: ProofBundle = {
  version: '2.0',
  projectName: 'startup-mvp',
  timestamp: '2026-02-17T16:00:00.000Z',
  properties: [
    {
      property: 'auth-coverage',
      status: 'PARTIAL',
      summary: '18/23 protected endpoints enforce authentication. 5 missing auth checks.',
      evidence: [],
      findings: [
        {
          file: 'src/routes/admin.ts',
          line: 45,
          severity: 'error',
          message: 'Protected endpoint /api/admin/users missing authentication middleware',
          suggestion: 'Add authMiddleware before adminController.listUsers',
        },
      ],
      method: 'static-ast-analysis',
      confidence: 'high',
      duration_ms: 145,
    },
    {
      property: 'error-handling',
      status: 'FAILED',
      summary: '15/23 route handlers have error boundaries. 8 handlers lack error handling.',
      evidence: [],
      findings: [
        {
          file: 'src/routes/webhooks.ts',
          line: 28,
          severity: 'error',
          message: 'Async route handler lacks try-catch wrapper',
          suggestion: 'Wrap handler in try-catch or use asyncHandler middleware',
        },
      ],
      method: 'static-ast-analysis',
      confidence: 'high',
      duration_ms: 180,
    },
    {
      property: 'secret-exposure',
      status: 'FAILED',
      summary: '2 critical secret exposure(s) found',
      evidence: [],
      findings: [
        {
          file: 'src/config/stripe.ts',
          line: 8,
          severity: 'error',
          message: 'Hardcoded Stripe API key detected',
          suggestion: 'Move to environment variable STRIPE_SECRET_KEY',
        },
      ],
      method: 'pattern-matching',
      confidence: 'definitive',
      duration_ms: 95,
    },
  ],
  metadata: {},
};

/**
 * Generate sample SOC 2 report (compliant)
 */
export function generateSampleSoc2Compliant(): ComplianceReport {
  const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'acme-payment-api');
  return generator.generateReport('soc2');
}

/**
 * Generate sample HIPAA report (compliant)
 */
export function generateSampleHipaaCompliant(): ComplianceReport {
  const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'healthtech-ehr');
  return generator.generateReport('hipaa');
}

/**
 * Generate sample PCI-DSS report (compliant)
 */
export function generateSamplePciDssCompliant(): ComplianceReport {
  const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_COMPLIANT, 'payment-gateway');
  return generator.generateReport('pci-dss');
}

/**
 * Generate sample EU AI Act report (partial)
 */
export function generateSampleEuAiActPartial(): ComplianceReport {
  const generator = new ComplianceReportGenerator(SAMPLE_PROOF_BUNDLE_PARTIAL, 'ai-recommendation-system');
  return generator.generateReport('eu-ai-act');
}
