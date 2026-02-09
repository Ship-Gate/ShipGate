// ============================================================================
// Discovery Engine Tests
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { discover } from '../discovery-engine.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Discovery Engine', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = join(tmpdir(), `isl-discovery-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  it('should discover bindings for Fastify routes', async () => {
    // Create test ISL spec
    const specFile = join(testDir, 'auth.isl');
    await writeFile(specFile, `
domain UserAuthentication {
  version: "1.0.0"

  behavior Login {
    input {
      email: String
      password: String [sensitive]
    }
    output {
      success: Session
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
        }
      }
    }
  }

  behavior Register {
    input {
      email: String
      password: String [sensitive]
    }
    output {
      success: User
      errors {
        EMAIL_ALREADY_EXISTS {
          when: "Email already exists"
        }
      }
    }
  }
}
`, 'utf-8');

    // Create test Fastify routes
    const routesDir = join(testDir, 'src', 'routes');
    await mkdir(routesDir, { recursive: true });
    const routesFile = join(routesDir, 'auth.ts');
    await writeFile(routesFile, `
import { FastifyInstance } from 'fastify';

export function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/login', async (request, reply) => {
    // Login handler
    return { success: true };
  });

  app.post('/api/register', async (request, reply) => {
    // Register handler
    return { success: true };
  });
}
`, 'utf-8');

    // Run discovery
    const result = await discover({
      rootDir: testDir,
      specFiles: [specFile],
      codeDirs: [join(testDir, 'src')],
      minConfidence: 0.3,
      verbose: false,
    });

    // Verify results
    expect(result.stats.totalISLSymbols).toBeGreaterThan(0);
    expect(result.stats.totalCodeSymbols).toBeGreaterThan(0);
    expect(result.bindings.length).toBeGreaterThan(0);

    // Check that Login behavior was bound
    const loginBinding = result.bindings.find(
      b => b.islSymbol.name === 'Login' && b.islSymbol.type === 'behavior'
    );
    expect(loginBinding).toBeDefined();
    expect(loginBinding?.confidence).toBeGreaterThan(0.3);

    // Check that Register behavior was bound
    const registerBinding = result.bindings.find(
      b => b.islSymbol.name === 'Register' && b.islSymbol.type === 'behavior'
    );
    expect(registerBinding).toBeDefined();
    expect(registerBinding?.confidence).toBeGreaterThan(0.3);
  });

  it('should match by naming conventions', async () => {
    const specFile = join(testDir, 'users.isl');
    await writeFile(specFile, `
domain Users {
  behavior CreateUser {
    input {
      email: String
    }
    output {
      success: User
    }
  }
}
`, 'utf-8');

    const handlersFile = join(testDir, 'src', 'handlers', 'users.ts');
    await mkdir(join(testDir, 'src', 'handlers'), { recursive: true });
    await writeFile(handlersFile, `
export async function createUser(input: { email: string }) {
  return { id: '1', email: input.email };
}
`, 'utf-8');

    const result = await discover({
      rootDir: testDir,
      specFiles: [specFile],
      codeDirs: [join(testDir, 'src')],
      minConfidence: 0.3,
    });

    const binding = result.bindings.find(
      b => b.islSymbol.name === 'CreateUser'
    );
    expect(binding).toBeDefined();
    expect(binding?.codeSymbol.name).toContain('createUser');
  });

  it('should calculate confidence scores correctly', async () => {
    const specFile = join(testDir, 'test.isl');
    await writeFile(specFile, `
domain Test {
  behavior ExactMatch {
    input {}
    output { success: Boolean }
  }
}
`, 'utf-8');

    const codeFile = join(testDir, 'src', 'exact-match.ts');
    await writeFile(codeFile, `
export function exactMatch() {
  return true;
}
`, 'utf-8');

    const result = await discover({
      rootDir: testDir,
      specFiles: [specFile],
      codeDirs: [join(testDir, 'src')],
      minConfidence: 0.3,
    });

    const binding = result.bindings.find(
      b => b.islSymbol.name === 'ExactMatch'
    );
    expect(binding).toBeDefined();
    // Exact name match should have high confidence
    expect(binding?.confidence).toBeGreaterThan(0.8);
  });

  it('should handle unbound symbols', async () => {
    const specFile = join(testDir, 'unbound.isl');
    await writeFile(specFile, `
domain Test {
  behavior NotFound {
    input {}
    output { success: Boolean }
  }
}
`, 'utf-8');

    // No matching code
    const result = await discover({
      rootDir: testDir,
      specFiles: [specFile],
      codeDirs: [join(testDir, 'src')],
      minConfidence: 0.3,
    });

    expect(result.unboundSymbols.length).toBeGreaterThan(0);
    expect(result.unboundSymbols.some(s => s.name === 'NotFound')).toBe(true);
  });
});
