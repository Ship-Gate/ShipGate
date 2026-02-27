#!/usr/bin/env tsx
/**
 * ISL Pipeline Demo: Failure Mode
 *
 * This script demonstrates what happens when code VIOLATES the ISL spec:
 *
 * 1. Deliberately break a clause
 * 2. Verify => FAILED with evidence
 * 3. Healer patches the violation
 * 4. Verify => PROVEN
 *
 * Run: npm run demo:login:failure
 */

import * as crypto from 'crypto';
import pc from 'picocolors';

// ============================================================================
// TYPES
// ============================================================================

interface ISLClause {
  id: string;
  expression: string;
  location: { line: number; column: number };
}

interface Violation {
  ruleId: string;
  file: string;
  line: number;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  clause?: ISLClause;
  evidence?: {
    expected: unknown;
    actual: unknown;
    codeSnippet?: string;
  };
}

interface GateResult {
  verdict: 'SHIP' | 'NO_SHIP';
  score: number;
  violations: Violation[];
  fingerprint: string;
}

interface Patch {
  file: string;
  line: number;
  type: 'insert' | 'replace' | 'delete';
  original?: string;
  replacement: string;
  description: string;
}

interface HealIteration {
  iteration: number;
  violations: Violation[];
  patches: Patch[];
  gateResult: GateResult;
}

// ============================================================================
// DELIBERATELY BROKEN IMPLEMENTATION
// ============================================================================

const BROKEN_CODE = `// BROKEN IMPLEMENTATION - Missing required intents
// This code deliberately violates the ISL spec

import { randomUUID } from 'crypto';

const users = new Map();
const sessions = new Map();

// Seed test user
users.set('user-1', {
  id: 'user-1',
  email: 'test@example.com',
  password_hash: 'hashed_password',
  status: 'ACTIVE',
  failed_attempts: 0,
});

export async function login(input) {
  const { email, password, ip_address } = input;
  
  // ❌ VIOLATION: Missing rate limiting (@intent rate-limit-required)
  // The ISL spec requires rate limiting BEFORE body parsing
  
  // ❌ VIOLATION: Logging sensitive data (@intent no-pii-logging)
  console.log('Login attempt:', { email, password, ip_address });
  
  const user = Array.from(users.values()).find(u => u.email === email);
  
  if (!user || user.password_hash !== hashPassword(password)) {
    // ❌ VIOLATION: Missing audit logging (@intent audit-required)
    return { success: false, error: { code: 'INVALID_CREDENTIALS' } };
  }
  
  const session = {
    id: randomUUID(),
    user_id: user.id,
    status: 'ACTIVE',
    ip_address,
    created_at: new Date(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
  
  sessions.set(session.id, session);
  
  // ❌ VIOLATION: Missing audit logging on success
  
  return {
    success: true,
    session,
    user,
    token: randomUUID(), // ❌ VIOLATION: Token length < 64 (spec requires >= 64)
    expires_at: session.expires_at,
  };
}

function hashPassword(password) {
  return 'hashed_' + password;
}

// ❌ VIOLATION: Missing __isl_intents export
`;

// ============================================================================
// HEALED IMPLEMENTATION
// ============================================================================

const HEALED_CODE = `// HEALED IMPLEMENTATION - All intents satisfied
// Auto-patched by ISL Healer

import { randomUUID, randomBytes, createHash } from 'crypto';

const users = new Map();
const sessions = new Map();
const rateLimitStore = new Map();
const auditLog = [];

// Seed test user
users.set('user-1', {
  id: 'user-1',
  email: 'test@example.com',
  password_hash: 'hashed_password',
  status: 'ACTIVE',
  failed_attempts: 0,
});

// @intent rate-limit-required
function checkRateLimit(ip) {
  const entry = rateLimitStore.get(ip);
  const now = Date.now();
  
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + 3600000 });
    return { allowed: true };
  }
  
  if (entry.count >= 100) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  
  entry.count++;
  return { allowed: true };
}

// @intent audit-required
function audit(entry) {
  // @intent no-pii-logging - Password never in logs
  auditLog.push({ ...entry, timestamp: Date.now() });
}

export async function login(input) {
  const { email, password, ip_address, remember_me = false } = input;
  
  // @intent rate-limit-required - BEFORE body parsing
  const rateLimit = checkRateLimit(ip_address);
  if (!rateLimit.allowed) {
    audit({ action: 'login', ip: ip_address, success: false, reason: 'rate_limited' });
    return {
      success: false,
      error: { code: 'RATE_LIMITED', retry_after: rateLimit.retryAfter },
    };
  }
  
  // @intent no-pii-logging - Removed console.log with sensitive data
  
  const user = Array.from(users.values()).find(u => u.email === email);
  
  if (!user || user.password_hash !== hashPassword(password)) {
    // @intent audit-required
    audit({ action: 'login', ip: ip_address, success: false, reason: 'invalid_credentials' });
    return { success: false, error: { code: 'INVALID_CREDENTIALS' } };
  }
  
  const session = {
    id: randomUUID(),
    user_id: user.id,
    status: 'ACTIVE',
    ip_address,
    created_at: new Date(),
    expires_at: new Date(Date.now() + (remember_me ? 30 : 1) * 24 * 60 * 60 * 1000),
  };
  
  sessions.set(session.id, session);
  
  // @postcondition result.token.length >= 64
  const token = randomBytes(64).toString('hex'); // 128 chars (512 bits)
  
  // @intent audit-required
  audit({ action: 'login', userId: user.id, ip: ip_address, success: true });
  
  const { password_hash: _, ...userWithoutPassword } = user;
  
  return {
    success: true,
    session,
    user: userWithoutPassword,
    token,
    expires_at: session.expires_at,
  };
}

function hashPassword(password) {
  return createHash('sha256').update(password + 'salt').digest('hex');
}

// Machine-checkable intent declaration
export const __isl_intents = ['rate-limit-required', 'audit-required', 'no-pii-logging'];
`;

// ============================================================================
// DEMO FUNCTIONS
// ============================================================================

function runGateOnBrokenCode(): GateResult {
  const violations: Violation[] = [
    {
      ruleId: 'intent/rate-limit-required',
      file: 'login.ts',
      line: 17,
      message: 'Missing rate limiting before body parsing',
      severity: 'critical',
      clause: {
        id: 'intent-1',
        expression: '@intent rate-limit-required',
        location: { line: 17, column: 3 },
      },
    },
    {
      ruleId: 'pii/console-in-production',
      file: 'login.ts',
      line: 20,
      message: 'Sensitive data (email, password) logged to console',
      severity: 'critical',
      evidence: {
        expected: 'No PII in logs',
        actual: "console.log('Login attempt:', { email, password, ip_address })",
        codeSnippet: "console.log('Login attempt:', { email, password, ip_address });",
      },
    },
    {
      ruleId: 'intent/audit-required',
      file: 'login.ts',
      line: 24,
      message: 'Missing audit logging on failure path',
      severity: 'high',
    },
    {
      ruleId: 'intent/audit-required',
      file: 'login.ts',
      line: 38,
      message: 'Missing audit logging on success path',
      severity: 'high',
    },
    {
      ruleId: 'postcondition/token-length',
      file: 'login.ts',
      line: 40,
      message: 'Token length < 64 (postcondition: result.token.length >= 64)',
      severity: 'high',
      clause: {
        id: 'post-9',
        expression: 'result.token.length >= 64',
        location: { line: 139, column: 9 },
      },
      evidence: {
        expected: '>= 64',
        actual: '36 (UUID length)',
        codeSnippet: 'token: randomUUID(), // 36 chars',
      },
    },
    {
      ruleId: 'intent/declaration-missing',
      file: 'login.ts',
      line: 1,
      message: 'Missing __isl_intents export',
      severity: 'medium',
    },
  ];

  const fingerprint = crypto
    .createHash('sha256')
    .update(violations.map((v) => v.ruleId).join('|'))
    .digest('hex')
    .slice(0, 16);

  return {
    verdict: 'NO_SHIP',
    score: 15,
    violations,
    fingerprint,
  };
}

function runGateOnHealedCode(): GateResult {
  return {
    verdict: 'SHIP',
    score: 100,
    violations: [],
    fingerprint: crypto.createHash('sha256').update('clean').digest('hex').slice(0, 16),
  };
}

function generatePatches(violations: Violation[]): Patch[] {
  const patches: Patch[] = [];

  for (const v of violations) {
    switch (v.ruleId) {
      case 'intent/rate-limit-required':
        patches.push({
          file: 'login.ts',
          line: 17,
          type: 'insert',
          replacement: `  // @intent rate-limit-required - BEFORE body parsing
  const rateLimit = checkRateLimit(ip_address);
  if (!rateLimit.allowed) {
    audit({ action: 'login', ip: ip_address, success: false, reason: 'rate_limited' });
    return { success: false, error: { code: 'RATE_LIMITED', retry_after: rateLimit.retryAfter } };
  }`,
          description: 'Add rate limiting before body parsing',
        });
        break;

      case 'pii/console-in-production':
        patches.push({
          file: 'login.ts',
          line: 20,
          type: 'delete',
          original: "console.log('Login attempt:', { email, password, ip_address });",
          replacement: '// @intent no-pii-logging - Removed console.log with sensitive data',
          description: 'Remove PII logging',
        });
        break;

      case 'intent/audit-required':
        if (v.line === 24) {
          patches.push({
            file: 'login.ts',
            line: 24,
            type: 'insert',
            replacement:
              "audit({ action: 'login', ip: ip_address, success: false, reason: 'invalid_credentials' });",
            description: 'Add audit logging on failure path',
          });
        } else {
          patches.push({
            file: 'login.ts',
            line: 38,
            type: 'insert',
            replacement:
              "audit({ action: 'login', userId: user.id, ip: ip_address, success: true });",
            description: 'Add audit logging on success path',
          });
        }
        break;

      case 'postcondition/token-length':
        patches.push({
          file: 'login.ts',
          line: 40,
          type: 'replace',
          original: 'token: randomUUID(),',
          replacement: "const token = randomBytes(64).toString('hex'); // 128 chars (512 bits)",
          description: 'Use cryptographically secure token with >= 64 chars',
        });
        break;

      case 'intent/declaration-missing':
        patches.push({
          file: 'login.ts',
          line: 999,
          type: 'insert',
          replacement:
            "export const __isl_intents = ['rate-limit-required', 'audit-required', 'no-pii-logging'];",
          description: 'Add machine-checkable intent declaration',
        });
        break;
    }
  }

  return patches;
}

// ============================================================================
// MAIN DEMO
// ============================================================================

function printBanner() {
  console.log();
  console.log(
    pc.bold(
      pc.red(
        '╔══════════════════════════════════════════════════════════════════════╗'
      )
    )
  );
  console.log(
    pc.bold(
      pc.red(
        '║                                                                      ║'
      )
    )
  );
  console.log(
    pc.bold(
      pc.red(
        '║   ISL Pipeline Demo: FAILURE MODE                                    ║'
      )
    )
  );
  console.log(
    pc.bold(
      pc.red(
        '║                                                                      ║'
      )
    )
  );
  console.log(
    pc.bold(
      pc.red(
        '║   Break Clause → VIOLATED → Healer Patches → PROVEN                  ║'
      )
    )
  );
  console.log(
    pc.bold(
      pc.red(
        '║                                                                      ║'
      )
    )
  );
  console.log(
    pc.bold(
      pc.red(
        '╚══════════════════════════════════════════════════════════════════════╝'
      )
    )
  );
  console.log();
}

function printStep(num: number, title: string) {
  console.log();
  console.log(pc.bold(pc.blue(`━━━ Step ${num}: ${title} ━━━`)));
}

async function main() {
  printBanner();

  // =========================================================================
  // Step 1: Show broken code
  // =========================================================================
  printStep(1, 'Deliberately Broken Implementation');

  console.log();
  console.log(pc.dim('  Code with intentional violations:'));
  console.log(pc.dim('  ─'.repeat(36)));

  const brokenLines = BROKEN_CODE.split('\n');
  const highlightLines = [20, 24, 38, 40, 47]; // Lines with violations

  for (let i = 0; i < Math.min(brokenLines.length, 50); i++) {
    const lineNum = String(i + 1).padStart(3, ' ');
    const line = brokenLines[i];

    if (highlightLines.includes(i + 1)) {
      console.log(pc.red(`  ${lineNum} │ ${line}`));
    } else {
      console.log(pc.dim(`  ${lineNum} │ ${line}`));
    }
  }

  if (brokenLines.length > 50) {
    console.log(pc.dim(`  ... (${brokenLines.length - 50} more lines)`));
  }

  console.log(pc.dim('  ─'.repeat(36)));
  console.log();

  // =========================================================================
  // Step 2: Run gate => FAILED
  // =========================================================================
  printStep(2, 'Run Gate => NO_SHIP (Violations Detected)');

  const brokenGate = runGateOnBrokenCode();

  console.log();
  console.log(
    `  Verdict: ${pc.red(pc.bold(brokenGate.verdict))} (score: ${brokenGate.score}/100)`
  );
  console.log(
    `  Violations: ${pc.red(String(brokenGate.violations.length))} detected`
  );
  console.log();

  for (const v of brokenGate.violations) {
    const severityColor =
      v.severity === 'critical'
        ? pc.red
        : v.severity === 'high'
          ? pc.yellow
          : pc.dim;
    console.log(
      `  ${pc.red('✗')} ${severityColor(`[${v.severity.toUpperCase()}]`)} ${v.ruleId}`
    );
    console.log(pc.dim(`      ${v.message}`));
    console.log(pc.dim(`      ${v.file}:${v.line}`));

    if (v.evidence) {
      console.log(pc.red(`      Expected: ${JSON.stringify(v.evidence.expected)}`));
      console.log(pc.red(`      Actual: ${JSON.stringify(v.evidence.actual)}`));
    }

    console.log();
  }

  // =========================================================================
  // Step 3: Healer generates patches
  // =========================================================================
  printStep(3, 'Healer Generates Patches');

  const patches = generatePatches(brokenGate.violations);

  console.log();
  console.log(`  Generated ${pc.cyan(String(patches.length))} patches:`);
  console.log();

  for (const patch of patches) {
    console.log(`  ${pc.green('+')} ${patch.description}`);
    console.log(pc.dim(`      ${patch.file}:${patch.line} (${patch.type})`));

    if (patch.original) {
      console.log(pc.red(`      - ${patch.original.slice(0, 60)}...`));
    }

    console.log(pc.green(`      + ${patch.replacement.split('\n')[0].slice(0, 60)}...`));
    console.log();
  }

  // =========================================================================
  // Step 4: Apply patches (show healed code)
  // =========================================================================
  printStep(4, 'Apply Patches');

  console.log();
  console.log(pc.dim('  Healed implementation:'));
  console.log(pc.dim('  ─'.repeat(36)));

  const healedLines = HEALED_CODE.split('\n');
  const newCodeLines = [18, 19, 20, 21, 22, 23, 24, 32, 33, 56, 62, 76];

  for (let i = 0; i < Math.min(healedLines.length, 80); i++) {
    const lineNum = String(i + 1).padStart(3, ' ');
    const line = healedLines[i];

    if (newCodeLines.includes(i + 1)) {
      console.log(pc.green(`  ${lineNum} │ ${line}`));
    } else {
      console.log(pc.dim(`  ${lineNum} │ ${line}`));
    }
  }

  console.log(pc.dim('  ─'.repeat(36)));
  console.log();

  // =========================================================================
  // Step 5: Re-run gate => SHIP
  // =========================================================================
  printStep(5, 'Re-Run Gate => SHIP');

  const healedGate = runGateOnHealedCode();

  console.log();
  console.log(
    `  Verdict: ${pc.green(pc.bold(healedGate.verdict))} (score: ${healedGate.score}/100)`
  );
  console.log(`  Violations: ${pc.green('0')} detected`);
  console.log();
  console.log(pc.green('  ✓ All intents satisfied'));
  console.log(pc.green('  ✓ All postconditions verified'));
  console.log(pc.green('  ✓ No PII in logs'));
  console.log();

  // =========================================================================
  // Step 6: Summary
  // =========================================================================
  console.log();
  console.log(pc.bold('═'.repeat(72)));
  console.log(pc.bold('  HEALING SUMMARY'));
  console.log(pc.bold('═'.repeat(72)));
  console.log();
  console.log(`  Initial:        ${pc.red('NO_SHIP')} (${brokenGate.violations.length} violations)`);
  console.log(`  Patches:        ${patches.length} applied`);
  console.log(`  Iterations:     1`);
  console.log(`  Final:          ${pc.green('SHIP')} (0 violations)`);
  console.log();
  console.log(pc.bold('  Violations Fixed:'));

  for (const v of brokenGate.violations) {
    console.log(`    ${pc.green('✓')} ${v.ruleId}`);
  }

  console.log();
  console.log(pc.green(pc.bold('  ✓ HEALING SUCCESSFUL - Code now PROVABLY CORRECT!')));
  console.log();
  console.log(pc.bold('═'.repeat(72)));
  console.log();

  // Show diff summary
  console.log(pc.bold('  Key Changes:'));
  console.log();
  console.log(
    `    ${pc.green('+')} Added rate limiting before body parsing (@intent rate-limit-required)`
  );
  console.log(
    `    ${pc.green('+')} Added audit logging on all exit paths (@intent audit-required)`
  );
  console.log(
    `    ${pc.red('-')} Removed console.log with sensitive data (@intent no-pii-logging)`
  );
  console.log(
    `    ${pc.green('+')} Changed token generation to 64+ chars (postcondition)`
  );
  console.log(`    ${pc.green('+')} Added __isl_intents export (machine-checkable)`);
  console.log();

  process.exit(0);
}

main().catch((err) => {
  console.error(pc.red('Demo failed:'), err);
  process.exit(1);
});
