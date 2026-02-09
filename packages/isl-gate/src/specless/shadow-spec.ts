/**
 * Shadow Spec Generator — Heuristic ISL Inference
 *
 * Infers ISL behavioral expectations from source code WITHOUT AI.
 * When no ISL spec exists, generates a "shadow spec" — a temporary,
 * auto-generated ISL spec derived from code patterns.
 *
 * Decision: regex/heuristic approach only — no TypeScript compiler,
 * no LLM calls. A future phase will add AI-assisted generation.
 *
 * @module @isl-lang/gate/specless/shadow-spec
 */

// ============================================================================
// Types
// ============================================================================

/** Simplified function representation extracted from source code */
export interface FunctionInfo {
  /** Function/method name */
  name: string;
  /** Parameter names (type annotations stripped) */
  params: string[];
  /** Raw function body text */
  body: string;
  /** 1-based line number of the function declaration */
  line: number;
  /** Whether the function is declared async */
  isAsync: boolean;
  /** Whether the function is exported */
  isExport: boolean;
}

/** Import statement found in source */
export interface ImportInfo {
  /** Module path or name */
  module: string;
  /** Imported names (empty for default/namespace imports) */
  names: string[];
  /** 1-based line number */
  line: number;
}

/** Route handler found in source (Express/Koa/Fastify style) */
export interface RouteHandlerInfo {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Route path */
  path: string;
  /** 1-based line number */
  line: number;
  /** Raw handler body text */
  body: string;
}

/** Simplified source AST for heuristic pattern matching */
export interface SourceAST {
  /** Path to the source file */
  filePath: string;
  /** Extracted function/method declarations */
  functions: FunctionInfo[];
  /** Extracted import statements */
  imports: ImportInfo[];
  /** Extracted route handler registrations */
  routeHandlers: RouteHandlerInfo[];
  /** Original source code */
  rawSource: string;
}

/** Result of a pattern recognizer match */
export interface PatternMatch {
  /** Pattern identifier, e.g. "auth-login", "crud-create" */
  pattern: string;
  /** Source location where the pattern was found */
  location: { file: string; line: number };
  /** Valid ISL behavior fragment */
  inferredSpec: string;
  /** Confidence in this inference, 0–1 */
  confidence: number;
}

/** Pattern recognizer interface */
export interface PatternRecognizer {
  /** Human-readable recognizer name */
  name: string;
  /** Scan the source AST for matching patterns */
  match(ast: SourceAST): PatternMatch[];
}

/** Complete shadow spec output */
export interface ShadowSpec {
  /** Path of the analyzed source file */
  filePath: string;
  /** Individual ISL behavior fragments */
  inferredBehaviors: string[];
  /** Average confidence across all matched patterns, 0–1 */
  confidence: number;
  /** Complete ISL domain fragment (parseable by ISL parser) */
  islFragment: string;
  /** Detailed pattern match results */
  patterns: PatternMatch[];
  /** ISO timestamp of generation */
  generatedAt: string;
}

// ============================================================================
// ISL Reserved Words (cannot be used as identifiers)
// ============================================================================

const ISL_RESERVED = new Set([
  'domain', 'entity', 'behavior', 'type', 'enum',
  'input', 'output', 'preconditions', 'postconditions', 'invariants',
  'temporal', 'security', 'compliance', 'actors',
  'true', 'false', 'null',
  'and', 'or', 'not', 'implies', 'iff',
  'old', 'result', 'now',
  'all', 'any', 'none',
  'success', 'eventually', 'always', 'within', 'never', 'immediately',
  'scenario', 'scenarios', 'chaos', 'inject',
  'given', 'when', 'then',
  'policy', 'view', 'imports', 'from',
]);

// ============================================================================
// Source Parser (regex-based — no TypeScript compiler)
// ============================================================================

/**
 * Parse source code into a simplified AST using regex heuristics.
 * Does NOT require a TypeScript compiler — works on any JS/TS-like code.
 */
export function parseSource(filePath: string, sourceCode: string): SourceAST {
  return {
    filePath,
    functions: extractFunctions(sourceCode),
    imports: extractImports(sourceCode),
    routeHandlers: extractRouteHandlers(sourceCode),
    rawSource: sourceCode,
  };
}

/**
 * Extract function/method declarations from source code.
 * Handles: function declarations, arrow functions, class methods.
 */
function extractFunctions(source: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines = source.split('\n');

  // Pattern: [export] [async] function name(...) [: ReturnType] {
  const funcDeclPattern =
    /^(\s*)(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/;

  // Pattern: [export] const/let name = [async] (...) => ...
  const arrowPattern =
    /^(\s*)(export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*(?::[^=]*)?=>/;

  // Pattern: [async] name(...) { — class method
  const methodPattern =
    /^(\s*)(async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::[^{]*)?\{/;

  // Keywords that look like methods but aren't
  const NOT_METHODS = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'constructor',
    'get', 'set', 'return', 'class', 'import', 'export',
    'const', 'let', 'var', 'new', 'throw', 'typeof', 'delete',
  ]);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    let match: RegExpMatchArray | null;

    // Function declaration
    match = line.match(funcDeclPattern);
    if (match) {
      functions.push({
        name: match[4],
        params: splitParams(match[5]),
        body: extractBody(lines, i),
        line: i + 1,
        isAsync: match[3] !== undefined,
        isExport: match[2] !== undefined,
      });
      continue;
    }

    // Arrow function
    match = line.match(arrowPattern);
    if (match) {
      functions.push({
        name: match[3],
        params: splitParams(match[5]),
        body: extractBody(lines, i),
        line: i + 1,
        isAsync: match[4] !== undefined,
        isExport: match[2] !== undefined,
      });
      continue;
    }

    // Class method (skip non-methods)
    match = line.match(methodPattern);
    if (match && !NOT_METHODS.has(match[3])) {
      functions.push({
        name: match[3],
        params: splitParams(match[4]),
        body: extractBody(lines, i),
        line: i + 1,
        isAsync: match[2] !== undefined,
        isExport: false,
      });
    }
  }

  return functions;
}

/**
 * Extract the body of a function by matching braces.
 * Returns up to 100 lines starting from the declaration line.
 * If no brace block is found within 5 lines, returns those lines as-is.
 */
function extractBody(lines: string[], startIndex: number): string {
  let depth = 0;
  let started = false;
  const bodyLines: string[] = [];
  const limit = Math.min(lines.length, startIndex + 100);

  for (let i = startIndex; i < limit; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') { depth++; started = true; }
      if (ch === '}') depth--;
    }
    bodyLines.push(line);
    if (started && depth <= 0) break;
    // Safety: if no brace found within 5 lines, stop scanning
    if (!started && bodyLines.length >= 5) break;
  }

  return bodyLines.join('\n');
}

/**
 * Split a parameter string into parameter names, stripping types and defaults.
 */
function splitParams(paramStr: string): string[] {
  if (!paramStr.trim()) return [];
  return paramStr
    .split(',')
    .map(p => p.trim().split(/[\s:=]/)[0].replace(/[?{}]/g, '').trim())
    .filter(Boolean);
}

/**
 * Extract import statements from source code.
 */
function extractImports(source: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = source.split('\n');

  const namedImport = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;
  const defaultImport = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/;
  const requireCall =
    /(?:const|let|var)\s+\{?([^}=]+)\}?\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let m = line.match(namedImport);
    if (m) {
      imports.push({
        module: m[2],
        names: m[1].split(',').map(n => n.trim().split(/\s+/)[0]).filter(Boolean),
        line: i + 1,
      });
      continue;
    }

    m = line.match(defaultImport);
    if (m) {
      imports.push({ module: m[2], names: [m[1]], line: i + 1 });
      continue;
    }

    m = line.match(requireCall);
    if (m) {
      imports.push({
        module: m[2],
        names: m[1].split(',').map(n => n.trim()).filter(Boolean),
        line: i + 1,
      });
    }
  }

  return imports;
}

/**
 * Extract Express/Koa/Fastify-style route handler registrations.
 */
function extractRouteHandlers(source: string): RouteHandlerInfo[] {
  const handlers: RouteHandlerInfo[] = [];
  const lines = source.split('\n');

  const routePattern =
    /(?:app|router|server)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/i;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(routePattern);
    if (m) {
      handlers.push({
        method: m[1].toUpperCase() as RouteHandlerInfo['method'],
        path: m[2],
        line: i + 1,
        body: extractBody(lines, i),
      });
    }
  }

  return handlers;
}

// ============================================================================
// ISL Fragment Builder
// ============================================================================

interface BehaviorConfig {
  name: string;
  description?: string;
  inputFields?: Array<{ name: string; type: string }>;
  preconditions?: string[];
  postconditions?: Array<{ condition: string; predicates: string[] }>;
  securitySpecs?: Array<{ type: 'requires' | 'rate_limit'; expression: string }>;
}

/**
 * Build a valid ISL behavior block from configuration.
 * Output is indented for inclusion inside a domain block.
 */
function buildBehaviorISL(config: BehaviorConfig): string {
  const lines: string[] = [];
  lines.push(`  behavior ${config.name} {`);

  if (config.description) {
    lines.push(`    description: "${escapeISLString(config.description)}"`);
  }

  if (config.inputFields && config.inputFields.length > 0) {
    const fields = config.inputFields
      .map(f => `${f.name}: ${f.type}`)
      .join(', ');
    lines.push(`    input { ${fields} }`);
  }

  if (config.preconditions && config.preconditions.length > 0) {
    lines.push('    preconditions {');
    for (const pre of config.preconditions) {
      lines.push(`      ${pre}`);
    }
    lines.push('    }');
  }

  if (config.postconditions && config.postconditions.length > 0) {
    lines.push('    postconditions {');
    for (const post of config.postconditions) {
      lines.push(`      ${post.condition} implies {`);
      for (const pred of post.predicates) {
        lines.push(`        ${pred}`);
      }
      lines.push('      }');
    }
    lines.push('    }');
  }

  if (config.securitySpecs && config.securitySpecs.length > 0) {
    lines.push('    security {');
    for (const spec of config.securitySpecs) {
      lines.push(`      ${spec.type} ${spec.expression}`);
    }
    lines.push('    }');
  }

  lines.push('  }');
  return lines.join('\n');
}

/** Escape a string for ISL string literals. */
function escapeISLString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ============================================================================
// Naming Utilities
// ============================================================================

/** Convert a string to PascalCase. */
function toPascalCase(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]/g, '_')
    .split('_')
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

/**
 * Ensure a name is a valid ISL identifier (not a reserved word).
 * PascalCase avoids most collisions since reserved words are lowercase,
 * but we add a trailing underscore if it still matches.
 */
function safeIdentifier(name: string): string {
  const pascal = toPascalCase(name);
  if (ISL_RESERVED.has(pascal.toLowerCase()) && pascal.toLowerCase() === pascal) {
    return `${pascal}_`;
  }
  return pascal || 'Unknown';
}

/**
 * Convert a file path to a valid ISL domain name.
 * e.g. "src/auth/login.ts" → "ShadowSpec_AuthLogin"
 */
function filePathToDomainName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const stripped = normalized
    .replace(/^.*?src\//, '')  // strip everything up to src/
    .replace(/\.[^.]+$/, ''); // strip file extension

  const segments = stripped.split('/').filter(Boolean);
  const name = segments.map(s => toPascalCase(s)).join('');
  return `ShadowSpec_${name || 'Unknown'}`;
}

// ============================================================================
// ISL Domain Assembler
// ============================================================================

/**
 * Assemble pattern matches into a complete ISL domain string.
 * Output is a valid ISL program parseable by @isl-lang/parser.
 */
function assembleShadowISL(matches: PatternMatch[], filePath: string): string {
  if (matches.length === 0) return '';

  const domainName = filePathToDomainName(filePath);
  const patternNames = [...new Set(matches.map(m => m.pattern))].join(', ');
  const avgConf = averageConfidence(matches);

  const header = [
    `// Auto-generated shadow spec for ${filePath}`,
    `// Confidence: ${avgConf.toFixed(2)} | Patterns: ${patternNames}`,
    `// Review and commit: shipgate isl adopt ${filePath}`,
    '',
  ].join('\n');

  // Deduplicate behavior names
  const usedNames = new Set<string>();
  const behaviors: string[] = [];

  for (const m of matches) {
    const nameMatch = m.inferredSpec.match(/behavior\s+(\w+)/);
    if (!nameMatch) continue;

    let behaviorName = nameMatch[1];
    if (usedNames.has(behaviorName)) {
      let counter = 2;
      while (usedNames.has(`${behaviorName}${counter}`)) counter++;
      const original = behaviorName;
      behaviorName = `${behaviorName}${counter}`;
      behaviors.push(
        m.inferredSpec.replace(`behavior ${original}`, `behavior ${behaviorName}`),
      );
    } else {
      behaviors.push(m.inferredSpec);
    }
    usedNames.add(behaviorName);
  }

  const body = behaviors.join('\n\n');
  const domain = `domain ${domainName} {\n  version: "0.0.1"\n\n${body}\n}`;

  return header + domain;
}

/** Compute the average confidence of a list of pattern matches. */
function averageConfidence(matches: PatternMatch[]): number {
  if (matches.length === 0) return 0;
  const sum = matches.reduce((acc, m) => acc + m.confidence, 0);
  return sum / matches.length;
}

// ============================================================================
// Pattern Recognizers
// ============================================================================

// ── 1. Auth Pattern Recognizer ──────────────────────────────────────

function createAuthRecognizer(): PatternRecognizer {
  const AUTH_NAMES = /^(login|logIn|signIn|signin|authenticate|auth)$/i;
  const JWT_BODY = /jwt\.sign|jsonwebtoken|createToken|generateToken/i;

  return {
    name: 'auth',
    match(ast: SourceAST): PatternMatch[] {
      const matches: PatternMatch[] = [];

      for (const fn of ast.functions) {
        // Login / authenticate functions
        if (AUTH_NAMES.test(fn.name)) {
          const behaviorName = safeIdentifier(fn.name);
          const inputFields: BehaviorConfig['inputFields'] = [];

          if (fn.params.some(p => /email/i.test(p))) {
            inputFields.push({ name: 'email', type: 'String' });
          }
          if (fn.params.some(p => /password|passwd|pwd/i.test(p))) {
            inputFields.push({ name: 'password', type: 'String' });
          }
          if (inputFields.length === 0 && fn.params.length > 0) {
            inputFields.push({ name: 'credentials', type: 'String' });
          }

          matches.push({
            pattern: 'auth-login',
            location: { file: ast.filePath, line: fn.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `Shadow spec for ${fn.name}`,
              inputFields,
              postconditions: [
                { condition: 'success', predicates: ['result != null'] },
              ],
              securitySpecs: [
                { type: 'requires', expression: 'validated_input' },
                { type: 'rate_limit', expression: '10' },
              ],
            }),
            confidence: 0.82,
          });
        }

        // JWT creation detected in function body
        if (JWT_BODY.test(fn.body)) {
          const behaviorName = safeIdentifier(`${fn.name}Token`);
          matches.push({
            pattern: 'auth-jwt',
            location: { file: ast.filePath, line: fn.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `JWT handling in ${fn.name}`,
              postconditions: [
                { condition: 'success', predicates: ['result != null'] },
              ],
              securitySpecs: [
                { type: 'requires', expression: 'signed_token' },
              ],
            }),
            confidence: 0.78,
          });
        }
      }

      // Fall-through: auth libraries imported but no function matched above
      const hasAuthImport = ast.imports.some(imp =>
        /jsonwebtoken|passport|bcrypt|argon2|auth0/i.test(imp.module),
      );
      if (hasAuthImport && matches.length === 0) {
        const firstImport = ast.imports.find(imp =>
          /jsonwebtoken|passport|bcrypt|argon2|auth0/i.test(imp.module),
        );
        matches.push({
          pattern: 'auth-library',
          location: { file: ast.filePath, line: firstImport?.line ?? 1 },
          inferredSpec: buildBehaviorISL({
            name: 'AuthOperation',
            description: 'Auth library detected',
            postconditions: [
              { condition: 'success', predicates: ['result != null'] },
            ],
            securitySpecs: [
              { type: 'requires', expression: 'validated_input' },
            ],
          }),
          confidence: 0.55,
        });
      }

      return matches;
    },
  };
}

// ── 2. CRUD Pattern Recognizer ──────────────────────────────────────

function createCrudRecognizer(): PatternRecognizer {
  const CREATE_NAME = /^create\w*/i;
  const DELETE_NAME = /^(delete|remove)\w*/i;
  const UPDATE_NAME = /^(update|edit|modify)\w*/i;

  return {
    name: 'crud',
    match(ast: SourceAST): PatternMatch[] {
      const matches: PatternMatch[] = [];

      for (const fn of ast.functions) {
        // create* functions → must validate input, should return entity
        if (CREATE_NAME.test(fn.name)) {
          const entity = fn.name.replace(/^create/i, '') || 'Resource';
          const behaviorName = safeIdentifier(`Create${entity}`);
          matches.push({
            pattern: 'crud-create',
            location: { file: ast.filePath, line: fn.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `Create ${entity}`,
              inputFields: [{ name: 'data', type: 'String' }],
              preconditions: ['input.data != null'],
              postconditions: [
                { condition: 'success', predicates: ['result != null'] },
              ],
            }),
            confidence: 0.75,
          });
        }

        // delete* / remove* → must check authorization, should soft-delete
        if (DELETE_NAME.test(fn.name)) {
          const entity = fn.name.replace(/^(delete|remove)/i, '') || 'Resource';
          const behaviorName = safeIdentifier(`Delete${entity}`);
          matches.push({
            pattern: 'crud-delete',
            location: { file: ast.filePath, line: fn.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `Delete ${entity}`,
              postconditions: [
                { condition: 'success', predicates: ['result != null'] },
              ],
              securitySpecs: [
                { type: 'requires', expression: 'authorization_check' },
              ],
            }),
            confidence: 0.72,
          });
        }

        // update* / edit* / modify* → must validate, must check ownership
        if (UPDATE_NAME.test(fn.name)) {
          const entity = fn.name.replace(/^(update|edit|modify)/i, '') || 'Resource';
          const behaviorName = safeIdentifier(`Update${entity}`);
          matches.push({
            pattern: 'crud-update',
            location: { file: ast.filePath, line: fn.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `Update ${entity}`,
              inputFields: [{ name: 'data', type: 'String' }],
              preconditions: ['input.data != null'],
              postconditions: [
                { condition: 'success', predicates: ['result != null'] },
              ],
            }),
            confidence: 0.72,
          });
        }
      }

      return matches;
    },
  };
}

// ── 3. Payment Pattern Recognizer ───────────────────────────────────

function createPaymentRecognizer(): PatternRecognizer {
  const PAYMENT_NAME =
    /payment|charge|checkout|billing|invoice|refund|stripe/i;
  const PAYMENT_BODY =
    /stripe|paypal|braintree|\.charges?\.|\.payment|\.refund/i;

  return {
    name: 'payment',
    match(ast: SourceAST): PatternMatch[] {
      const matches: PatternMatch[] = [];

      for (const fn of ast.functions) {
        const nameHit = PAYMENT_NAME.test(fn.name);
        const bodyHit = PAYMENT_BODY.test(fn.body);

        if (nameHit || bodyHit) {
          const behaviorName = safeIdentifier(fn.name);
          // Both name + body → stronger signal
          const confidence = nameHit && bodyHit ? 0.88 : nameHit ? 0.78 : 0.70;

          matches.push({
            pattern: 'payment-processing',
            location: { file: ast.filePath, line: fn.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `Payment processing in ${fn.name}`,
              inputFields: [{ name: 'amount', type: 'Decimal' }],
              preconditions: ['input.amount > 0'],
              postconditions: [
                { condition: 'success', predicates: ['result != null'] },
              ],
            }),
            confidence,
          });
        }
      }

      // Fall-through: payment library imported but no function matched
      const hasPaymentImport = ast.imports.some(imp =>
        /stripe|paypal|braintree|square/i.test(imp.module),
      );
      if (hasPaymentImport && matches.length === 0) {
        const firstImport = ast.imports.find(imp =>
          /stripe|paypal|braintree|square/i.test(imp.module),
        );
        matches.push({
          pattern: 'payment-library',
          location: { file: ast.filePath, line: firstImport?.line ?? 1 },
          inferredSpec: buildBehaviorISL({
            name: 'PaymentOperation',
            description: 'Payment library detected',
            inputFields: [{ name: 'amount', type: 'Decimal' }],
            preconditions: ['input.amount > 0'],
            postconditions: [
              { condition: 'success', predicates: ['result != null'] },
            ],
          }),
          confidence: 0.60,
        });
      }

      return matches;
    },
  };
}

// ── 4. API Route Pattern Recognizer ─────────────────────────────────

function createApiRouteRecognizer(): PatternRecognizer {
  const FILE_UPLOAD_BODY =
    /multer|upload|formidable|busboy|multipart/i;
  const AUTH_MIDDLEWARE_BODY =
    /authenticate|requireAuth|isAuthenticated|verifyToken|checkAuth/i;

  return {
    name: 'api-route',
    match(ast: SourceAST): PatternMatch[] {
      const matches: PatternMatch[] = [];

      for (const handler of ast.routeHandlers) {
        // POST handlers → must validate body, must return proper status
        if (handler.method === 'POST') {
          const pathParts = handler.path
            .replace(/^\//, '')
            .split('/')
            .filter(Boolean);
          const routeLabel = pathParts.length > 0
            ? pathParts.map(p => toPascalCase(p.replace(/:/g, ''))).join('')
            : 'Request';
          const behaviorName = safeIdentifier(`Post${routeLabel}`);

          matches.push({
            pattern: 'api-post-handler',
            location: { file: ast.filePath, line: handler.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `POST ${handler.path}`,
              inputFields: [{ name: 'body', type: 'String' }],
              preconditions: ['input.body != null'],
              postconditions: [
                { condition: 'success', predicates: ['result != null'] },
              ],
            }),
            confidence: 0.68,
          });
        }

        // File upload detection
        if (FILE_UPLOAD_BODY.test(handler.body)) {
          const behaviorName = safeIdentifier(
            `FileUpload${toPascalCase(handler.path)}`,
          );
          matches.push({
            pattern: 'api-file-upload',
            location: { file: ast.filePath, line: handler.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `File upload at ${handler.path}`,
              inputFields: [{ name: 'file_data', type: 'String' }],
              preconditions: ['input.file_data != null'],
              postconditions: [
                { condition: 'success', predicates: ['result != null'] },
              ],
              securitySpecs: [
                { type: 'requires', expression: 'validated_content_type' },
              ],
            }),
            confidence: 0.72,
          });
        }

        // Auth middleware detected in handler body
        if (AUTH_MIDDLEWARE_BODY.test(handler.body)) {
          const behaviorName = safeIdentifier(
            `AuthGuard${toPascalCase(handler.path)}`,
          );
          matches.push({
            pattern: 'api-auth-middleware',
            location: { file: ast.filePath, line: handler.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `Auth middleware at ${handler.path}`,
              postconditions: [
                { condition: 'success', predicates: ['result != null'] },
              ],
              securitySpecs: [
                { type: 'requires', expression: 'valid_token' },
              ],
            }),
            confidence: 0.65,
          });
        }
      }

      return matches;
    },
  };
}

// ── 5. Security Pattern Recognizer ──────────────────────────────────

function createSecurityRecognizer(): PatternRecognizer {
  const PASSWORD_BODY = /password|passwd|pwd/i;
  const HASH_BODY =
    /bcrypt|argon2|scrypt|hashPassword|hash\(|\.hash\s*\(/i;
  const SQL_KEYWORDS =
    /(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\s+/;
  const SQL_CONCAT =
    /['"`]\s*\+\s*\w+|`[^`]*\$\{[^}]*\}[^`]*`/;
  const EVAL_BODY =
    /\beval\s*\(|\bnew\s+Function\s*\(|\bexec\s*\(/;

  return {
    name: 'security',
    match(ast: SourceAST): PatternMatch[] {
      const matches: PatternMatch[] = [];

      for (const fn of ast.functions) {
        const hasPasswordRef = PASSWORD_BODY.test(fn.body);
        const hasHashing = HASH_BODY.test(fn.body);
        const hasSqlKeywords = SQL_KEYWORDS.test(fn.body);
        const hasSqlConcat = SQL_CONCAT.test(fn.body);
        const hasEval = EVAL_BODY.test(fn.body);

        // Password handling WITHOUT hashing → must hash
        if (hasPasswordRef && !hasHashing) {
          const behaviorName = safeIdentifier(`${fn.name}PasswordSafety`);
          matches.push({
            pattern: 'security-password-plaintext',
            location: { file: ast.filePath, line: fn.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `Password handling in ${fn.name} — must hash`,
              postconditions: [
                { condition: 'success', predicates: ['result != null'] },
              ],
              securitySpecs: [
                { type: 'requires', expression: 'hashed_password' },
              ],
            }),
            confidence: 0.85,
          });
        }

        // Password handling WITH hashing → positive signal
        if (hasPasswordRef && hasHashing) {
          const behaviorName = safeIdentifier(`${fn.name}PasswordHash`);
          matches.push({
            pattern: 'security-password-hashed',
            location: { file: ast.filePath, line: fn.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `Password hashing in ${fn.name}`,
              postconditions: [
                { condition: 'success', predicates: ['result != null'] },
              ],
              securitySpecs: [
                { type: 'requires', expression: 'hashed_password' },
              ],
            }),
            confidence: 0.90,
          });
        }

        // SQL with string concatenation → must parameterize
        if (hasSqlKeywords && hasSqlConcat) {
          const behaviorName = safeIdentifier(`${fn.name}SqlSafety`);
          matches.push({
            pattern: 'security-sql-injection',
            location: { file: ast.filePath, line: fn.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `SQL in ${fn.name} — must parameterize`,
              securitySpecs: [
                { type: 'requires', expression: 'parameterized_queries' },
              ],
            }),
            confidence: 0.88,
          });
        }

        // eval/exec/new Function → critical risk
        if (hasEval) {
          const behaviorName = safeIdentifier(`${fn.name}NoEval`);
          matches.push({
            pattern: 'security-eval-critical',
            location: { file: ast.filePath, line: fn.line },
            inferredSpec: buildBehaviorISL({
              name: behaviorName,
              description: `Dynamic evaluation in ${fn.name} — critical risk`,
              securitySpecs: [
                { type: 'requires', expression: 'no_dynamic_eval' },
              ],
            }),
            confidence: 0.92,
          });
        }
      }

      return matches;
    },
  };
}

// ============================================================================
// Recognizer Registry
// ============================================================================

/**
 * All built-in pattern recognizers, in priority order.
 */
export const recognizers: readonly PatternRecognizer[] = [
  createAuthRecognizer(),
  createCrudRecognizer(),
  createPaymentRecognizer(),
  createApiRouteRecognizer(),
  createSecurityRecognizer(),
];

// ============================================================================
// Shadow Spec Generator (main entry point)
// ============================================================================

/**
 * Generate a shadow spec for a source file.
 *
 * Parses the source code, runs all pattern recognizers, and assembles
 * a complete ISL domain fragment. Uses heuristics only — no AI.
 *
 * @param filePath - Path to the source file
 * @param sourceCode - Raw source code content
 * @param context - Optional PR/commit context for confidence boosting
 * @returns Shadow spec with ISL fragment and metadata
 */
export async function generateShadowSpec(
  filePath: string,
  sourceCode: string,
  context?: { prTitle?: string; commitMessage?: string },
): Promise<ShadowSpec> {
  const ast = parseSource(filePath, sourceCode);
  const allMatches: PatternMatch[] = [];

  for (const recognizer of recognizers) {
    const matched = recognizer.match(ast);
    allMatches.push(...matched);
  }

  // Boost confidence when PR/commit context matches the pattern category
  if (context) {
    for (const match of allMatches) {
      const boost = computeContextBoost(match, context);
      match.confidence = Math.min(1, match.confidence + boost);
    }
  }

  return {
    filePath,
    inferredBehaviors: allMatches.map(m => m.inferredSpec),
    confidence: averageConfidence(allMatches),
    islFragment: assembleShadowISL(allMatches, filePath),
    patterns: allMatches,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Context Boost
// ============================================================================

/** Category → keywords that strengthen confidence when found in PR/commit. */
const CONTEXT_KEYWORDS: Record<string, string[]> = {
  auth: ['auth', 'login', 'signin', 'jwt', 'token', 'session'],
  crud: ['create', 'update', 'delete', 'remove', 'edit', 'crud'],
  payment: ['payment', 'stripe', 'charge', 'billing', 'checkout'],
  'api-route': ['api', 'route', 'endpoint', 'handler', 'middleware'],
  security: ['security', 'password', 'hash', 'sql', 'injection', 'eval'],
};

/**
 * Compute a small confidence boost (0 or 0.05) based on PR/commit context.
 */
function computeContextBoost(
  match: PatternMatch,
  context: { prTitle?: string; commitMessage?: string },
): number {
  const combined =
    `${context.prTitle ?? ''} ${context.commitMessage ?? ''}`.toLowerCase();
  const category = match.pattern.split('-')[0];
  const keywords = CONTEXT_KEYWORDS[category] ?? [];
  return keywords.some(kw => combined.includes(kw)) ? 0.05 : 0;
}
