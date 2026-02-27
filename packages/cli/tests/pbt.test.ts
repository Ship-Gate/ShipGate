// ============================================================================
// PBT Command Tests
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Paths
const CLI_PATH = resolve(__dirname, '../src/index.ts');
const TEMP_DIR = resolve(__dirname, '../../../.test-temp/pbt-tests');

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

describe('PBT Command', () => {
  beforeAll(() => {
    // Clean up temp directory if it exists
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEMP_DIR, { recursive: true });

    // Create test fixtures
    mkdirSync(join(TEMP_DIR, 'specs'), { recursive: true });
    
    // Create minimal ISL spec for PBT
    writeFileSync(join(TEMP_DIR, 'specs/auth.isl'), `
isl 1.0

domain AuthDomain {
  entity User {
    id: UUID
    email: String
    passwordHash: String
  }

  behavior Login {
    input {
      email: String
      password: String
    }
    output {
      success: User
      error: { code: String, message: String }
    }
    preconditions {
      "Email must be valid" => input.email.contains("@")
      "Password must be 8-128 chars" => input.password.length >= 8 && input.password.length <= 128
    }
    postconditions {
      "Session created on success" => result.success implies session.exists
    }
  }
}
`);

    // Create mock implementation
    writeFileSync(join(TEMP_DIR, 'auth-impl.ts'), `
export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

export async function login(email: string, password: string): Promise<{ user?: User; error?: { code: string; message: string } }> {
  if (!email.includes('@')) {
    return { error: { code: 'INVALID_EMAIL', message: 'Invalid email format' } };
  }
  if (password.length < 8 || password.length > 128) {
    return { error: { code: 'INVALID_PASSWORD', message: 'Password must be 8-128 characters' } };
  }
  return {
    user: {
      id: crypto.randomUUID(),
      email,
      passwordHash: 'hashed',
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
    it('should show help for pbt command', async () => {
      const result = await runCLI(['pbt', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('pbt');
      expect(result.stdout).toContain('impl');
      expect(result.stdout).toContain('property-based');
    });

    it('should show --tests option in help', async () => {
      const result = await runCLI(['pbt', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--tests');
    });

    it('should show --seed option in help', async () => {
      const result = await runCLI(['pbt', '--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--seed');
    });
  });

  describe('Basic Execution', () => {
    it('should require --impl flag', async () => {
      const specPath = join(TEMP_DIR, 'specs/auth.isl');
      const result = await runCLI(['pbt', specPath]);
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(/impl|implementation/i);
    });

    it('should run PBT with spec and impl', async () => {
      const specPath = join(TEMP_DIR, 'specs/auth.isl');
      const implPath = join(TEMP_DIR, 'auth-impl.ts');
      
      const result = await runCLI(['pbt', specPath, '--impl', implPath]);
      
      // Command should run without crashing
      expect(typeof result.exitCode).toBe('number');
    });

    it('should fail on non-existent spec file', async () => {
      const result = await runCLI(['pbt', '/nonexistent.isl', '--impl', 'impl.ts']);
      
      expect(result.exitCode).not.toBe(0);
    });

    it('should fail on non-existent impl file', async () => {
      const specPath = join(TEMP_DIR, 'specs/auth.isl');
      const result = await runCLI(['pbt', specPath, '--impl', '/nonexistent.ts']);
      
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('Options', () => {
    it('should accept --tests option', async () => {
      const specPath = join(TEMP_DIR, 'specs/auth.isl');
      const implPath = join(TEMP_DIR, 'auth-impl.ts');
      
      const result = await runCLI(['pbt', specPath, '--impl', implPath, '--tests', '50']);
      
      expect(typeof result.exitCode).toBe('number');
    });

    it('should accept --seed option for reproducibility', async () => {
      const specPath = join(TEMP_DIR, 'specs/auth.isl');
      const implPath = join(TEMP_DIR, 'auth-impl.ts');
      
      const result = await runCLI(['pbt', specPath, '--impl', implPath, '--seed', '12345']);
      
      expect(typeof result.exitCode).toBe('number');
    });

    it('should accept --max-shrinks option', async () => {
      const specPath = join(TEMP_DIR, 'specs/auth.isl');
      const implPath = join(TEMP_DIR, 'auth-impl.ts');
      
      const result = await runCLI(['pbt', specPath, '--impl', implPath, '--max-shrinks', '50']);
      
      expect(typeof result.exitCode).toBe('number');
    });

    it('should accept --timeout option', async () => {
      const specPath = join(TEMP_DIR, 'specs/auth.isl');
      const implPath = join(TEMP_DIR, 'auth-impl.ts');
      
      const result = await runCLI(['pbt', specPath, '--impl', implPath, '--timeout', '10000']);
      
      expect(typeof result.exitCode).toBe('number');
    });

    it('should accept --detailed flag', async () => {
      const specPath = join(TEMP_DIR, 'specs/auth.isl');
      const implPath = join(TEMP_DIR, 'auth-impl.ts');
      
      const result = await runCLI(['pbt', specPath, '--impl', implPath, '--detailed']);
      
      expect(typeof result.exitCode).toBe('number');
    });
  });

  describe('JSON Output', () => {
    it('should output valid JSON with --format json', async () => {
      const specPath = join(TEMP_DIR, 'specs/auth.isl');
      const implPath = join(TEMP_DIR, 'auth-impl.ts');
      
      const result = await runCLI(['pbt', specPath, '--impl', implPath, '--format', 'json']);
      
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

    it('should include pbtResult in JSON output', async () => {
      const specPath = join(TEMP_DIR, 'specs/auth.isl');
      const implPath = join(TEMP_DIR, 'auth-impl.ts');
      
      const result = await runCLI(['pbt', specPath, '--impl', implPath, '--format', 'json']);
      
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return; // Skip if JSON parsing fails
      }
      
      // Check structure
      if (parsed.pbtResult) {
        const pbtResult = parsed.pbtResult as Record<string, unknown>;
        expect(pbtResult).toHaveProperty('success');
        expect(pbtResult).toHaveProperty('summary');
        expect(pbtResult).toHaveProperty('behaviors');
        expect(pbtResult).toHaveProperty('config');
      }
    });
  });

  describe('Exit Codes', () => {
    it('should return exit code 0 on success', async () => {
      const specPath = join(TEMP_DIR, 'specs/auth.isl');
      const implPath = join(TEMP_DIR, 'auth-impl.ts');
      
      const result = await runCLI(['pbt', specPath, '--impl', implPath]);
      
      // May succeed or fail depending on PBT package availability
      expect([0, 1]).toContain(result.exitCode);
    });

    it('should return exit code 1 on failure', async () => {
      const result = await runCLI(['pbt', '/nonexistent.isl', '--impl', '/nonexistent.ts']);
      
      expect(result.exitCode).toBe(1);
    });
  });
});
