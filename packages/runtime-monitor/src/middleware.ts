import type {
  Contract,
  ContractViolation,
  MonitorConfig,
  IncomingRequest,
  OutgoingResponse,
  NextFunction,
  RequestHandler,
  Assertion,
  AssertionType,
} from './types.js';
import { ViolationReporter } from './reporter.js';

const DEFAULT_CONFIG: MonitorConfig = {
  enabled: true,
  sampleRate: 1.0,
  logViolations: true,
};

let requestCounter = 0;

function generateRequestId(): string {
  return `rm-${Date.now()}-${++requestCounter}`;
}

function matchRoute(pattern: string, actual: string): boolean {
  const patternParts = pattern.split('/').filter(Boolean);
  const actualParts = actual.split('/').filter(Boolean);

  if (patternParts.length !== actualParts.length) return false;

  return patternParts.every((part, i) => {
    if (part.startsWith(':') || part.startsWith('{')) return true;
    return part === actualParts[i];
  });
}

function getRequestPath(req: IncomingRequest): string {
  if (req.path) return req.path;
  if (req.url) {
    const qIdx = req.url.indexOf('?');
    return qIdx >= 0 ? req.url.slice(0, qIdx) : req.url;
  }
  return '/';
}

function resolveValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateAssertion(
  assertion: Assertion,
  context: { req: IncomingRequest; res?: OutgoingResponse },
): { passed: boolean; actual: unknown; expected: unknown } {
  const expr = assertion.expression;

  const neqMatch = expr.match(/^(.+?)\s*!=\s*null$/);
  if (neqMatch) {
    const path = neqMatch[1]!.trim();
    const actual = resolveFromContext(path, context);
    return { passed: actual != null, actual, expected: 'not null' };
  }

  const eqStringMatch = expr.match(/^(.+?)\s*==\s*"(.+)"$/);
  if (eqStringMatch) {
    const path = eqStringMatch[1]!.trim();
    const expected = eqStringMatch[2]!;
    const actual = resolveFromContext(path, context);
    return { passed: actual === expected, actual, expected };
  }

  const eqNumMatch = expr.match(/^(.+?)\s*==\s*(\d+(?:\.\d+)?)$/);
  if (eqNumMatch) {
    const path = eqNumMatch[1]!.trim();
    const expected = Number(eqNumMatch[2]);
    const actual = resolveFromContext(path, context);
    return { passed: Number(actual) === expected, actual, expected };
  }

  const typeofMatch = expr.match(/^typeof\s+(.+?)\s*==\s*"(\w+)"(.*)$/);
  if (typeofMatch) {
    const path = typeofMatch[1]!.trim();
    const expectedType = typeofMatch[2]!;
    const actual = resolveFromContext(path, context);
    const typeMatches = typeof actual === expectedType;

    const rest = typeofMatch[3]?.trim() ?? '';
    if (rest.startsWith('&& ') && rest.includes('.match(')) {
      if (!typeMatches || typeof actual !== 'string') {
        return { passed: false, actual: typeof actual, expected: expectedType };
      }
      const regexMatch = rest.match(/\.match\(\/(.+)\/([gimsuy]*)\)/);
      if (regexMatch) {
        try {
          const regex = new RegExp(regexMatch[1]!, regexMatch[2] ?? '');
          const matches = regex.test(actual);
          return { passed: matches, actual, expected: `matches ${regex}` };
        } catch {
          return { passed: false, actual, expected: 'valid regex match' };
        }
      }
    }

    return { passed: typeMatches, actual: typeof actual, expected: expectedType };
  }

  const gtMatch = expr.match(/^(.+?)\s*>\s*(\d+(?:\.\d+)?)$/);
  if (gtMatch) {
    const path = gtMatch[1]!.trim();
    const threshold = Number(gtMatch[2]);
    const actual = resolveFromContext(path, context);
    return { passed: Number(actual) > threshold, actual, expected: `> ${threshold}` };
  }

  const ltMatch = expr.match(/^(.+?)\s*<\s*(\d+(?:\.\d+)?)$/);
  if (ltMatch) {
    const path = ltMatch[1]!.trim();
    const threshold = Number(ltMatch[2]);
    const actual = resolveFromContext(path, context);
    return { passed: Number(actual) < threshold, actual, expected: `< ${threshold}` };
  }

  const gteMatch = expr.match(/^(.+?)\s*>=\s*(\d+(?:\.\d+)?)$/);
  if (gteMatch) {
    const path = gteMatch[1]!.trim();
    const threshold = Number(gteMatch[2]);
    const actual = resolveFromContext(path, context);
    return { passed: Number(actual) >= threshold, actual, expected: `>= ${threshold}` };
  }

  const lteMatch = expr.match(/^(.+?)\s*<=\s*(\d+(?:\.\d+)?)$/);
  if (lteMatch) {
    const path = lteMatch[1]!.trim();
    const threshold = Number(lteMatch[2]);
    const actual = resolveFromContext(path, context);
    return { passed: Number(actual) <= threshold, actual, expected: `<= ${threshold}` };
  }

  const boolMatch = expr.match(/^(.+?)\s*==\s*(true|false)$/);
  if (boolMatch) {
    const path = boolMatch[1]!.trim();
    const expected = boolMatch[2] === 'true';
    const actual = resolveFromContext(path, context);
    return { passed: actual === expected, actual, expected };
  }

  return { passed: true, actual: 'unevaluated', expected: 'unevaluated' };
}

function resolveFromContext(
  path: string,
  context: { req: IncomingRequest; res?: OutgoingResponse },
): unknown {
  if (path.startsWith('req.')) {
    return resolveValue(context.req, path.slice(4));
  }
  if (path.startsWith('res.')) {
    return context.res ? resolveValue(context.res, path.slice(4)) : undefined;
  }
  if (path.startsWith('result.') && context.res) {
    return resolveValue(context.res.body, path.slice(7));
  }
  return resolveValue(context.req, path);
}

function checkAssertions(
  assertions: Assertion[],
  assertionType: AssertionType,
  contract: Contract,
  context: { req: IncomingRequest; res?: OutgoingResponse },
  requestId: string,
): ContractViolation[] {
  const violations: ContractViolation[] = [];

  for (const assertion of assertions) {
    const { passed, actual, expected } = evaluateAssertion(assertion, context);

    if (!passed) {
      violations.push({
        contractId: contract.id,
        assertionType,
        expression: assertion.expression,
        actual,
        expected,
        timestamp: Date.now(),
        requestId,
        route: contract.route,
        method: contract.method,
        severity: assertion.severity,
      });
    }
  }

  return violations;
}

export function createMonitorMiddleware(
  contracts: Contract[],
  config?: Partial<MonitorConfig>,
): RequestHandler {
  const cfg: MonitorConfig = { ...DEFAULT_CONFIG, ...config };
  const reporter = new ViolationReporter({
    reportEndpoint: cfg.reportEndpoint,
    logViolations: cfg.logViolations,
    flushIntervalMs: 30_000,
  });

  return function runtimeMonitorMiddleware(
    req: IncomingRequest,
    res: OutgoingResponse,
    next: NextFunction,
  ): void {
    if (!cfg.enabled) {
      next();
      return;
    }

    if (cfg.sampleRate < 1.0 && Math.random() > cfg.sampleRate) {
      next();
      return;
    }

    const requestPath = getRequestPath(req);
    const requestMethod = (req.method ?? 'GET').toUpperCase();
    const requestId = generateRequestId();

    const matchingContracts = contracts.filter(
      (c) => matchRoute(c.route, requestPath) && c.method === requestMethod,
    );

    if (matchingContracts.length === 0) {
      next();
      return;
    }

    for (const contract of matchingContracts) {
      const preViolations = checkAssertions(
        contract.preconditions,
        'precondition',
        contract,
        { req },
        requestId,
      );

      for (const v of preViolations) {
        reporter.addViolation(v);
        cfg.onViolation?.(v);
      }
    }

    const originalEnd = (res as any).end;
    const originalJson = (res as any).json;

    let responseBody: unknown;

    if (typeof originalJson === 'function') {
      (res as any).json = function interceptedJson(body: unknown) {
        responseBody = body;
        (res as any).body = body;

        for (const contract of matchingContracts) {
          const postViolations = checkAssertions(
            contract.postconditions,
            'postcondition',
            contract,
            { req, res },
            requestId,
          );
          const invViolations = checkAssertions(
            contract.invariants,
            'invariant',
            contract,
            { req, res },
            requestId,
          );

          for (const v of [...postViolations, ...invViolations]) {
            reporter.addViolation(v);
            cfg.onViolation?.(v);
          }
        }

        return originalJson.call(this, body);
      };
    }

    if (typeof originalEnd === 'function') {
      (res as any).end = function interceptedEnd(
        chunk?: unknown,
        encoding?: unknown,
        cb?: unknown,
      ) {
        if (chunk && typeof responseBody === 'undefined') {
          try {
            responseBody = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
            (res as any).body = responseBody;
          } catch {
            // Non-JSON body — skip postcondition checks on body
          }

          for (const contract of matchingContracts) {
            const postViolations = checkAssertions(
              contract.postconditions,
              'postcondition',
              contract,
              { req, res },
              requestId,
            );
            const invViolations = checkAssertions(
              contract.invariants,
              'invariant',
              contract,
              { req, res },
              requestId,
            );

            for (const v of [...postViolations, ...invViolations]) {
              reporter.addViolation(v);
              cfg.onViolation?.(v);
            }
          }
        }

        return originalEnd.call(this, chunk, encoding, cb);
      };
    }

    next();
  };
}

export function createMonitorMiddlewareWithReporter(
  contracts: Contract[],
  config?: Partial<MonitorConfig>,
): { middleware: RequestHandler; reporter: ViolationReporter } {
  const cfg: MonitorConfig = { ...DEFAULT_CONFIG, ...config };
  const reporter = new ViolationReporter({
    reportEndpoint: cfg.reportEndpoint,
    logViolations: cfg.logViolations,
    flushIntervalMs: 30_000,
  });

  const middleware = createMonitorMiddlewareInternal(contracts, cfg, reporter);
  return { middleware, reporter };
}

function createMonitorMiddlewareInternal(
  contracts: Contract[],
  cfg: MonitorConfig,
  reporter: ViolationReporter,
): RequestHandler {
  return function runtimeMonitorMiddleware(
    req: IncomingRequest,
    res: OutgoingResponse,
    next: NextFunction,
  ): void {
    if (!cfg.enabled) {
      next();
      return;
    }

    if (cfg.sampleRate < 1.0 && Math.random() > cfg.sampleRate) {
      next();
      return;
    }

    const requestPath = getRequestPath(req);
    const requestMethod = (req.method ?? 'GET').toUpperCase();
    const requestId = generateRequestId();

    const matchingContracts = contracts.filter(
      (c) => matchRoute(c.route, requestPath) && c.method === requestMethod,
    );

    if (matchingContracts.length === 0) {
      next();
      return;
    }

    for (const contract of matchingContracts) {
      const preViolations = checkAssertions(
        contract.preconditions,
        'precondition',
        contract,
        { req },
        requestId,
      );

      for (const v of preViolations) {
        reporter.addViolation(v);
        cfg.onViolation?.(v);
      }
    }

    const originalEnd = (res as any).end;
    const originalJson = (res as any).json;

    let responseBody: unknown;

    if (typeof originalJson === 'function') {
      (res as any).json = function interceptedJson(body: unknown) {
        responseBody = body;
        (res as any).body = body;
        runPostconditionChecks(matchingContracts, req, res, requestId, reporter, cfg);
        return originalJson.call(this, body);
      };
    }

    if (typeof originalEnd === 'function') {
      (res as any).end = function interceptedEnd(
        chunk?: unknown,
        encoding?: unknown,
        cb?: unknown,
      ) {
        if (chunk && typeof responseBody === 'undefined') {
          try {
            responseBody = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
            (res as any).body = responseBody;
          } catch {
            // Non-JSON response
          }
          runPostconditionChecks(matchingContracts, req, res, requestId, reporter, cfg);
        }
        return originalEnd.call(this, chunk, encoding, cb);
      };
    }

    next();
  };
}

function runPostconditionChecks(
  contracts: Contract[],
  req: IncomingRequest,
  res: OutgoingResponse,
  requestId: string,
  reporter: ViolationReporter,
  cfg: MonitorConfig,
): void {
  for (const contract of contracts) {
    const postViolations = checkAssertions(
      contract.postconditions,
      'postcondition',
      contract,
      { req, res },
      requestId,
    );
    const invViolations = checkAssertions(
      contract.invariants,
      'invariant',
      contract,
      { req, res },
      requestId,
    );

    for (const v of [...postViolations, ...invViolations]) {
      reporter.addViolation(v);
      cfg.onViolation?.(v);
    }
  }
}
