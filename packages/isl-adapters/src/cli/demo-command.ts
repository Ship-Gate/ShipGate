/**
 * ISL Adapters - Demo Command
 * 
 * Creates an instant "aha moment" by running the gate on demo code.
 * 
 * @module @isl-lang/adapters/cli
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Demo command options
 */
export interface DemoCommandOptions {
  /** Demo scenario to run */
  scenario?: 'fails-auth' | 'fails-pii' | 'passes' | 'all';
  /** Output directory for demo */
  outputDir?: string;
  /** Open report in browser */
  openReport?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Demo result
 */
export interface DemoResult {
  scenario: string;
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  issueCount: number;
  reportPath: string;
  output: string;
}

// ============================================================================
// Demo Scenarios
// ============================================================================

const DEMO_SCENARIOS = {
  'fails-auth': {
    name: 'Auth Issues',
    description: 'Demonstrates auth bypass, missing rate limits, unprotected admin routes',
    files: [
      {
        path: 'src/auth/login.ts',
        content: `/**
 * Login Endpoint - HAS ISSUES
 */
import { Router } from 'express';

const router = Router();

// 🛑 NO RATE LIMITING - allows brute force
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // 🛑 AUTH BYPASS PATTERN
  const skipAuth = req.query.debug === 'true';
  
  if (skipAuth) {
    return res.json({ token: 'debug-token' });
  }

  res.json({ token: 'real-token' });
});

export default router;
`,
      },
      {
        path: 'src/api/admin.ts',
        content: `/**
 * Admin API - HAS ISSUES
 */
import { Router } from 'express';

const router = Router();

// 🛑 UNPROTECTED ADMIN ENDPOINT
router.get('/dashboard', (req, res) => {
  res.json({
    totalUsers: 150,
    secretApiKey: process.env.ADMIN_KEY, // 🛑 Exposing secrets
  });
});

// 🛑 NO AUTH on delete
router.delete('/users/:id', (req, res) => {
  res.json({ deleted: req.params.id });
});

export default router;
`,
      },
    ],
  },

  'fails-pii': {
    name: 'PII Logging Issues',
    description: 'Demonstrates PII in logs, unmasked responses, missing encryption',
    files: [
      {
        path: 'src/api/users.ts',
        content: `/**
 * Users API - HAS ISSUES
 */
import { Router } from 'express';

const router = Router();

router.get('/me', (req, res) => {
  const user = { email: 'alice@example.com', ssn: '123-45-6789' };
  
  // 🛑 PII IN LOGS
  console.log('User profile accessed:', user.email, user.ssn);
  
  // 🛑 UNMASKED PII in response
  res.json({
    email: user.email,
    ssn: user.ssn,  // 🛑 Should never return SSN
  });
});

router.put('/me', (req, res) => {
  // 🛑 LOGGING PII
  console.log('Updating phone:', req.body.phone);
  res.json({ success: true });
});

export default router;
`,
      },
    ],
  },

  'passes': {
    name: 'Clean Code',
    description: 'Demonstrates code that passes all checks',
    files: [
      {
        path: 'src/utils/math.ts',
        content: `/**
 * Math utilities - CLEAN
 */

export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
`,
      },
      {
        path: 'src/config/constants.ts',
        content: `/**
 * Application constants - CLEAN
 */

export const APP_NAME = 'MyApp';
export const VERSION = '1.0.0';
export const MAX_RETRIES = 3;
export const TIMEOUT_MS = 5000;
`,
      },
    ],
  },
};

// ============================================================================
// Demo Command
// ============================================================================

/**
 * Run the demo command
 */
export async function runDemoCommand(options: DemoCommandOptions = {}): Promise<DemoResult[]> {
  const scenario = options.scenario ?? 'all';
  const results: DemoResult[] = [];
  
  const scenariosToRun = scenario === 'all' 
    ? Object.keys(DEMO_SCENARIOS) as Array<keyof typeof DEMO_SCENARIOS>
    : [scenario];

  // Import verifyBuild dynamically to avoid circular deps
  const { verifyBuild } = await import('@isl-lang/verified-build');

  for (const scenarioKey of scenariosToRun) {
    const scenarioData = DEMO_SCENARIOS[scenarioKey];
    if (!scenarioData) continue;

    const outputLines: string[] = [];
    outputLines.push('');
    outputLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    outputLines.push(`  Demo: ${scenarioData.name}`);
    outputLines.push(`  ${scenarioData.description}`);
    outputLines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    outputLines.push('');

    // Run verification
    const result = await verifyBuild({
      files: scenarioData.files.map(f => ({ path: f.path, content: f.content })),
      projectRoot: process.cwd(),
      writeEvidence: true,
      evidenceDir: path.join(process.cwd(), '.islstudio', 'demo-evidence', scenarioKey),
    });

    const emoji = result.verdict === 'SHIP' ? '✅' : '🛑';
    outputLines.push(`  ${emoji} Verdict: ${result.verdict}`);
    outputLines.push(`  📊 Score: ${result.score}/100`);
    outputLines.push(`  🔍 Issues: ${result.violations.length}`);
    outputLines.push('');

    if (result.violations.length > 0 && options.verbose) {
      outputLines.push('  Issues Found:');
      for (const v of result.violations.slice(0, 5)) {
        const icon = v.tier === 'hard_block' ? '🛑' : v.tier === 'soft_block' ? '⚠️' : 'ℹ️';
        outputLines.push(`    ${icon} [${v.ruleId}] ${v.message}`);
        if (v.suggestion) {
          outputLines.push(`       Fix: ${v.suggestion}`);
        }
      }
      if (result.violations.length > 5) {
        outputLines.push(`    ... and ${result.violations.length - 5} more`);
      }
      outputLines.push('');
    }

    if (result.evidencePath) {
      outputLines.push(`  📁 Evidence: ${result.evidencePath}`);
      outputLines.push(`  🔐 Fingerprint: ${result.fingerprint}`);
    }
    outputLines.push('');

    results.push({
      scenario: scenarioKey,
      verdict: result.verdict,
      score: result.score,
      issueCount: result.violations.length,
      reportPath: result.evidencePath ? path.join(result.evidencePath, 'report.html') : '',
      output: outputLines.join('\n'),
    });
  }

  return results;
}

/**
 * Format demo results for console output
 */
export function formatDemoOutput(results: DemoResult[]): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('╔═══════════════════════════════════════════════════════════╗');
  lines.push('║              ISL Studio Demo - SHIP/NO_SHIP               ║');
  lines.push('╚═══════════════════════════════════════════════════════════╝');
  
  for (const result of results) {
    lines.push(result.output);
  }

  // Summary
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('  Summary:');
  
  const ships = results.filter(r => r.verdict === 'SHIP').length;
  const noShips = results.filter(r => r.verdict === 'NO_SHIP').length;
  
  lines.push(`    ✅ SHIP: ${ships}`);
  lines.push(`    🛑 NO_SHIP: ${noShips}`);
  lines.push('');
  lines.push('  Try it on your code: isl gate');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  return lines.join('\n');
}

/**
 * Print demo scenarios info
 */
export function printDemoInfo(): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('ISL Studio Demo Scenarios:');
  lines.push('');
  
  for (const [key, data] of Object.entries(DEMO_SCENARIOS)) {
    lines.push(`  ${key}`);
    lines.push(`    ${data.description}`);
    lines.push('');
  }
  
  lines.push('Usage:');
  lines.push('  isl demo              # Run all scenarios');
  lines.push('  isl demo fails-auth   # Run specific scenario');
  lines.push('  isl demo --verbose    # Show detailed issues');
  lines.push('');

  return lines.join('\n');
}
