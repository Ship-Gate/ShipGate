import { describe, it, expect, vi } from 'vitest';

describe('Runtime Monitor Middleware', () => {
  function createMockReq(overrides: Record<string, unknown> = {}) {
    return {
      method: 'POST',
      url: '/api/users',
      path: '/api/users',
      headers: { 'content-type': 'application/json' },
      body: { name: 'Test User', email: 'test@example.com' },
      user: null,
      ...overrides,
    };
  }

  function createMockRes() {
    const res: Record<string, unknown> = {
      statusCode: 200,
      _headers: {} as Record<string, string>,
      _jsonBody: null,
    };
    res.json = vi.fn((body: unknown) => { res._jsonBody = body; return res; });
    res.send = vi.fn((body: unknown) => { res._body = body; return res; });
    res.setHeader = vi.fn((key: string, val: string) => { (res._headers as Record<string, string>)[key] = val; return res; });
    res.end = vi.fn(() => res);
    return res;
  }

  it('generates contracts from ISL spec', async () => {
    const { generateContracts } = await import('../src/contract-generator.js');
    const spec = `
      domain UserService {
        entity User {
          name: String
          email: Email
        }
        behavior CreateUser {
          input { name: String, email: Email }
          output { user: User }
          preconditions { auth: authenticated }
          postconditions { result.user.name == input.name }
        }
      }
    `;
    const contracts = generateContracts(spec);
    expect(contracts.length).toBeGreaterThan(0);
  });

  it('creates middleware from contracts', async () => {
    const { createMonitorMiddleware } = await import('../src/middleware.js');
    const contracts = [{
      id: 'test',
      route: '/api/users',
      method: 'POST',
      preconditions: [{ expression: 'req.body.name', description: 'Name required', severity: 'critical' as const, source: 'isl-spec' as const }],
      postconditions: [],
      invariants: [],
    }];
    const middleware = createMonitorMiddleware(contracts);
    expect(typeof middleware).toBe('function');
  });

  it('generates standalone middleware code', async () => {
    const { generateMiddlewareCode } = await import('../src/codegen.js');
    const contracts = [{
      id: 'test',
      route: '/api/users',
      method: 'POST',
      preconditions: [{ expression: 'req.body.name', description: 'Name required', severity: 'warning' as const, source: 'isl-spec' as const }],
      postconditions: [],
      invariants: [],
    }];
    const code = generateMiddlewareCode(contracts);
    expect(code).toContain('createISLMonitor');
    expect(code.length).toBeGreaterThan(100);
  });

  it('reporter tracks violation stats', async () => {
    const { ViolationReporter } = await import('../src/reporter.js');
    const reporter = new ViolationReporter({ enabled: true, sampleRate: 1.0, logViolations: false });
    reporter.addViolation({
      contractId: 'test',
      assertionType: 'precondition',
      expression: 'req.body.name',
      actual: undefined,
      expected: 'truthy',
      timestamp: Date.now(),
      requestId: 'req-1',
      route: '/api/users',
      method: 'POST',
      severity: 'critical',
    });
    const stats = reporter.getStats();
    expect(stats.total).toBe(1);
    reporter.destroy();
  });
});
