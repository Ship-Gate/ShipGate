import type { Contract, Assertion } from './types.js';

export function generateMiddlewareCode(contracts: Contract[]): string {
  const lines: string[] = [];

  lines.push(header(contracts.length));
  lines.push('');
  lines.push(runtimeTypes());
  lines.push('');
  lines.push(runtimeHelpers());
  lines.push('');
  lines.push(generateContractDefinitions(contracts));
  lines.push('');
  lines.push(generateMiddlewareFactory(contracts));
  lines.push('');
  lines.push(generateExports());

  return lines.join('\n');
}

function header(contractCount: number): string {
  return [
    '// ==========================================================================',
    '// ISL Runtime Monitor — Auto-Generated Contract Middleware',
    `// Generated at: ${new Date().toISOString()}`,
    `// Contracts: ${contractCount}`,
    '// ',
    '// This file is self-contained. No runtime dependency on @isl-lang/runtime-monitor.',
    '// Import and use as Express/Koa/Fastify middleware.',
    '// ==========================================================================',
    '',
    '/* eslint-disable */',
  ].join('\n');
}

function runtimeTypes(): string {
  return `
interface ContractViolation {
  contractId: string;
  assertionType: 'precondition' | 'postcondition' | 'invariant';
  expression: string;
  actual: unknown;
  expected: unknown;
  timestamp: number;
  requestId: string;
  route: string;
  method: string;
  severity: 'critical' | 'warning';
}

interface MonitorOptions {
  enabled?: boolean;
  onViolation?: (violation: ContractViolation) => void;
  sampleRate?: number;
  logViolations?: boolean;
}`.trim();
}

function runtimeHelpers(): string {
  return `
let _reqCounter = 0;

function _genReqId(): string {
  return \`rm-\${Date.now()}-\${++_reqCounter}\`;
}

function _resolve(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function _matchRoute(pattern: string, actual: string): boolean {
  const pp = pattern.split('/').filter(Boolean);
  const ap = actual.split('/').filter(Boolean);
  if (pp.length !== ap.length) return false;
  return pp.every((p, i) => p.startsWith(':') || p.startsWith('{') || p === ap[i]);
}

function _getPath(req: any): string {
  if (req.path) return req.path;
  if (req.url) {
    const q = req.url.indexOf('?');
    return q >= 0 ? req.url.slice(0, q) : req.url;
  }
  return '/';
}

function _report(v: ContractViolation, opts: MonitorOptions): void {
  if (opts.logViolations !== false) {
    const level = v.severity === 'critical' ? 'error' : 'warn';
    console[level](
      \`[isl-monitor] \${v.severity.toUpperCase()} \${v.method} \${v.route}: \` +
      \`\${v.assertionType} failed — \${v.expression}\`,
      { requestId: v.requestId, actual: v.actual },
    );
  }
  opts.onViolation?.(v);
}`.trim();
}

function generateContractDefinitions(contracts: Contract[]): string {
  const lines: string[] = [];
  lines.push('// --------------------------------------------------------------------------');
  lines.push('// Contract Definitions');
  lines.push('// --------------------------------------------------------------------------');
  lines.push('');

  for (const contract of contracts) {
    lines.push(`// Contract: ${contract.id}`);
    lines.push(`// Route: ${contract.method} ${contract.route}`);
    lines.push(`// Preconditions: ${contract.preconditions.length}, Postconditions: ${contract.postconditions.length}, Invariants: ${contract.invariants.length}`);
    lines.push('');
  }

  return lines.join('\n');
}

function generateMiddlewareFactory(contracts: Contract[]): string {
  const lines: string[] = [];

  lines.push('// --------------------------------------------------------------------------');
  lines.push('// Middleware Factory');
  lines.push('// --------------------------------------------------------------------------');
  lines.push('');
  lines.push('function createISLMonitor(opts: MonitorOptions = {}) {');
  lines.push('  const enabled = opts.enabled !== false;');
  lines.push('  const sampleRate = opts.sampleRate ?? 1.0;');
  lines.push('');
  lines.push('  return function islContractMonitor(req: any, res: any, next: (...args: any[]) => void) {');
  lines.push('    if (!enabled) return next();');
  lines.push('    if (sampleRate < 1.0 && Math.random() > sampleRate) return next();');
  lines.push('');
  lines.push('    const path = _getPath(req);');
  lines.push('    const method = (req.method ?? "GET").toUpperCase();');
  lines.push('    const requestId = _genReqId();');
  lines.push('    const violations: ContractViolation[] = [];');
  lines.push('');

  for (const contract of contracts) {
    lines.push(`    // --- ${contract.id}: ${contract.method} ${contract.route} ---`);
    lines.push(`    if (method === "${contract.method}" && _matchRoute("${contract.route}", path)) {`);

    if (contract.preconditions.length > 0) {
      lines.push('      // Precondition checks (validated on request entry)');
      for (const assertion of contract.preconditions) {
        lines.push(...generateAssertionCheck(contract, assertion, 'precondition', '      '));
      }
    }

    if (contract.postconditions.length > 0 || contract.invariants.length > 0) {
      lines.push('');
      lines.push('      // Intercept response to check postconditions and invariants');
      lines.push('      const _origJson = res.json;');
      lines.push('      if (typeof _origJson === "function") {');
      lines.push('        res.json = function(body: unknown) {');
      lines.push('          res.body = body;');

      for (const assertion of contract.postconditions) {
        lines.push(...generateAssertionCheck(contract, assertion, 'postcondition', '          '));
      }
      for (const assertion of contract.invariants) {
        lines.push(...generateAssertionCheck(contract, assertion, 'invariant', '          '));
      }

      lines.push('          return _origJson.call(this, body);');
      lines.push('        };');
      lines.push('      }');
    }

    lines.push('    }');
    lines.push('');
  }

  lines.push('    next();');
  lines.push('  };');
  lines.push('}');

  return lines.join('\n');
}

function generateAssertionCheck(
  contract: Contract,
  assertion: Assertion,
  assertionType: 'precondition' | 'postcondition' | 'invariant',
  indent: string,
): string[] {
  const lines: string[] = [];
  const { condition, valuePath } = parseAssertionExpression(assertion.expression);

  lines.push(`${indent}// ${assertion.description}`);

  if (condition) {
    lines.push(`${indent}{`);
    lines.push(`${indent}  const _val = ${generateValueAccess(valuePath)};`);
    lines.push(`${indent}  if (!(${condition})) {`);
    lines.push(`${indent}    const _v: ContractViolation = {`);
    lines.push(`${indent}      contractId: "${contract.id}",`);
    lines.push(`${indent}      assertionType: "${assertionType}",`);
    lines.push(`${indent}      expression: ${JSON.stringify(assertion.expression)},`);
    lines.push(`${indent}      actual: _val,`);
    lines.push(`${indent}      expected: ${JSON.stringify(assertion.description)},`);
    lines.push(`${indent}      timestamp: Date.now(),`);
    lines.push(`${indent}      requestId,`);
    lines.push(`${indent}      route: "${contract.route}",`);
    lines.push(`${indent}      method: "${contract.method}",`);
    lines.push(`${indent}      severity: "${assertion.severity}",`);
    lines.push(`${indent}    };`);
    lines.push(`${indent}    violations.push(_v);`);
    lines.push(`${indent}    _report(_v, opts);`);
    lines.push(`${indent}  }`);
    lines.push(`${indent}}`);
  }

  return lines;
}

function parseAssertionExpression(expression: string): { condition: string | null; valuePath: string } {
  const neqNull = expression.match(/^(.+?)\s*!=\s*null$/);
  if (neqNull) {
    const path = neqNull[1]!.trim();
    const access = generateValueAccess(path);
    return { condition: `${access} != null`, valuePath: path };
  }

  const eqString = expression.match(/^(.+?)\s*==\s*"(.+)"$/);
  if (eqString) {
    const path = eqString[1]!.trim();
    const access = generateValueAccess(path);
    return { condition: `${access} === ${JSON.stringify(eqString[2])}`, valuePath: path };
  }

  const eqNum = expression.match(/^(.+?)\s*==\s*(\d+(?:\.\d+)?)$/);
  if (eqNum) {
    const path = eqNum[1]!.trim();
    const access = generateValueAccess(path);
    return { condition: `${access} === ${eqNum[2]}`, valuePath: path };
  }

  const eqBool = expression.match(/^(.+?)\s*==\s*(true|false)$/);
  if (eqBool) {
    const path = eqBool[1]!.trim();
    const access = generateValueAccess(path);
    return { condition: `${access} === ${eqBool[2]}`, valuePath: path };
  }

  const typeofMatch = expression.match(/^typeof\s+(.+?)\s*==\s*"(\w+)"(.*)$/);
  if (typeofMatch) {
    const path = typeofMatch[1]!.trim();
    const access = generateValueAccess(path);
    const rest = typeofMatch[3]?.trim() ?? '';

    if (rest.startsWith('&&')) {
      return { condition: `typeof ${access} === "${typeofMatch[2]}" ${rest.replace('.match(', '.match(')}`, valuePath: path };
    }
    return { condition: `typeof ${access} === "${typeofMatch[2]}"`, valuePath: path };
  }

  const comparison = expression.match(/^(.+?)\s*(>=|<=|>|<)\s*(\d+(?:\.\d+)?)$/);
  if (comparison) {
    const path = comparison[1]!.trim();
    const access = generateValueAccess(path);
    return { condition: `${access} ${comparison[2]} ${comparison[3]}`, valuePath: path };
  }

  return { condition: `(${expression})`, valuePath: '' };
}

function generateValueAccess(path: string): string {
  if (!path) return 'undefined';

  if (path.startsWith('req.')) {
    return `_resolve(req, "${path.slice(4)}")`;
  }
  if (path.startsWith('res.')) {
    return `_resolve(res, "${path.slice(4)}")`;
  }
  if (path.startsWith('result.')) {
    return `_resolve(res?.body, "${path.slice(7)}")`;
  }

  return `_resolve(req, "${path}")`;
}

function generateExports(): string {
  return [
    '// --------------------------------------------------------------------------',
    '// Exports',
    '// --------------------------------------------------------------------------',
    '',
    'export { createISLMonitor };',
    'export type { ContractViolation, MonitorOptions };',
  ].join('\n');
}
