import { describe, it, expect, vi } from 'vitest';
import { Orchestrator } from '../src/orchestrator.js';
import type { OrchestratorResult, OrchestratorEvent } from '../src/orchestrator.js';

// Minimal valid ISL for testing (bypasses the translator by testing internal methods)
const VALID_ISL = `
domain Auth "1.0" {
  entity User {
    id: ID
    email: Email
    name: String
  }

  behavior Login {
    input {
      email: Email
      password: String
    }
    output {
      success: Session
      errors {
        InvalidCredentials {
          when: "email or password is wrong"
          retriable: false
        }
      }
    }
    preconditions {
      email.is_valid
    }
    postconditions {
      success implies {
        result.session.is_active
      }
    }
  }

  behavior Register {
    input {
      email: Email
      password: String
      name: String
    }
    output {
      success: User
    }
    preconditions {
      email.is_valid
      password.length >= 8
    }
    postconditions {
      success implies {
        User.exists(result.id)
      }
    }
  }
}
`;

// ── Triage ──────────────────────────────────────────────────────────────────

describe('Orchestrator — triage', () => {
  it('classifies new-feature requests', async () => {
    const orch = new Orchestrator();
    // Access private method via any cast for unit testing
    const triage = await (orch as any).triage('Build a login system with JWT auth');
    expect(triage.type).toBe('new-feature');
    expect(triage.scope).not.toBe('simple'); // "system" → complex
    expect(triage.confidence).toBeGreaterThan(0.5);
  });

  it('classifies questions', async () => {
    const orch = new Orchestrator();
    const triage = await (orch as any).triage('What is ISL?');
    expect(triage.type).toBe('question');
  });

  it('classifies fix-bug requests', async () => {
    const orch = new Orchestrator();
    const triage = await (orch as any).triage('Fix the login error on the checkout page');
    expect(triage.type).toBe('fix-bug');
  });

  it('classifies refactor requests', async () => {
    const orch = new Orchestrator();
    const triage = await (orch as any).triage('Refactor the auth module to be cleaner');
    expect(triage.type).toBe('refactor');
  });

  it('detects complex scope', async () => {
    const orch = new Orchestrator();
    const triage = await (orch as any).triage('Build a full SaaS application');
    expect(triage.scope).toBe('complex');
    expect(triage.requiresPlanning).toBe(true);
  });

  it('detects moderate scope', async () => {
    const orch = new Orchestrator();
    const triage = await (orch as any).triage('Add a REST API endpoint');
    expect(triage.scope).toBe('moderate');
    expect(triage.requiresPlanning).toBe(true);
  });

  it('detects simple scope', async () => {
    const orch = new Orchestrator();
    const triage = await (orch as any).triage('Add a helper function');
    expect(triage.scope).toBe('simple');
    expect(triage.requiresPlanning).toBe(false);
  });
});

// ── ISL Parsing ─────────────────────────────────────────────────────────────

describe('Orchestrator — parseDomain', () => {
  it('parses valid ISL into a domain', async () => {
    const orch = new Orchestrator();
    const domain = await (orch as any).parseDomain(VALID_ISL);
    expect(domain).not.toBeNull();
    expect(domain.name.name).toBe('Auth');
    expect(domain.entities).toHaveLength(1);
    expect(domain.entities[0].name.name).toBe('User');
    expect(domain.behaviors).toHaveLength(2);
    expect(domain.behaviors[0].name.name).toBe('Login');
    expect(domain.behaviors[1].name.name).toBe('Register');
  });

  it('returns null for invalid ISL', async () => {
    const orch = new Orchestrator();
    const domain = await (orch as any).parseDomain('this is not valid ISL at all');
    expect(domain).toBeNull();
  });

  it('returns null for empty ISL', async () => {
    const orch = new Orchestrator();
    const domain = await (orch as any).parseDomain('');
    expect(domain).toBeNull();
  });
});

// ── Code Generation (executeStep) ────────────────────────────────────────────

describe('Orchestrator — executeStep', () => {
  it('generates architecture summary for architect agent', async () => {
    const orch = new Orchestrator();
    const files = await (orch as any).executeStep(
      { id: 'arch-1', agent: 'architect', name: 'Arch', description: '', dependencies: [], estimatedComplexity: 'low' },
      VALID_ISL
    );
    expect(files.length).toBeGreaterThanOrEqual(1);
    const archFile = files.find((f: any) => f.path.includes('ARCHITECTURE'));
    expect(archFile).toBeDefined();
    expect(archFile.content).toContain('Auth');
    expect(archFile.content).toContain('User');
    expect(archFile.content).toContain('Login');
    expect(archFile.content).toContain('Register');
  });

  it('generates type files for backend agent', async () => {
    const orch = new Orchestrator();
    const files = await (orch as any).executeStep(
      { id: 'backend-1', agent: 'backend', name: 'Backend', description: '', dependencies: [], estimatedComplexity: 'medium' },
      VALID_ISL
    );
    // Should produce types + behavior scaffold (no API key → scaffold)
    const typeFiles = files.filter((f: any) => f.type === 'types');
    const implFiles = files.filter((f: any) => f.type === 'implementation');
    expect(typeFiles.length).toBeGreaterThanOrEqual(1);
    expect(implFiles.length).toBeGreaterThanOrEqual(1);
  });

  it('generates behavior scaffold without API key', async () => {
    const orch = new Orchestrator();
    const files = await (orch as any).executeStep(
      { id: 'backend-1', agent: 'backend', name: 'Backend', description: '', dependencies: [], estimatedComplexity: 'medium' },
      VALID_ISL
    );
    const implFile = files.find((f: any) => f.type === 'implementation');
    expect(implFile).toBeDefined();
    expect(implFile.content).toContain('Login');
    expect(implFile.content).toContain('Register');
    expect(implFile.content).toContain('throw new Error');
  });

  it('generates test files for test agent', async () => {
    const orch = new Orchestrator();
    const files = await (orch as any).executeStep(
      { id: 'test-1', agent: 'test', name: 'Tests', description: '', dependencies: [], estimatedComplexity: 'medium' },
      VALID_ISL
    );
    expect(files.length).toBeGreaterThanOrEqual(1);
    const testFile = files.find((f: any) => f.type === 'test');
    expect(testFile).toBeDefined();
    expect(testFile.content).toContain('describe');
    expect(testFile.content).toContain('Login');
    expect(testFile.content).toContain('Register');
  });

  it('generates React stubs for frontend agent', async () => {
    const orch = new Orchestrator();
    const files = await (orch as any).executeStep(
      { id: 'frontend-1', agent: 'frontend', name: 'Frontend', description: '', dependencies: [], estimatedComplexity: 'medium' },
      VALID_ISL
    );
    expect(files.length).toBeGreaterThanOrEqual(1);
    const componentFile = files.find((f: any) => f.type === 'implementation');
    expect(componentFile).toBeDefined();
    expect(componentFile.content).toContain('UserList');
    expect(componentFile.content).toContain('React');
  });

  it('generates security review for security agent', async () => {
    const orch = new Orchestrator();
    const files = await (orch as any).executeStep(
      { id: 'security-1', agent: 'security', name: 'Security', description: '', dependencies: [], estimatedComplexity: 'low' },
      VALID_ISL
    );
    // Auth domain may or may not have auth preconditions, but the function should not throw
    expect(Array.isArray(files)).toBe(true);
  });

  it('returns empty files for invalid ISL', async () => {
    const orch = new Orchestrator();
    const files = await (orch as any).executeStep(
      { id: 'backend-1', agent: 'backend', name: 'Backend', description: '', dependencies: [], estimatedComplexity: 'medium' },
      'not valid ISL'
    );
    expect(files).toHaveLength(0);
  });
});

// ── Verification ──────────────────────────────────────────────────────────────

describe('Orchestrator — verify', () => {
  it('verifies generated code against ISL spec', async () => {
    const orch = new Orchestrator();
    const files = [
      {
        path: 'generated/types.ts',
        content: 'export interface User { id: string; email: string; name: string; }',
        type: 'types' as const,
      },
      {
        path: 'generated/behaviors.ts',
        content: `
export async function login(input: { email: string; password: string }) {
  if (!input.email) throw new Error('Invalid email');
  return { session: { isActive: true } };
}
export async function register(input: { email: string; password: string; name: string }) {
  if (!input.email) throw new Error('Invalid email');
  return { id: '1', email: input.email, name: input.name };
}
`,
        type: 'implementation' as const,
      },
      {
        path: 'generated/spec.test.ts',
        content: "import { describe, it, expect } from 'vitest';\ndescribe('Auth', () => { it('works', () => { expect(true).toBe(true); }); });",
        type: 'test' as const,
      },
    ];

    const result = await (orch as any).verify(VALID_ISL, files);
    expect(result.trustScore).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.breakdown).toBeDefined();
    expect(result.breakdown.preconditions.total).toBeGreaterThan(0);
  });

  it('fails verification when no implementation files exist', async () => {
    const orch = new Orchestrator();
    const files = [
      { path: 'generated/types.ts', content: 'export {}', type: 'types' as const },
    ];

    const result = await (orch as any).verify(VALID_ISL, files);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some((i: string) => i.includes('Missing implementation'))).toBe(true);
    expect(result.trustScore).toBeLessThan(100);
  });

  it('fails verification for invalid ISL', async () => {
    const orch = new Orchestrator();
    const result = await (orch as any).verify('not valid ISL', []);
    expect(result.success).toBe(false);
    expect(result.trustScore).toBe(0);
    expect(result.issues).toContain('Failed to parse ISL specification');
  });

  it('detects missing error handling', async () => {
    const orch = new Orchestrator();
    const files = [
      { path: 'generated/types.ts', content: 'export interface User {}', type: 'types' as const },
      // No throw/catch/Error in implementation
      { path: 'generated/behaviors.ts', content: 'export function login() { return true; }\nexport function register() { return true; }', type: 'implementation' as const },
      { path: 'generated/spec.test.ts', content: "describe('x', () => {})", type: 'test' as const },
    ];

    const result = await (orch as any).verify(VALID_ISL, files);
    // Login has an error spec (InvalidCredentials), so error handling should be checked
    expect(result.breakdown.errors.total).toBeGreaterThan(0);
  });
});

// ── Planning ──────────────────────────────────────────────────────────────────

describe('Orchestrator — planning', () => {
  it('creates a simple plan for simple requests', () => {
    const orch = new Orchestrator();
    const plan = (orch as any).simplePlan(VALID_ISL);
    expect(plan.steps.length).toBe(2);
    expect(plan.totalSteps).toBe(2);
    expect(plan.steps[0].agent).toBe('backend');
    expect(plan.steps[1].agent).toBe('test');
  });

  it('creates a complex plan with security for auth projects', async () => {
    const orch = new Orchestrator();
    const triage = {
      scope: 'complex' as const,
      type: 'new-feature' as const,
      suggestedLibraries: ['stdlib-auth'],
      requiresPlanning: true,
      confidence: 0.85,
    };
    const plan = await (orch as any).plan(VALID_ISL, triage);
    expect(plan.steps.length).toBeGreaterThanOrEqual(5); // arch + types + backend + frontend + test + security
    expect(plan.steps.some((s: any) => s.agent === 'security')).toBe(true);
    expect(plan.steps.some((s: any) => s.agent === 'frontend')).toBe(true);
  });
});

// ── Event Emission ───────────────────────────────────────────────────────────

describe('Orchestrator — events', () => {
  it('emits events during pipeline execution', async () => {
    const events: OrchestratorEvent[] = [];
    const orch = new Orchestrator({
      verify: false,
      onEvent: (e) => events.push(e),
    });

    // Run a triage-only path (question type stops early)
    const result = await orch.run('What is ISL?');
    expect(result.success).toBe(true);
    expect(result.triage.type).toBe('question');
    expect(events.some(e => e.type === 'triage')).toBe(true);
  });
});

// ── Full Pipeline (question shortcut) ─────────────────────────────────────────

describe('Orchestrator — full pipeline', () => {
  it('handles questions without full pipeline', async () => {
    const orch = new Orchestrator();
    const result = await orch.run('How does ISL work?');
    expect(result.success).toBe(true);
    expect(result.triage.type).toBe('question');
    expect(result.isl).toBeUndefined();
    expect(result.plan).toBeUndefined();
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('generates a request ID for every run', async () => {
    const orch = new Orchestrator();
    const result = await orch.run('What is this?');
    expect(result.requestId).toBeDefined();
    expect(result.requestId).toMatch(/^req_/);
  });
});

// ── Helper methods ───────────────────────────────────────────────────────────

describe('Orchestrator — helper methods', () => {
  it('generates type stubs from domain', async () => {
    const orch = new Orchestrator();
    const domain = await (orch as any).parseDomain(VALID_ISL);
    const stubs = (orch as any).generateTypeStubs(domain);
    expect(stubs).toContain('export interface User');
    expect(stubs).toContain('id:');
    expect(stubs).toContain('email:');
    expect(stubs).toContain('name:');
  });

  it('generates behavior scaffold from domain', async () => {
    const orch = new Orchestrator();
    const domain = await (orch as any).parseDomain(VALID_ISL);
    const scaffold = (orch as any).generateBehaviorScaffold(domain);
    expect(scaffold).toContain('login');
    expect(scaffold).toContain('register');
    expect(scaffold).toContain('throw new Error');
    expect(scaffold).toContain('async function');
  });

  it('generates test scaffold from domain', async () => {
    const orch = new Orchestrator();
    const domain = await (orch as any).parseDomain(VALID_ISL);
    const tests = (orch as any).generateTestScaffold(domain);
    expect(tests).toContain("describe('Auth'");
    expect(tests).toContain("describe('Login'");
    expect(tests).toContain("describe('Register'");
    expect(tests).toContain('vitest');
  });

  it('generates React stubs from domain', async () => {
    const orch = new Orchestrator();
    const domain = await (orch as any).parseDomain(VALID_ISL);
    const react = (orch as any).generateReactStubs(domain);
    expect(react).toContain('UserList');
    expect(react).toContain('React');
    expect(react).toContain('items');
  });
});
