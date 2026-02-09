import { describe, it, expect } from 'vitest';
import { parseISL, parseISLFile } from '../src/parse.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

// ============================================================================
// parseISL
// ============================================================================

describe('parseISL', () => {
  it('parses a valid ISL domain and returns a DomainSummary', () => {
    const result = parseISL(`
      domain Auth {
        version: "1.0.0"
        behavior Login {
          input {
            email: String
            password: String
          }
          output {
            success: Boolean
          }
          pre {
            input.email != ""
          }
          post success {
            result == true
          }
        }
      }
    `);

    expect(result.success).toBe(true);
    expect(result.domain).toBeDefined();
    expect(result.domain!.name).toBe('Auth');
    expect(result.domain!.version).toBe('1.0.0');
    expect(result.domain!.behaviors).toHaveLength(1);

    const login = result.domain!.behaviors[0];
    expect(login.name).toBe('Login');
    expect(login.preconditions.length).toBeGreaterThanOrEqual(1);
    expect(login.postconditions.length).toBeGreaterThanOrEqual(1);
  });

  it('returns errors for invalid ISL', () => {
    const result = parseISL('this is not valid ISL at all');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toBeTruthy();
  });

  it('returns errors for empty string', () => {
    const result = parseISL('');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('produces read-only results (Object.freeze)', () => {
    const result = parseISL(`
      domain Test {
        version: "1.0.0"
        behavior DoSomething {
          input { value: String }
          output { success: Boolean }
          post success {
            result == true
          }
        }
      }
    `);

    expect(result.success).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    if (result.domain) {
      expect(Object.isFrozen(result.domain)).toBe(true);
      expect(Object.isFrozen(result.domain.behaviors)).toBe(true);
    }
  });

  it('summarizes multiple behaviors correctly', () => {
    const result = parseISL(`
      domain Shopping {
        version: "2.0.0"
        entity Cart {
          items: List<String>
        }

        behavior AddToCart {
          input { item: String }
          output { success: Boolean }
          post success {
            result == true
          }
        }

        behavior Checkout {
          input { cartId: UUID }
          output { success: Boolean }
          post success {
            result == true
          }
        }
      }
    `);

    expect(result.success).toBe(true);
    expect(result.domain!.behaviors).toHaveLength(2);
    expect(result.domain!.behaviors.map((b) => b.name)).toEqual([
      'AddToCart',
      'Checkout',
    ]);
    expect(result.domain!.entities).toContain('Cart');
  });

  it('includes domain-level invariants', () => {
    const result = parseISL(`
      domain Banking {
        version: "1.0.0"
        invariants MoneyRules {
          scope: global
          balance >= 0
        }
        behavior Transfer {
          input { amount: Decimal }
          output { success: Boolean }
          post success {
            result == true
          }
        }
      }
    `);

    expect(result.success).toBe(true);
    expect(result.domain!.invariants).toContain('MoneyRules');
  });

  it('errors include message information', () => {
    const result = parseISL('domain {');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    const err = result.errors[0];
    expect(err.message).toBeTruthy();
  });

  it('preconditions are returned as readable strings', () => {
    const result = parseISL(`
      domain Test {
        version: "1.0.0"
        behavior Create {
          input { value: Int }
          output { success: Boolean }
          pre {
            input.value > 0
          }
          post success {
            result == true
          }
        }
      }
    `);

    expect(result.success).toBe(true);
    const behavior = result.domain!.behaviors[0];
    expect(behavior.preconditions.length).toBeGreaterThan(0);
    // Preconditions should be human-readable strings, not AST nodes
    expect(typeof behavior.preconditions[0]).toBe('string');
    expect(behavior.preconditions[0]).toContain('>');
  });

  it('postconditions are returned as readable strings', () => {
    const result = parseISL(`
      domain Test {
        version: "1.0.0"
        behavior Check {
          input { x: Int }
          output { success: Boolean }
          post success {
            result == true
          }
        }
      }
    `);

    expect(result.success).toBe(true);
    const behavior = result.domain!.behaviors[0];
    expect(behavior.postconditions.length).toBeGreaterThan(0);
    expect(typeof behavior.postconditions[0]).toBe('string');
  });
});

// ============================================================================
// parseISLFile
// ============================================================================

describe('parseISLFile', () => {
  it('parses a valid ISL file from disk', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sdk-test-'));
    const filePath = path.join(tmpDir, 'test.isl');

    await fs.writeFile(
      filePath,
      `domain FileTest {
        version: "1.0.0"
        behavior Ping {
          input { msg: String }
          output { success: Boolean }
          post success {
            result == true
          }
        }
      }`,
    );

    try {
      const result = await parseISLFile(filePath);

      expect(result.success).toBe(true);
      expect(result.domain).toBeDefined();
      expect(result.domain!.name).toBe('FileTest');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns an error for a non-existent file', async () => {
    const result = await parseISLFile('/tmp/does-not-exist-ever.isl');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
