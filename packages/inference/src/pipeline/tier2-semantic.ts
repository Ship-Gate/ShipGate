/**
 * Tier 2: Semantic Rule Inference
 *
 * Best-effort heuristics that infer likely rules from the Tier 1 IR:
 * - "createUser" returns {id} and never null
 * - "getX" returns X | null and must not throw
 * - Guard clauses → preconditions
 * - Parse/validate patterns → preconditions + error cases
 * - Switch/enum exhaustiveness hints → invariants
 * - Side-effect detection → effects declarations
 *
 * Each rule carries a confidence score and evidence string.
 */

import type {
  TypedIntentIR,
  IRSymbol,
  IRFunction,
  IRMethod,
  IRClass,
  IRInterface,
  IRTypeAlias,
  IREnum,
  IRGuardClause,
  IRSideEffect,
  IRParameter,
  InferredRule,
  InferenceGap,
  Tier2Result,
} from './ir.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface Tier2Options {
  /** Minimum confidence to include a rule (default 0.3) */
  minConfidence?: number;
  /** Enable temporal heuristics (default true) */
  temporal?: boolean;
  /** Enable security heuristics (default true) */
  security?: boolean;
}

/**
 * Run Tier 2 semantic rule inference over a Tier 1 IR.
 */
export function inferSemanticRules(
  ir: TypedIntentIR,
  options: Tier2Options = {},
): Tier2Result {
  const minConfidence = options.minConfidence ?? 0.3;
  const allRules: InferredRule[] = [];
  const gaps: InferenceGap[] = [];

  const functions = ir.symbols.filter(isFunctionLike);
  const interfaces = ir.symbols.filter((s): s is IRInterface => s.kind === 'interface');
  const classes = ir.symbols.filter((s): s is IRClass => s.kind === 'class');
  const enums = ir.symbols.filter((s): s is IREnum => s.kind === 'enum');
  const typeAliases = ir.symbols.filter((s): s is IRTypeAlias => s.kind === 'typeAlias');

  // ── Per-function heuristics ──────────────────────────────────────────────

  for (const fn of functions) {
    const symbolName = fn.kind === 'method' ? `${fn.className}.${fn.name}` : fn.name;

    // 1. Guard clause → preconditions
    const guardRules = inferFromGuardClauses(symbolName, fn.guardClauses);
    allRules.push(...guardRules);

    // 2. Thrown errors → error cases
    const errorRules = inferFromThrows(symbolName, fn);
    allRules.push(...errorRules);

    // 3. Naming conventions → postconditions / nullability
    const namingRules = inferFromNaming(symbolName, fn);
    allRules.push(...namingRules);

    // 4. Return type nullability
    const nullRules = inferNullability(symbolName, fn);
    allRules.push(...nullRules);

    // 5. Side effects → effect declarations
    const effectRules = inferFromSideEffects(symbolName, fn.sideEffects);
    allRules.push(...effectRules);

    // 6. Parameter patterns
    const paramRules = inferFromParameters(symbolName, fn.parameters);
    allRules.push(...paramRules);

    // 7. Detect gaps
    const fnGaps = detectFunctionGaps(symbolName, fn, allRules);
    gaps.push(...fnGaps);
  }

  // ── Per-class heuristics ─────────────────────────────────────────────────

  for (const cls of classes) {
    for (const method of cls.methods) {
      const symbolName = `${cls.name}.${method.name}`;
      const guardRules = inferFromGuardClauses(symbolName, method.guardClauses);
      allRules.push(...guardRules);
      const errorRules = inferFromThrows(symbolName, method);
      allRules.push(...errorRules);
      const namingRules = inferFromNaming(symbolName, method);
      allRules.push(...namingRules);
      const nullRules = inferNullability(symbolName, method);
      allRules.push(...nullRules);
      const effectRules = inferFromSideEffects(symbolName, method.sideEffects);
      allRules.push(...effectRules);
      const paramRules = inferFromParameters(symbolName, method.parameters);
      allRules.push(...paramRules);
    }
  }

  // ── Type / interface heuristics ──────────────────────────────────────────

  for (const iface of interfaces) {
    const entityRules = inferEntityInvariants(iface.name, iface.properties);
    allRules.push(...entityRules);
  }

  for (const cls of classes) {
    const entityRules = inferEntityInvariants(cls.name, cls.properties);
    allRules.push(...entityRules);
  }

  // ── Enum exhaustiveness ──────────────────────────────────────────────────

  for (const en of enums) {
    allRules.push({
      symbolName: en.name,
      category: 'exhaustiveness',
      rule: `switch on ${en.name} must handle all members: ${en.members.join(', ')}`,
      confidence: 0.8,
      evidence: `Enum ${en.name} has ${en.members.length} members`,
      heuristic: 'enum-exhaustiveness',
    });
  }

  for (const ta of typeAliases) {
    if (ta.isStringLiteralUnion && ta.unionMembers) {
      allRules.push({
        symbolName: ta.name,
        category: 'exhaustiveness',
        rule: `switch on ${ta.name} must handle all variants: ${ta.unionMembers.join(', ')}`,
        confidence: 0.7,
        evidence: `String literal union ${ta.name} has ${ta.unionMembers.length} variants`,
        heuristic: 'union-exhaustiveness',
      });
    }
  }

  // ── Security heuristics ──────────────────────────────────────────────────

  if (options.security !== false) {
    const secRules = inferSecurityRules(ir, functions, interfaces, classes);
    allRules.push(...secRules);
  }

  // ── Temporal heuristics ──────────────────────────────────────────────────

  if (options.temporal !== false) {
    const tempRules = inferTemporalRules(functions);
    allRules.push(...tempRules);
  }

  // Filter by min confidence
  const filteredRules = allRules.filter((r) => r.confidence >= minConfidence);

  return { rules: filteredRules, gaps };
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic: guard clauses → preconditions
// ─────────────────────────────────────────────────────────────────────────────

function inferFromGuardClauses(
  symbolName: string,
  guards: IRGuardClause[],
): InferredRule[] {
  return guards.map((g) => ({
    symbolName,
    category: 'precondition' as const,
    rule: g.positiveCondition,
    confidence: 0.85,
    evidence: `Guard clause: if (${g.condition}) throw ${g.error?.errorClass ?? 'Error'}("${g.error?.message ?? ''}")`,
    heuristic: 'guard-clause',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic: thrown errors → error cases
// ─────────────────────────────────────────────────────────────────────────────

function inferFromThrows(
  symbolName: string,
  fn: IRFunction | IRMethod,
): InferredRule[] {
  const rules: InferredRule[] = [];

  for (const err of fn.throwsErrors) {
    rules.push({
      symbolName,
      category: 'error-case',
      rule: `throws ${err.errorClass}${err.message ? `: "${err.message}"` : ''}`,
      confidence: 0.9,
      evidence: err.guardCondition
        ? `Thrown when: ${err.guardCondition}`
        : `Throws ${err.errorClass} in function body`,
      heuristic: 'throw-analysis',
    });
  }

  return rules;
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic: naming conventions → postconditions
// ─────────────────────────────────────────────────────────────────────────────

const NAMING_PATTERNS: Array<{
  pattern: RegExp;
  infer: (name: string, fn: IRFunction | IRMethod) => InferredRule[];
}> = [
  {
    // createX → returns object with id, never null
    pattern: /^create(\w+)$/i,
    infer: (name, fn) => {
      const rules: InferredRule[] = [];
      const entity = name.replace(/^create/i, '');

      rules.push({
        symbolName: name,
        category: 'postcondition',
        rule: `result contains id field`,
        confidence: 0.7,
        evidence: `Function name "create${entity}" implies entity creation with ID`,
        heuristic: 'naming-create',
      });

      if (!fn.returnType.nullable) {
        rules.push({
          symbolName: name,
          category: 'postcondition',
          rule: `result is never null`,
          confidence: 0.75,
          evidence: `Return type ${fn.returnType.text} is non-nullable`,
          heuristic: 'naming-create-nonnull',
        });
      }

      return rules;
    },
  },
  {
    // getX / findX → may return null
    pattern: /^(?:get|find|fetch|load|lookup)(\w+)$/i,
    infer: (name, fn) => {
      const rules: InferredRule[] = [];

      if (fn.returnType.nullable) {
        rules.push({
          symbolName: name,
          category: 'nullability',
          rule: `may return null when entity not found`,
          confidence: 0.8,
          evidence: `Return type ${fn.returnType.text} is nullable`,
          heuristic: 'naming-getter-nullable',
        });
      }

      // Getters should not throw for not-found (prefer null)
      rules.push({
        symbolName: name,
        category: 'postcondition',
        rule: `should not throw for missing entity; return null instead`,
        confidence: 0.5,
        evidence: `Convention: getter functions return null for not-found`,
        heuristic: 'naming-getter-nothrow',
      });

      return rules;
    },
  },
  {
    // updateX → entity must exist
    pattern: /^update(\w+)$/i,
    infer: (name, _fn) => {
      const entity = name.replace(/^update/i, '');
      return [{
        symbolName: name,
        category: 'precondition',
        rule: `${entity} must exist before update`,
        confidence: 0.65,
        evidence: `Function name "update${entity}" implies pre-existing entity`,
        heuristic: 'naming-update-exists',
      }];
    },
  },
  {
    // deleteX / removeX → entity must exist
    pattern: /^(?:delete|remove)(\w+)$/i,
    infer: (name, _fn) => {
      const entity = name.replace(/^(?:delete|remove)/i, '');
      return [{
        symbolName: name,
        category: 'precondition',
        rule: `${entity} must exist before deletion`,
        confidence: 0.65,
        evidence: `Function name implies deletion of existing entity`,
        heuristic: 'naming-delete-exists',
      }];
    },
  },
  {
    // validateX / checkX → boolean return, no side effects
    pattern: /^(?:validate|check|verify|is|has|can)(\w+)$/i,
    infer: (name, fn) => {
      const rules: InferredRule[] = [];

      if (fn.sideEffects.length === 0) {
        rules.push({
          symbolName: name,
          category: 'effect',
          rule: `pure function: no side effects`,
          confidence: 0.6,
          evidence: `Validation function with no detected side effects`,
          heuristic: 'naming-validator-pure',
        });
      }

      return rules;
    },
  },
  {
    // login / authenticate → rate limiting, audit logging
    pattern: /^(?:login|authenticate|signIn)$/i,
    infer: (name, _fn) => [{
      symbolName: name,
      category: 'invariant',
      rule: `must be rate-limited per IP and per user`,
      confidence: 0.7,
      evidence: `Auth function "${name}" should have rate limiting`,
      heuristic: 'naming-auth-ratelimit',
    }],
  },
];

function inferFromNaming(
  symbolName: string,
  fn: IRFunction | IRMethod,
): InferredRule[] {
  const rules: InferredRule[] = [];
  const baseName = fn.name;

  for (const { pattern, infer } of NAMING_PATTERNS) {
    if (pattern.test(baseName)) {
      rules.push(...infer(symbolName, fn));
    }
  }

  return rules;
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic: return type nullability
// ─────────────────────────────────────────────────────────────────────────────

function inferNullability(
  symbolName: string,
  fn: IRFunction | IRMethod,
): InferredRule[] {
  const rules: InferredRule[] = [];

  if (fn.returnType.nullable && fn.returnType.unionParts) {
    const nonNullParts = fn.returnType.unionParts.filter(
      (p) => p !== 'null' && p !== 'undefined',
    );
    if (nonNullParts.length > 0) {
      rules.push({
        symbolName,
        category: 'nullability',
        rule: `returns ${nonNullParts.join(' | ')} | null`,
        confidence: 0.9,
        evidence: `Static return type: ${fn.returnType.text}`,
        heuristic: 'return-type-nullable',
      });
    }
  }

  if (fn.returnType.isPromise && fn.returnType.promiseInner) {
    rules.push({
      symbolName,
      category: 'postcondition',
      rule: `async: resolves to ${fn.returnType.promiseInner}`,
      confidence: 0.9,
      evidence: `Return type is Promise<${fn.returnType.promiseInner}>`,
      heuristic: 'async-return-type',
    });
  }

  return rules;
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic: side effects → effect declarations
// ─────────────────────────────────────────────────────────────────────────────

function inferFromSideEffects(
  symbolName: string,
  effects: IRSideEffect[],
): InferredRule[] {
  const rules: InferredRule[] = [];

  for (const effect of effects) {
    let rule: string;
    let confidence: number;

    switch (effect.type) {
      case 'db-read':
        rule = `reads from ${effect.target}`;
        confidence = 0.85;
        break;
      case 'db-write':
        rule = `writes to ${effect.target}`;
        confidence = 0.85;
        break;
      case 'db-delete':
        rule = `deletes from ${effect.target}`;
        confidence = 0.85;
        break;
      case 'http':
        rule = `makes HTTP request to ${effect.target}`;
        confidence = 0.8;
        break;
      case 'fs':
        rule = `accesses filesystem: ${effect.target}`;
        confidence = 0.8;
        break;
      case 'crypto':
        rule = `uses cryptographic operation: ${effect.target}`;
        confidence = 0.8;
        break;
      case 'random':
        rule = `uses nondeterministic source: ${effect.target}`;
        confidence = 0.75;
        break;
      case 'time':
        rule = `depends on current time`;
        confidence = 0.7;
        break;
      case 'global-write':
        rule = `writes to global state: ${effect.target}`;
        confidence = 0.8;
        break;
      case 'param-mutation':
        rule = `mutates parameter: ${effect.target}`;
        confidence = 0.85;
        break;
      case 'external':
        rule = `calls external service: ${effect.target}`;
        confidence = 0.75;
        break;
    }

    rules.push({
      symbolName,
      category: 'effect',
      rule,
      confidence,
      evidence: `Detected call: ${effect.callText}`,
      heuristic: 'side-effect-detection',
    });
  }

  return rules;
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic: parameter patterns
// ─────────────────────────────────────────────────────────────────────────────

function inferFromParameters(
  symbolName: string,
  params: IRParameter[],
): InferredRule[] {
  const rules: InferredRule[] = [];

  for (const param of params) {
    // Email params
    if (param.name.toLowerCase().includes('email') || param.type.text === 'string') {
      if (param.name.toLowerCase().includes('email')) {
        rules.push({
          symbolName,
          category: 'precondition',
          rule: `${param.name} must be valid email format`,
          confidence: 0.7,
          evidence: `Parameter named "${param.name}" implies email validation`,
          heuristic: 'param-name-email',
        });
      }
    }

    // Password params
    if (param.name.toLowerCase().includes('password')) {
      rules.push({
        symbolName,
        category: 'precondition',
        rule: `${param.name}.length >= 8`,
        confidence: 0.6,
        evidence: `Parameter named "${param.name}" implies password strength requirements`,
        heuristic: 'param-name-password',
      });
    }

    // Non-optional string params should be non-empty
    if (!param.optional && param.type.text === 'string' && !param.name.toLowerCase().includes('email') && !param.name.toLowerCase().includes('password')) {
      rules.push({
        symbolName,
        category: 'precondition',
        rule: `${param.name} must not be empty`,
        confidence: 0.5,
        evidence: `Required string parameter "${param.name}"`,
        heuristic: 'param-required-nonempty',
      });
    }

    // Mutated params → warning
    if (param.mutated) {
      rules.push({
        symbolName,
        category: 'effect',
        rule: `mutates input parameter "${param.name}"`,
        confidence: 0.9,
        evidence: `Static analysis detected mutation of "${param.name}"`,
        heuristic: 'param-mutation',
      });
    }
  }

  return rules;
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic: entity / interface invariants
// ─────────────────────────────────────────────────────────────────────────────

function inferEntityInvariants(
  entityName: string,
  properties: Array<{ name: string; type: { text: string; nullable: boolean }; optional: boolean; readonly: boolean }>,
): InferredRule[] {
  const rules: InferredRule[] = [];

  // Unique ID
  const idProp = properties.find((p) => p.name === 'id');
  if (idProp) {
    rules.push({
      symbolName: entityName,
      category: 'invariant',
      rule: `${entityName}.id is unique and immutable`,
      confidence: 0.85,
      evidence: `Entity has "id" field`,
      heuristic: 'entity-id-unique',
    });
  }

  // Unique email
  const emailProp = properties.find((p) => p.name === 'email' || p.name.includes('email'));
  if (emailProp) {
    rules.push({
      symbolName: entityName,
      category: 'invariant',
      rule: `${entityName}.${emailProp.name} is unique`,
      confidence: 0.75,
      evidence: `Entity has email field "${emailProp.name}"`,
      heuristic: 'entity-email-unique',
    });
  }

  // Secret fields
  for (const prop of properties) {
    if (
      prop.name.includes('password') ||
      prop.name.includes('secret') ||
      prop.name.includes('token') ||
      prop.name.includes('apiKey')
    ) {
      rules.push({
        symbolName: entityName,
        category: 'invariant',
        rule: `${entityName}.${prop.name} must never appear in logs`,
        confidence: 0.8,
        evidence: `Sensitive field name "${prop.name}"`,
        heuristic: 'entity-secret-nolog',
      });
    }
  }

  // Timestamp ordering
  const hasCreatedAt = properties.some((p) => p.name === 'createdAt' || p.name === 'created_at');
  const hasUpdatedAt = properties.some((p) => p.name === 'updatedAt' || p.name === 'updated_at');
  if (hasCreatedAt && hasUpdatedAt) {
    rules.push({
      symbolName: entityName,
      category: 'invariant',
      rule: `${entityName}.updatedAt >= ${entityName}.createdAt`,
      confidence: 0.9,
      evidence: `Entity has both createdAt and updatedAt timestamps`,
      heuristic: 'entity-timestamp-order',
    });
  }

  // Amount/quantity >= 0
  for (const prop of properties) {
    if (
      prop.name.includes('amount') ||
      prop.name.includes('quantity') ||
      prop.name.includes('count') ||
      prop.name.includes('balance') ||
      prop.name.includes('price') ||
      prop.name.includes('total')
    ) {
      rules.push({
        symbolName: entityName,
        category: 'invariant',
        rule: `${entityName}.${prop.name} >= 0`,
        confidence: 0.75,
        evidence: `Numeric field name "${prop.name}" implies non-negative`,
        heuristic: 'entity-nonnegative',
      });
    }
  }

  // FK references
  for (const prop of properties) {
    if (prop.name.endsWith('Id') && prop.name !== 'id') {
      const refEntity = prop.name.replace(/Id$/, '');
      const capitalized = refEntity.charAt(0).toUpperCase() + refEntity.slice(1);
      rules.push({
        symbolName: entityName,
        category: 'invariant',
        rule: `${entityName}.${prop.name} references valid ${capitalized}`,
        confidence: 0.7,
        evidence: `Field "${prop.name}" ends with "Id", implying foreign key`,
        heuristic: 'entity-fk-reference',
      });
    }
  }

  return rules;
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic: security rules
// ─────────────────────────────────────────────────────────────────────────────

function inferSecurityRules(
  ir: TypedIntentIR,
  functions: Array<IRFunction | IRMethod>,
  interfaces: IRInterface[],
  classes: IRClass[],
): InferredRule[] {
  const rules: InferredRule[] = [];

  // Password storage
  const hasPasswordField = [...interfaces, ...classes].some((s) =>
    ('properties' in s) && s.properties.some((p) => p.name.includes('password')),
  );
  if (hasPasswordField) {
    rules.push({
      symbolName: '__global__',
      category: 'invariant',
      rule: 'passwords must never be stored in plaintext',
      confidence: 0.9,
      evidence: 'Codebase contains password fields',
      heuristic: 'security-password-hash',
    });
  }

  // Auth logging
  const authFunctions = functions.filter((f) =>
    /^(login|authenticate|signIn|signUp|register)/i.test(f.name),
  );
  if (authFunctions.length > 0) {
    rules.push({
      symbolName: '__global__',
      category: 'invariant',
      rule: 'all authentication events must be logged',
      confidence: 0.75,
      evidence: `Auth functions found: ${authFunctions.map((f) => f.name).join(', ')}`,
      heuristic: 'security-auth-logging',
    });
  }

  // Sensitive data in hints
  const sensitiveHints = ir.runtimeHints.filter((h) => h.category === 'security');
  for (const hint of sensitiveHints) {
    rules.push({
      symbolName: hint.symbolName,
      category: 'invariant',
      rule: `sensitive operation detected: ${hint.detail}`,
      confidence: 0.7,
      evidence: hint.detail,
      heuristic: 'security-sensitive-op',
    });
  }

  return rules;
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic: temporal rules
// ─────────────────────────────────────────────────────────────────────────────

function inferTemporalRules(
  functions: Array<IRFunction | IRMethod>,
): InferredRule[] {
  const rules: InferredRule[] = [];

  for (const fn of functions) {
    const symbolName = fn.kind === 'method' ? `${fn.className}.${fn.name}` : fn.name;

    // Async functions with external calls should have timeouts
    if (fn.async) {
      const hasExternal = fn.sideEffects.some(
        (e) => e.type === 'http' || e.type === 'external',
      );
      if (hasExternal) {
        rules.push({
          symbolName,
          category: 'invariant',
          rule: `${fn.name} should complete within a reasonable timeout`,
          confidence: 0.6,
          evidence: `Async function makes external calls`,
          heuristic: 'temporal-timeout',
        });
      }
    }

    // Create/update operations should be idempotent
    if (/^(create|update|upsert)/i.test(fn.name) && fn.sideEffects.length > 0) {
      rules.push({
        symbolName,
        category: 'invariant',
        rule: `${fn.name} should be idempotent with same inputs`,
        confidence: 0.5,
        evidence: `Write operation with side effects`,
        heuristic: 'temporal-idempotent',
      });
    }
  }

  return rules;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gap detection
// ─────────────────────────────────────────────────────────────────────────────

function detectFunctionGaps(
  symbolName: string,
  fn: IRFunction | IRMethod,
  currentRules: InferredRule[],
): InferenceGap[] {
  const gaps: InferenceGap[] = [];
  const fnRules = currentRules.filter((r) => r.symbolName === symbolName);

  // Check for missing preconditions
  if (fn.parameters.length > 0 && !fnRules.some((r) => r.category === 'precondition')) {
    gaps.push({
      symbolName,
      missingCategory: 'precondition',
      reason: `Function has ${fn.parameters.length} params but no inferred preconditions`,
    });
  }

  // Check for missing postconditions
  if (fn.returnType.text !== 'void' && !fnRules.some((r) => r.category === 'postcondition')) {
    gaps.push({
      symbolName,
      missingCategory: 'postcondition',
      reason: `Function returns ${fn.returnType.text} but no inferred postconditions`,
    });
  }

  // Check for missing error cases on complex functions
  if (fn.parameters.length >= 2 && !fnRules.some((r) => r.category === 'error-case') && fn.throwsErrors.length === 0) {
    gaps.push({
      symbolName,
      missingCategory: 'error-case',
      reason: `Function has ${fn.parameters.length} params but no detected error cases`,
    });
  }

  return gaps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function isFunctionLike(s: IRSymbol): s is IRFunction | IRMethod {
  return s.kind === 'function' || s.kind === 'method';
}
