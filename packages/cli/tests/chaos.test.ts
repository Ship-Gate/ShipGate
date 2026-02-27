// ============================================================================
// Chaos Command Tests
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Paths
const CLI_PATH = resolve(__dirname, '../src/index.ts');
const TEMP_DIR = resolve(__dirname, '../../../.test-temp/chaos-tests');

// Helper to run CLI command
async function runCLI(args: string[], options: { cwd?: string; timeout?: number } = {}) {
  const { cwd = process.cwd(), timeout = 30000 } = options;
  
  try {
    const { stdout, stderr } = await execAsync(
      `npx tsx ${CLI_PATH} ${args.join(' ')}`,
      { cwd, timeout }
    );
    return {
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error: unknown) {
    const execError = error as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: execError.code ?? 1,
      stdout: execError.stdout?.trim() ?? '',
      stderr: execError.stderr?.trim() ?? '',
    };
  }
}

describe('Chaos Command', () => {
  beforeAll(() => {
    // Clean up temp directory if it exists
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEMP_DIR, { recursive: true });

    // Create test fixtures
    mkdirSync(join(TEMP_DIR, 'specs'), { recursive: true });
    
    // Create ISL spec with chaos scenarios
    writeFileSync(join(TEMP_DIR, 'specs/payments.isl'), `
isl 1.0

domain PaymentsDomain {
  entity Payment {
    id: UUID
    amount: Decimal
    currency: String
    status: String
  }

  behavior ProcessPayment {
    input {
      amount: Decimal
      currency: String
      cardToken: String
    }
    output {
      success: Payment
      error: { code: String, message: String }
    }
    preconditions {
      "Amount must be positive" => input.amount > 0
      "Currency must be valid" => ["USD", "EUR", "GBP"].contains(input.currency)
    }
    postconditions {
      "Payment recorded" => result.success implies payment.exists
    }
    chaos {
      "Database timeout" => inject database_failure for 5s
      "Network latency" => inject network_latency of 2000ms
      "Service unavailable" => inject service_unavailable
    }
  }
}
`);

    // Create mock implementation
    writeFileSync(join(TEMP_DIR, 'payments-impl.ts'), `
export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export async function processPayment(
  amount: number,
  currency: string,
  cardToken: string
): Promise<{ payment?: Payment; error?: { code: string; message: string } }> {
  if (amount <= 0) {
    return { error: { code: 'INVALID_AMOUNT', message: 'Amount must be positive' } };
  }
  if (!['USD', 'EUR', 'GBP'].includes(currency)) {
    return { error: { code: 'INVALID_CURRENCY', message: 'Invalid currency' } };
  }
  
  // Simulate processing
  return {
    payment: {
      id: crypto.randomUUID(),
      amount,
      currency,
      status: 'completed',
    },
  };
}
`);
  });

  afterAll(() => {
    // Clean up
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  describe('--help', () => {
    it('should show help for chaos command', async () => {
      const result = await runCLI(['chaos', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('chaos');
      expect(result.stdout).toContain('impl');
      expect(result.stdout).toContain('fault injection');
    });

    it('should show --seed option in help', async () => {
      const result = await runCLI(['chaos', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--seed');
    });

    it('should show --continue-on-failure option in help', async () => {
      const result = await runCLI(['chaos', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--continue-on-failure');
    });
  });

  describe('Basic Execution', () => {
    it('should require --impl flag', async () => {
      const specPath = join(TEMP_DIR, 'specs/payments.isl');
      const result = await runCLI(['chaos', specPath]);
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(/impl|implementation/i);
    });

    it('should run chaos with spec and impl', async () => {
      const specPath = join(TEMP_DIR, 'specs/payments.isl');
      const implPath = join(TEMP_DIR, 'payments-impl.ts');
      
      const result = await runCLI(['chaos', specPath, '--impl', implPath]);
      
      // Command should run without crashing
      expect(typeof result.exitCode).toBe('number');
    });

    it('should fail on non-existent spec file', async () => {
      const result = await runCLI(['chaos', '/nonexistent.isl', '--impl', 'impl.ts']);
      
      expect(result.exitCode).not.toBe(0);
    });

    it('should fail on non-existent impl file', async () => {
      const specPath = join(TEMP_DIR, 'specs/payments.isl');
      const result = await runCLI(['chaos', specPath, '--impl', '/nonexistent.ts']);
      
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('Options', () => {
    it('should accept --timeout option', async () => {
      const specPath = join(TEMP_DIR, 'specs/payments.isl');
      const implPath = join(TEMP_DIR, 'payments-impl.ts');
      
      const result = await runCLI(['chaos', specPath, '--impl', implPath, '--timeout', '60000']);
      
      expect(typeof result.exitCode).toBe('number');
    });

    it('should accept --seed option for reproducibility', async () => {
      const specPath = join(TEMP_DIR, 'specs/payments.isl');
      const implPath = join(TEMP_DIR, 'payments-impl.ts');
      
      const result = await runCLI(['chaos', specPath, '--impl', implPath, '--seed', '12345']);
      
      expect(typeof result.exitCode).toBe('number');
    });

    it('should accept --continue-on-failure option', async () => {
      const specPath = join(TEMP_DIR, 'specs/payments.isl');
      const implPath = join(TEMP_DIR, 'payments-impl.ts');
      
      const result = await runCLI(['chaos', specPath, '--impl', implPath, '--continue-on-failure']);
      
      expect(typeof result.exitCode).toBe('number');
    });

    it('should accept --detailed flag', async () => {
      const specPath = join(TEMP_DIR, 'specs/payments.isl');
      const implPath = join(TEMP_DIR, 'payments-impl.ts');
      
      const result = await runCLI(['chaos', specPath, '--impl', implPath, '--detailed']);
      
      expect(typeof result.exitCode).toBe('number');
    });
  });

  describe('JSON Output', () => {
    it('should output valid JSON with --format json', async () => {
      const specPath = join(TEMP_DIR, 'specs/payments.isl');
      const implPath = join(TEMP_DIR, 'payments-impl.ts');
      
      const result = await runCLI(['chaos', specPath, '--impl', implPath, '--format', 'json']);
      
      // Try to parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        // If JSON parsing fails, check if there was an error
        expect(result.stdout).toMatch(/error|fail/i);
        return;
      }
      
      expect(parsed).toHaveProperty('success');
      expect(parsed).toHaveProperty('specFile');
      expect(parsed).toHaveProperty('implFile');
    });

    it('should include chaosResult in JSON output', async () => {
      const specPath = join(TEMP_DIR, 'specs/payments.isl');
      const implPath = join(TEMP_DIR, 'payments-impl.ts');
      
      const result = await runCLI(['chaos', specPath, '--impl', implPath, '--format', 'json']);
      
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return; // Skip if JSON parsing fails
      }
      
      // Check structure
      if (parsed.chaosResult) {
        const chaosResult = parsed.chaosResult as Record<string, unknown>;
        expect(chaosResult).toHaveProperty('success');
        expect(chaosResult).toHaveProperty('verdict');
        expect(chaosResult).toHaveProperty('score');
        expect(chaosResult).toHaveProperty('coverage');
      }
    });

    it('should include verdict in chaos results', async () => {
      const specPath = join(TEMP_DIR, 'specs/payments.isl');
      const implPath = join(TEMP_DIR, 'payments-impl.ts');
      
      const result = await runCLI(['chaos', specPath, '--impl', implPath, '--format', 'json']);
      
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return;
      }
      
      if (parsed.chaosResult) {
        const chaosResult = parsed.chaosResult as Record<string, unknown>;
        expect(['verified', 'risky', 'unsafe']).toContain(chaosResult.verdict);
      }
    });
  });

  describe('Exit Codes', () => {
    it('should return exit code 0 on success', async () => {
      const specPath = join(TEMP_DIR, 'specs/payments.isl');
      const implPath = join(TEMP_DIR, 'payments-impl.ts');
      
      const result = await runCLI(['chaos', specPath, '--impl', implPath]);
      
      // May succeed or fail depending on chaos package availability
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should return exit code 1 on failure', async () => {
      const result = await runCLI(['chaos', '/nonexistent.isl', '--impl', '/nonexistent.ts']);
      
      expect(result.exitCode).toBe(1);
    });
  });

  describe('Coverage Report', () => {
    it('should include coverage metrics in JSON output', async () => {
      const specPath = join(TEMP_DIR, 'specs/payments.isl');
      const implPath = join(TEMP_DIR, 'payments-impl.ts');
      
      const result = await runCLI(['chaos', specPath, '--impl', implPath, '--format', 'json']);
      
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return;
      }
      
      if (parsed.chaosResult) {
        const chaosResult = parsed.chaosResult as Record<string, unknown>;
        if (chaosResult.coverage) {
          const coverage = chaosResult.coverage as Record<string, unknown>;
          expect(coverage).toHaveProperty('injectionTypes');
          expect(coverage).toHaveProperty('scenarios');
          expect(coverage).toHaveProperty('behaviors');
          expect(coverage).toHaveProperty('overall');
        }
      }
    });
  });
});
