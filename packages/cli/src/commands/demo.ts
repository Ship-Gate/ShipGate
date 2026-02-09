/**
 * Demo Command
 * 
 * Creates a one-command demo that proves ShipGate value immediately.
 * 
 * Usage:
 *   shipgate demo                    # Scaffold demo app, run gate, show NO_SHIP
 *   shipgate demo --fix              # Apply the fix and re-run gate -> SHIP
 */

import { writeFile, mkdir, readFile, readdir, stat } from 'fs/promises';
import { existsSync, rmSync } from 'fs';
import { join, resolve, relative } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { gate, printGateResult } from './gate.js';
import { verify } from './verify.js';
import { proofPack } from './proof-pack.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DemoOptions {
  /** Apply the fix automatically */
  fix?: boolean;
  /** Output directory for demo (default: ./shipgate-demo) */
  output?: string;
  /** Skip cleanup after demo */
  keep?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

export interface DemoResult {
  success: boolean;
  demoPath: string;
  verdict: 'SHIP' | 'NO-SHIP';
  fixApplied: boolean;
  summary: string;
  proofBundlePath?: string;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sample Assets
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_SPEC = `/**
 * Demo Auth Domain
 * 
 * A simple authentication domain demonstrating ShipGate verification.
 */

domain Auth {
  entity User {
    id: UUID [immutable, unique]
    email: Email [unique]
    passwordHash: String [immutable]
    createdAt: DateTime [immutable]
  }

  entity Session {
    id: UUID [immutable, unique]
    userId: UUID [immutable]
    token: String [immutable]
    expiresAt: DateTime
  }

  behavior Login {
    input {
      email: Email
      password: String
    }
    output {
      session: Session
    }
    preconditions {
      email.length > 0
      password.length >= 8
    }
    postconditions {
      Session.exists(output.session.id)
      output.session.userId != null
      output.session.token.length > 0
    }
    invariants {
      output.session.expiresAt > now()
    }
  }

  behavior GetUser {
    input {
      userId: UUID
    }
    output {
      user: User
    }
    preconditions {
      userId != null
    }
    postconditions {
      output.user.id == input.userId
      output.user.email != null
    }
  }
}
`;

const DEMO_IMPL_BUGGY = `/**
 * Demo Auth Implementation (with ghost feature)
 * 
 * This implementation has a deliberate bug: it references an API route
 * that doesn't exist, demonstrating ShipGate's ghost feature detection.
 */

import { v4 as uuidv4 } from 'uuid';

interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

// In-memory store (for demo)
const users: Map<string, User> = new Map();
const sessions: Map<string, Session> = new Map();

export async function login(email: string, password: string): Promise<Session> {
  // Precondition check
  if (!email || email.length === 0) {
    throw new Error('Email is required');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Find user
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    throw new Error('User not found');
  }

  // Verify password (simplified for demo)
  // In real code, this would hash and compare
  const passwordValid = true; // Simplified

  if (!passwordValid) {
    throw new Error('Invalid password');
  }

  // Create session
  const session: Session = {
    id: uuidv4(),
    userId: user.id,
    token: uuidv4(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };

  sessions.set(session.id, session);

  // GHOST FEATURE: This route doesn't exist!
  // ShipGate will detect this as a ghost route
  await fetch('/api/auth/audit-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id, action: 'login' }),
  });

  return session;
}

export async function getUser(userId: string): Promise<User> {
  // Precondition check
  if (!userId) {
    throw new Error('User ID is required');
  }

  const user = users.get(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

// Helper to create a test user (for demo)
export function createTestUser(email: string, password: string): User {
  const user: User = {
    id: uuidv4(),
    email,
    passwordHash: 'hashed_' + password, // Simplified
    createdAt: new Date(),
  };
  users.set(user.id, user);
  return user;
}
`;

const DEMO_IMPL_FIXED = `/**
 * Demo Auth Implementation (fixed)
 * 
 * Fixed version: removed the ghost route call.
 */

import { v4 as uuidv4 } from 'uuid';

interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

// In-memory store (for demo)
const users: Map<string, User> = new Map();
const sessions: Map<string, Session> = new Map();

export async function login(email: string, password: string): Promise<Session> {
  // Precondition check
  if (!email || email.length === 0) {
    throw new Error('Email is required');
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Find user
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    throw new Error('User not found');
  }

  // Verify password (simplified for demo)
  const passwordValid = true; // Simplified

  if (!passwordValid) {
    throw new Error('Invalid password');
  }

  // Create session
  const session: Session = {
    id: uuidv4(),
    userId: user.id,
    token: uuidv4(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };

  sessions.set(session.id, session);

  // FIXED: Removed ghost route call
  // Audit logging would be handled by middleware or a real service

  return session;
}

export async function getUser(userId: string): Promise<User> {
  // Precondition check
  if (!userId) {
    throw new Error('User ID is required');
  }

  const user = users.get(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

// Helper to create a test user (for demo)
export function createTestUser(email: string, password: string): User {
  const user: User = {
    id: uuidv4(),
    email,
    passwordHash: 'hashed_' + password, // Simplified
    createdAt: new Date(),
  };
  users.set(user.id, user);
  return user;
}
`;

const DEMO_PACKAGE_JSON = `{
  "name": "shipgate-demo",
  "version": "1.0.0",
  "description": "ShipGate demo application",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "echo \\"No tests yet\\""
  },
  "dependencies": {
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0",
    "typescript": "^5.0.0"
  }
}
`;

const DEMO_README = `# ShipGate Demo

This is a demo application showcasing ShipGate's verification capabilities.

## The Bug

The implementation in \`src/auth.ts\` contains a **ghost feature**: it calls an API route
\`/api/auth/audit-log\` that doesn't actually exist. ShipGate detects this and blocks
the code from shipping.

## Running the Demo

1. **Initial state (NO_SHIP)**:
   \`\`\`bash
   shipgate gate specs/auth.isl --impl src/auth.ts
   \`\`\`
   
   This will show NO_SHIP due to the ghost route.

2. **Apply the fix**:
   \`\`\`bash
   shipgate demo --fix
   \`\`\`
   
   This replaces the buggy implementation with the fixed version.

3. **Verify SHIP**:
   \`\`\`bash
   shipgate gate specs/auth.isl --impl src/auth.ts
   \`\`\`
   
   Now it should show SHIP!

## What ShipGate Detected

- **Ghost Route**: The code calls \`/api/auth/audit-log\` but this route doesn't exist
- **Missing Implementation**: The route is referenced but never defined

## The Fix

The fixed version removes the ghost route call. In a real application, audit logging
would be handled by middleware or a dedicated service that actually exists.
`;

// ─────────────────────────────────────────────────────────────────────────────
// Demo Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the demo command
 */
export async function demo(options: DemoOptions = {}): Promise<DemoResult> {
  const spinner = ora('Setting up demo...').start();
  const errors: string[] = [];
  const demoPath = resolve(options.output || './shipgate-demo');
  const fixApplied = options.fix || false;

  try {
    // Step 1: Scaffold demo app
    spinner.text = 'Scaffolding demo application...';
    await scaffoldDemoApp(demoPath, fixApplied);

    spinner.succeed('Demo app scaffolded');

    // Step 2: Create truthpack for ghost route detection
    spinner.text = 'Creating truthpack for ghost detection...';
    await createTruthpack(demoPath);

    // Step 3: Run gate (which internally runs verify)
    spinner.start('Running gate (SHIP/NO-SHIP)...');
    const gateResult = await gate(
      join(demoPath, 'specs', 'auth.isl'),
      {
        impl: join(demoPath, 'src', 'auth.ts'),
        threshold: 95,
        output: join(demoPath, 'evidence'),
        verbose: options.verbose,
      }
    );

    spinner.stop();

    // Create a simple verify result for summary
    const verifyResultForSummary = {
      success: gateResult.decision === 'SHIP',
      trustScore: gateResult.trustScore,
      errors: gateResult.error ? [gateResult.error] : [],
    };

    // Step 5: Create proof bundle
    let proofBundlePath: string | undefined;
    if (gateResult.bundlePath) {
      try {
        spinner.start('Creating proof bundle...');
        const proofResult = await proofPack({
          spec: join(demoPath, 'specs', 'auth.isl'),
          evidence: join(demoPath, 'evidence'),
          output: join(demoPath, 'proof-bundle'),
        });
        
        if (proofResult.success && proofResult.bundlePath) {
          proofBundlePath = proofResult.bundlePath;
          spinner.succeed('Proof bundle created');
        } else {
          spinner.warn('Proof bundle creation skipped');
        }
      } catch (error) {
        spinner.warn(`Proof bundle creation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Step 5: Generate summary
    const summary = generateSummary(gateResult, verifyResultForSummary, fixApplied, demoPath, proofBundlePath);

    return {
      success: gateResult.decision === 'SHIP',
      demoPath,
      verdict: gateResult.decision,
      fixApplied,
      summary,
      proofBundlePath,
      errors,
    };
  } catch (error) {
    spinner.fail('Demo failed');
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      success: false,
      demoPath,
      verdict: 'NO-SHIP',
      fixApplied,
      summary: `Demo failed: ${errors.join('; ')}`,
      errors,
    };
  }
}

/**
 * Scaffold the demo application
 */
async function scaffoldDemoApp(demoPath: string, useFixed: boolean): Promise<void> {
  // Create directory structure
  await mkdir(join(demoPath, 'specs'), { recursive: true });
  await mkdir(join(demoPath, 'src'), { recursive: true });
  await mkdir(join(demoPath, 'evidence'), { recursive: true });

  // Write spec
  await writeFile(join(demoPath, 'specs', 'auth.isl'), DEMO_SPEC, 'utf-8');

  // Write implementation (buggy or fixed)
  const implContent = useFixed ? DEMO_IMPL_FIXED : DEMO_IMPL_BUGGY;
  await writeFile(join(demoPath, 'src', 'auth.ts'), implContent, 'utf-8');

  // Write package.json
  await writeFile(join(demoPath, 'package.json'), DEMO_PACKAGE_JSON, 'utf-8');

  // Write README
  await writeFile(join(demoPath, 'README.md'), DEMO_README, 'utf-8');
}

/**
 * Create truthpack for ghost route detection
 */
async function createTruthpack(demoPath: string): Promise<void> {
  const truthpackDir = join(demoPath, '.shipgate', 'truthpack');
  await mkdir(truthpackDir, { recursive: true });

  // Create routes.json - lists actual routes (without the ghost route)
  const routesJson = {
    routes: [
      {
        method: 'GET',
        path: '/api/health',
        description: 'Health check endpoint',
      },
      {
        method: 'POST',
        path: '/api/auth/login',
        description: 'Login endpoint',
      },
      {
        method: 'GET',
        path: '/api/user/:id',
        description: 'Get user by ID',
      },
    ],
  };

  await writeFile(
    join(truthpackDir, 'routes.json'),
    JSON.stringify(routesJson, null, 2),
    'utf-8'
  );

  // Create env.json - lists actual env vars
  const envJson = {
    envVars: [
      {
        name: 'DATABASE_URL',
        description: 'Database connection string',
        required: true,
      },
      {
        name: 'JWT_SECRET',
        description: 'JWT signing secret',
        required: true,
      },
    ],
  };

  await writeFile(
    join(truthpackDir, 'env.json'),
    JSON.stringify(envJson, null, 2),
    'utf-8'
  );
}

/**
 * Generate demo summary
 */
function generateSummary(
  gateResult: import('./gate.js').GateResult,
  verifyResult: import('./verify.js').VerifyResult,
  fixApplied: boolean,
  demoPath: string,
  proofBundlePath?: string
): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push(chalk.bold.cyan('═══════════════════════════════════════════════════════════'));
  lines.push(chalk.bold.cyan('  ShipGate Demo Results'));
  lines.push(chalk.bold.cyan('═══════════════════════════════════════════════════════════'));
  lines.push('');
  
  // Verdict
  if (gateResult.decision === 'SHIP') {
    lines.push(chalk.bold.green('  ✓ VERDICT: SHIP'));
  } else {
    lines.push(chalk.bold.red('  ✗ VERDICT: NO-SHIP'));
  }
  lines.push('');
  
  // Trust Score
  lines.push(`  Trust Score: ${gateResult.trustScore}%`);
  lines.push(`  Confidence:  ${gateResult.confidence}%`);
  lines.push('');
  
  // Summary
  if (gateResult.decision === 'NO-SHIP' && !fixApplied) {
    lines.push(chalk.yellow('  Issue Detected:'));
    lines.push('');
    if (gateResult.results?.blockers && gateResult.results.blockers.length > 0) {
      for (const blocker of gateResult.results.blockers) {
        lines.push(`    • ${blocker.clause}: ${blocker.reason}`);
      }
    } else {
      lines.push('    • Ghost feature detected (route/env var that doesn\'t exist)');
    }
    lines.push('');
    lines.push(chalk.cyan('  To fix this demo:'));
    lines.push('');
    lines.push(`    ${chalk.gray('$')} ${chalk.bold('shipgate demo --fix')}`);
    lines.push('');
    lines.push('  This will apply the fix and re-run the gate.');
  } else if (gateResult.decision === 'SHIP' && fixApplied) {
    lines.push(chalk.green('  ✓ All issues resolved!'));
    lines.push('');
    lines.push('  The ghost feature has been removed and the code now passes verification.');
  }
  
  // Files
  lines.push(chalk.gray('  Files:'));
  lines.push(`    Spec: ${relative(process.cwd(), join(demoPath, 'specs', 'auth.isl'))}`);
  lines.push(`    Impl: ${relative(process.cwd(), join(demoPath, 'src', 'auth.ts'))}`);
  if (proofBundlePath) {
    lines.push(`    Proof: ${relative(process.cwd(), proofBundlePath)}`);
  }
  lines.push('');
  
  // Next steps
  if (gateResult.decision === 'NO-SHIP' && !fixApplied) {
    lines.push(chalk.bold('  Next Steps:'));
    lines.push('');
    lines.push('  1. Review the evidence bundle in the evidence/ directory');
    lines.push('  2. Run: shipgate demo --fix');
    lines.push('  3. Re-run: shipgate gate specs/auth.isl --impl src/auth.ts');
    lines.push('');
  } else if (gateResult.decision === 'SHIP') {
    lines.push(chalk.bold.green('  ✓ Demo complete!'));
    lines.push('');
    lines.push('  The code passes all verification checks and is ready to ship.');
    lines.push('');
  }
  
  lines.push(chalk.gray('  Demo directory: ') + demoPath);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Print demo result
 */
export function printDemoResult(result: DemoResult, options: { verbose?: boolean } = {}): void {
  console.log(result.summary);
  
  if (result.errors.length > 0) {
    console.log('');
    console.log(chalk.red('Errors:'));
    for (const error of result.errors) {
      console.log(chalk.red(`  • ${error}`));
    }
  }
}

/**
 * Get exit code for demo result
 */
export function getDemoExitCode(result: DemoResult): number {
  return result.success ? 0 : 1;
}
